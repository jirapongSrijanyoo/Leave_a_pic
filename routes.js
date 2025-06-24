const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { fileTypeFromBuffer } = require("file-type");
const rateLimit = require("express-rate-limit");

const router = express.Router();
// Update the uploads folder path from "cdn/uploads" to "uploads"
const uploadsPath = "uploads";
const allowedMimeTypes = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "audio/mpeg", "video/mp4",
  "application/pdf", "application/zip", "application/x-zip-compressed"
];
const allowedExt = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp3", ".mp4",
  ".pdf", ".zip"
];
const DELETE_PASSWORD = "1234";

// Resolve the absolute uploads path once
const absoluteUploadsPath = path.resolve(uploadsPath);

// Helper function to validate paths using path.relative (checks for ../ traversal)
function isValidPath(resolvedPath) {
    // Calculate the relative path from the uploads directory to the resolved path
    const relativePath = path.relative(absoluteUploadsPath, resolvedPath);

    // If the relative path starts with '..', it means resolvedPath is outside uploadsPath
    // An empty string means resolvedPath is uploadsPath itself, which is valid.
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

// Helper function to get real path and validate it's within uploads
function getValidatedRealPath(userPath) {
    const resolvedPath = path.resolve(uploadsPath, userPath);

    if (!isValidPath(resolvedPath)) {
        console.warn(`[Security] Invalid path traversal attempt detected: ${userPath}`);
        return { error: "เส้นทางไม่ถูกต้อง" };
    }

    try {
        const realPath = fs.realpathSync(resolvedPath);
        if (!realPath.startsWith(absoluteUploadsPath)) {
             console.warn(`[Security] Symlink traversal attempt detected: ${userPath} -> ${realPath}`);
             return { error: "เส้นทางไม่ถูกต้อง (symlink)" };
        }
        return { realPath };
    } catch (err) {
        // Handle cases where the path doesn't exist or is inaccessible
        // console.error(`Error resolving real path for ${userPath}:`, err);
        return { error: "ไม่พบเส้นทาง หรือไม่สามารถเข้าถึงได้" };
    }
}


// ตั้งค่า multer
const storage = multer.diskStorage({
  destination: uploadsPath,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// กำหนด Rate Limiting สำหรับ /upload โดยไม่พึ่งพา IP
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 นาที
  max: 5,              // จำกัดการอัปโหลด 5 ครั้ง ต่อ 1 นาที (ทั้งหมด)
  keyGenerator: () => 'single-user',  // ทุกคำขอจะใช้ค่าเดียวกัน
  message: {
    error: "คุณอัปโหลดเร็วเกินไป! จำกัดไว้ที่ 5 ไฟล์/นาที"
  }
});

// ✅ อัปโหลดพร้อมเช็ก MIME จริง และเช็กนามสกุลไฟล์
router.post("/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path; // Multer already handles basic path safety within the destination
  const originalExt = path.extname(req.file.originalname).toLowerCase();

  // --- New Check: Validate File Extension ---
  if (!allowedExt.includes(originalExt)) {
      fs.unlinkSync(filePath); // Delete the file immediately
      console.warn(`Rejected upload based on extension: ${req.file.originalname}`);
      return res.status(400).json({ error: "ไม่อนุญาตให้อัปโหลดไฟล์นามสกุลนี้" });
  }
  // --- End New Check ---


  const buffer = fs.readFileSync(filePath);
  const fileType = await fileTypeFromBuffer(buffer);

  // --- Existing Check: Validate MIME Type from Content ---
  if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
    fs.unlinkSync(filePath); // ลบไฟล์ทันที
    console.warn(`Rejected upload based on MIME type: ${req.file.originalname} (Detected: ${fileType?.mime})`);
    return res.status(400).json({ error: "ไม่อนุญาตให้อัปโหลดไฟล์ชนิดนี้" });
  }
  // --- End Existing Check ---


  // If both checks pass
  // No realpath check needed here as multer creates the file with a safe name in the uploads dir
  const fileUrl = `https://demo.lamar.in.th/file/${req.file.filename}`;
  res.json({ fileUrl });
});

// route แสดงรายการไฟล์ (กรองเฉพาะไฟล์ปลอดภัย)
router.get("/files", (req, res) => {
  function listItems(dir, rel) {
    let items = [];
    let entries;
    try {
        // Use realpath for the directory being listed
        const realDir = fs.realpathSync(dir);
         if (!realDir.startsWith(absoluteUploadsPath)) {
             console.warn(`[Security] Symlink traversal attempt during listing: ${dir} -> ${realDir}`);
             return []; // Stop listing if directory is outside uploads
         }
        entries = fs.readdirSync(realDir, { withFileTypes: true });
    } catch (e) {
        console.error(`Error reading directory ${dir}:`, e);
        return []; // Return empty array if directory cannot be read or realpath fails
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name); // Use original path for recursion logic
      const entryRel = rel ? path.join(rel, entry.name) : entry.name;

      // Resolve the path for validation
      const absoluteEntryPath = path.resolve(entryPath);

      // Perform initial path validation (../ traversal)
      if (!isValidPath(absoluteEntryPath)) {
           console.warn(`[Security] Skipping potentially malicious path during listing (../): ${entryPath}`);
           continue; // Skip this entry if it's outside uploads via ../
      }

      // Perform realpath validation for existing entries
      try {
          const realEntryPath = fs.realpathSync(absoluteEntryPath);
           if (!realEntryPath.startsWith(absoluteUploadsPath)) {
               console.warn(`[Security] Skipping potentially malicious path during listing (symlink): ${entryPath} -> ${realEntryPath}`);
               continue; // Skip this entry if it's a symlink pointing outside
           }

            if (entry.isDirectory()) {
                // Add folder marker
                items.push({ name: entryRel.replace(/\\/g, "/"), folder: true });
                // Recursively add folder content using the original path structure
                items = items.concat(listItems(entryPath, entryRel));
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (allowedExt.includes(ext)) {
                  try {
                    const stats = fs.statSync(realEntryPath); // Get file stats using real path
                     // Ensure the URL uses forward slashes and the relative path
                    items.push({
                      name: entryRel.replace(/\\/g, "/"),
                      url: `https://demo.lamar.in.th/file/${entryRel.replace(/\\/g, "/")}`, //แก้ตรงนี้เป็นโมเมนของคุณ
                      size: stats.size // Include file size
                    });
                  } catch (statError) {
                     console.error(`Error getting stats for file ${entryPath}:`, statError);
                     // Skip this file if stat fails
                  }
                }
            }
      } catch (realPathError) {
          console.warn(`[Security] Skipping inaccessible path during listing: ${entryPath}`, realPathError);
          continue; // Skip if realpath fails (e.g., broken symlink)
      }
    }
    return items;
  }
  try {
    const items = listItems(uploadsPath, "");
    res.json(items);
  } catch (error) {
    console.error("Error fetching files:", error); // Log the error
    res.status(500).json({ error: "ไม่สามารถดึงรายการไฟล์ได้" });
  }
});

// route ปลอดภัยสำหรับเข้าถึงไฟล์
router.get("/file/*", async (req, res) => {
  const reqPath = req.params[0]; // everything after /file/

    // Get and validate the real path
    const validation = getValidatedRealPath(reqPath);
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const absoluteFilePath = validation.realPath;


  if (!fs.existsSync(absoluteFilePath) || !fs.lstatSync(absoluteFilePath).isFile()) {
    return res.status(404).json({ error: "ไม่พบไฟล์" });
  }
  try {
    const buffer = fs.readFileSync(absoluteFilePath);
    const fileType = await fileTypeFromBuffer(buffer);
    const mime = fileType?.mime || "application/octet-stream";

        // --- New Check: Prevent serving HTML ---
        if (mime === 'text/html') {
            console.warn(`Attempted to serve HTML file via /file/: ${reqPath}`);
            return res.status(403).json({ error: "ไม่อนุญาตให้เข้าถึงไฟล์ชนิดนี้โดยตรง" });
        }
        // --- End New Check ---

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", fs.statSync(absoluteFilePath).size);
    res.setHeader("Accept-Ranges", "bytes");

        // --- New: Add Content-Disposition for certain types ---
        const filename = path.basename(absoluteFilePath);
        if (mime === 'application/pdf' || mime === 'application/zip' || mime === 'application/x-zip-compressed') {
             res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
             // For other types (images, audio, video), allow inline display
             res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        }
        // --- End New ---


    const stream = fs.createReadStream(absoluteFilePath);
    stream.pipe(res);
  } catch (error) {
    console.error("Error serving file:", error); // Log the error
    res.status(500).json({ error: "ไม่สามารถให้บริการไฟล์ได้: " + error.message });
  }
});


// route สำหรับลบไฟล์
router.delete("/files/*", (req, res) => {
  const filePathParam = req.params[0]; // full relative path of the file within uploads
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: "กรุณาระบุรหัสผ่าน" });
  if (password !== DELETE_PASSWORD) return res.status(403).json({ error: "รหัสผ่านไม่ถูกต้อง" });

  // Get and validate the real path
  const validation = getValidatedRealPath(filePathParam);
  if (validation.error) {
      return res.status(400).json({ error: validation.error });
  }
  const absoluteFilePath = validation.realPath;


  try {
    if (fs.existsSync(absoluteFilePath) && fs.lstatSync(absoluteFilePath).isFile()) {
      fs.unlinkSync(absoluteFilePath);
      res.json({ message: `ลบไฟล์ ${filePathParam} สำเร็จ` });
    } else {
      res.status(404).json({ error: "ไม่พบไฟล์" });
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบไฟล์: " + error.message });
  }
});

// --- Create Folder ---
router.post("/folders", (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: "กรุณาระบุชื่อโฟลเดอร์" });

  // Resolve the path and validate traversal
  const resolvedPath = path.resolve(uploadsPath, folderPath);
  if (!isValidPath(resolvedPath)) {
      console.warn(`[Security] Invalid path traversal attempt detected (create folder): ${folderPath}`);
      return res.status(400).json({ error: "เส้นทางโฟลเดอร์ไม่ถูกต้อง" });
  }

  try {
    if (fs.existsSync(resolvedPath)) {
      return res.status(400).json({ error: "โฟลเดอร์นี้มีอยู่แล้ว" });
    }
    fs.mkdirSync(resolvedPath, { recursive: true });
    res.json({ message: "สร้างโฟลเดอร์สำเร็จ" });
  } catch (err) {
    console.error("Error creating folder:", err);
    res.status(500).json({ error: "ไม่สามารถสร้างโฟลเดอร์ได้: " + err.message });
  }
});

router.post("/move-file", (req, res) => {
  const { filename, fromFolder, toFolder } = req.body;
  if (!filename || typeof fromFolder !== "string" || typeof toFolder !== "string") {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
  }

  // Resolve and validate source and destination paths
  const absoluteSrc = path.resolve(uploadsPath, fromFolder, filename);
  const absoluteDestDir = path.resolve(uploadsPath, toFolder);
  const absoluteDest = path.join(absoluteDestDir, filename); // Use path.join for the final destination name

  if (!isValidPath(absoluteSrc) || !isValidPath(absoluteDestDir)) {
       console.warn(`Attempted directory traversal via POST /move-file: from=${fromFolder}, to=${toFolder}, file=${filename}`);
       return res.status(400).json({ error: "เส้นทางไฟล์หรือโฟลเดอร์ไม่ถูกต้อง" });
  }

  try {
    if (!fs.existsSync(absoluteSrc) || !fs.lstatSync(absoluteSrc).isFile()) return res.status(404).json({ error: "ไม่พบไฟล์ต้นทาง" });
    if (!fs.existsSync(absoluteDestDir) || !fs.lstatSync(absoluteDestDir).isDirectory()) {
         // Optionally create the destination directory if it doesn't exist and is valid
         // fs.mkdirSync(absoluteDestDir, { recursive: true });
         return res.status(404).json({ error: "ไม่พบโฟลเดอร์ปลายทาง" });
    }
    if (fs.existsSync(absoluteDest)) return res.status(400).json({ error: "ไฟล์ปลายทางมีอยู่แล้ว" }); // Prevent overwriting

    fs.renameSync(absoluteSrc, absoluteDest);
    res.json({ message: "ย้ายไฟล์สำเร็จ" });
  } catch (err) {
    console.error("Error moving file:", err); // Log the error
    res.status(500).json({ error: "ไม่สามารถย้ายไฟล์ได้: " + err.message });
  }
});

// --- Move Folder (rename) ---
router.post("/move-folder", (req, res) => {
  const { fromFolder, toFolder } = req.body;
  if (typeof fromFolder !== "string" || typeof toFolder !== "string") {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
  }

  // Resolve and validate source and destination paths
  const absoluteSrc = path.resolve(uploadsPath, fromFolder);
  const absoluteDest = path.resolve(uploadsPath, toFolder);

  if (!isValidPath(absoluteSrc) || !isValidPath(absoluteDest) || absoluteSrc === absoluteUploadsPath || absoluteDest === absoluteUploadsPath) {
       console.warn(`Attempted directory traversal or root move via POST /move-folder: from=${fromFolder}, to=${toFolder}`);
       return res.status(400).json({ error: "เส้นทางโฟลเดอร์ไม่ถูกต้อง หรือไม่สามารถย้ายโฟลเดอร์หลักได้" });
  }

  try {
    if (!fs.existsSync(absoluteSrc) || !fs.lstatSync(absoluteSrc).isDirectory()) return res.status(404).json({ error: "ไม่พบโฟลเดอร์ต้นทาง" });
    if (fs.existsSync(absoluteDest)) return res.status(400).json({ error: "โฟลเดอร์ปลายทางมีอยู่แล้ว" });

    fs.renameSync(absoluteSrc, absoluteDest);
    return res.json({ message: "ย้ายโฟลเดอร์สำเร็จ" });
  } catch (err) {
    console.error("Error moving folder:", err); // Log the error
    return res.status(500).json({ error: "ไม่สามารถย้ายโฟลเดอร์ได้" });
  }
});

// --- Rename File ---
router.post("/rename-file", (req, res) => {
    const { oldFilename, newFilename } = req.body;

    if (!oldFilename || !newFilename) {
        return res.status(400).json({ error: "ชื่อไฟล์ไม่ครบถ้วน" });
    }

    // --- New Check: Prevent changing file extension ---
    const oldExt = path.extname(oldFilename).toLowerCase();
    const newExt = path.extname(newFilename).toLowerCase();

    if (oldExt !== newExt) {
        console.warn(`Attempted to change file extension during rename: ${oldFilename} to ${newFilename}`);
        return res.status(400).json({ error: "ไม่สามารถเปลี่ยนนามสกุลไฟล์ได้" });
    }
    // --- End New Check ---


    // Resolve paths to absolute paths for robust validation
    const absoluteOldFilePath = path.resolve(uploadsPath, oldFilename);
    const absoluteNewFilePath = path.resolve(uploadsPath, newFilename);

    // Security check: Ensure both old and new paths are strictly within the uploads directory
    if (!isValidPath(absoluteOldFilePath) || !isValidPath(absoluteNewFilePath)) {
         console.warn(`Attempted rename traversal: oldFilename=${oldFilename}, newFilename=${newFilename}`);
         return res.status(400).json({ error: "ชื่อไฟล์ไม่ถูกต้อง" });
    }

    // Prevent renaming the root uploads directory itself
    if (absoluteOldFilePath === absoluteUploadsPath) {
         return res.status(400).json({ error: "ไม่สามารถเปลี่ยนชื่อโฟลเดอร์หลักได้" });
    }

    try {
        // Check if the old file exists and is a file
        if (!fs.existsSync(absoluteOldFilePath) || !fs.lstatSync(absoluteOldFilePath).isFile()) {
            return res.status(404).json({ error: "ไม่พบไฟล์เดิม" });
        }

        // Check if a file or folder with the new name already exists
        if (fs.existsSync(absoluteNewFilePath)) {
            return res.status(400).json({ error: "ชื่อไฟล์นี้มีอยู่แล้ว" });
        }

        // Perform the rename
        fs.renameSync(absoluteOldFilePath, absoluteNewFilePath);

        res.json({ message: "เปลี่ยนชื่อไฟล์สำเร็จ" });

    } catch (err) {
        console.error("Error renaming file:", err); // Log the error
        res.status(500).json({ error: "ไม่สามารถเปลี่ยนชื่อไฟล์ได้: " + err.message });
    }
});


module.exports = router;
