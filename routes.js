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
const DELETE_PASSWORD = "1324";

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

// ✅ อัปโหลดพร้อมเช็ก MIME จริง
router.post("/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;
  const buffer = fs.readFileSync(filePath);
  const fileType = await fileTypeFromBuffer(buffer);

  if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
    fs.unlinkSync(filePath); // ลบไฟล์ทันที
    return res.status(400).json({ error: "ไม่อนุญาตให้อัปโหลดไฟล์ชนิดนี้" });
  }

  const fileUrl = `https://cdn.lamar.in.th/file/${req.file.filename}`;
  res.json({ fileUrl });
});

// route แสดงรายการไฟล์ (กรองเฉพาะไฟล์ปลอดภัย)
router.get("/files", (req, res) => {
  function listItems(dir, rel) {
    let items = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const entryRel = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        // Add folder marker
        items.push({ name: entryRel, folder: true });
        // Recursively add folder content
        items = items.concat(listItems(entryPath, entryRel));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExt.includes(ext)) {
          const stats = fs.statSync(entryPath); // Get file stats
          items.push({
            name: entryRel.replace(/\\/g, "/"),
            url: `https://cdn.lamar.in.th/file/${entryRel.replace(/\\/g, "/")}`, //แก้ตรงนี้เป็นโมเมนของคุณ
            size: stats.size // Include file size
          });
        }
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
	const filePath = path.join(uploadsPath, reqPath);
	if (!fs.existsSync(filePath)) {
		return res.status(404).json({ error: "ไม่พบไฟล์" });
	}
	try {
		const buffer = fs.readFileSync(filePath);
		const fileType = await fileTypeFromBuffer(buffer);
		const mime = fileType?.mime || "application/octet-stream";
		res.setHeader("Content-Type", mime);
		res.setHeader("Content-Length", fs.statSync(filePath).size);
		res.setHeader("Accept-Ranges", "bytes");
		const stream = fs.createReadStream(filePath);
		stream.pipe(res);
	} catch (error) {
		console.error("Error serving file:", error); // Log the error
		res.status(500).json({ error: "ไม่สามารถให้บริการไฟล์ได้: " + error.message });
	}
});


// route สำหรับลบไฟล์
router.delete("/files/*", (req, res) => {
  const filePathParam = req.params[0]; // full relative path of the file within uploads
  const filePath = path.join(uploadsPath, filePathParam).replace(/\\/g, "/").replace(/\/+/g, "/");
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: "กรุณาระบุรหัสผ่าน" });
  if (password !== DELETE_PASSWORD) return res.status(403).json({ error: "รหัสผ่านไม่ถูกต้อง" });

  try {
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
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

  // Normalize folder path for compatibility
  const absPath = path.join(uploadsPath, folderPath.replace(/\/+/g, "/"));

  try {
    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(absPath, { recursive: true, mode: 0o755 }); // Ensure proper permissions
      return res.json({ message: "สร้างโฟลเดอร์สำเร็จ" });
    } else {
      return res.status(400).json({ error: "โฟลเดอร์นี้มีอยู่แล้ว" });
    }
  } catch (err) {
    console.error("Error creating folder:", err); // Log the error
    return res.status(500).json({ error: "ไม่สามารถสร้างโฟลเดอร์ได้: " + err.message });
  }
});

// --- Delete Folder (only if empty) ---
router.delete("/folders", (req, res) => {
  const { folderPath, password } = req.body;
  if (!folderPath) return res.status(400).json({ error: "กรุณาระบุชื่อโฟลเดอร์" });
  if (password !== DELETE_PASSWORD) return res.status(403).json({ error: "รหัสผ่านไม่ถูกต้อง" });
  const absPath = path.join(uploadsPath, folderPath);
  try {
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "ไม่พบโฟลเดอร์" });
    if (fs.readdirSync(absPath).length > 0) return res.status(400).json({ error: "โฟลเดอร์ไม่ว่าง" });
    fs.rmdirSync(absPath);
    return res.json({ message: "ลบโฟลเดอร์สำเร็จ" });
  } catch (err) {
    console.error("Error deleting folder:", err); // Log the error
    return res.status(500).json({ error: "ไม่สามารถลบโฟลเดอร์ได้" });
  }
});

// --- Move File ---
router.post("/move-file", (req, res) => {
  const { filename, fromFolder, toFolder } = req.body;
  if (!filename || typeof fromFolder !== "string" || typeof toFolder !== "string") {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
  }

  const src = path.join(uploadsPath, fromFolder.replace(/\\/g, "/").replace(/\/+/g, "/"), filename);
  const destDir = path.join(uploadsPath, toFolder.replace(/\\/g, "/").replace(/\/+/g, "/"));
  const dest = path.join(destDir, filename);

  try {
    if (!fs.existsSync(src)) return res.status(404).json({ error: "ไม่พบไฟล์" });
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(src, dest);
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
  const src = path.join(uploadsPath, fromFolder);
  const dest = path.join(uploadsPath, toFolder);
  try {
    if (!fs.existsSync(src)) return res.status(404).json({ error: "ไม่พบโฟลเดอร์" });
    if (fs.existsSync(dest)) return res.status(400).json({ error: "โฟลเดอร์ปลายทางมีอยู่แล้ว" });
    fs.renameSync(src, dest);
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

    // Resolve paths to absolute paths for robust validation
    const absoluteUploadsPath = path.resolve(uploadsPath);
    const absoluteOldFilePath = path.resolve(uploadsPath, oldFilename.replace(/\\/g, "/").replace(/\/+/g, "/"));
    const absoluteNewFilePath = path.resolve(uploadsPath, newFilename.replace(/\\/g, "/").replace(/\/+/g, "/"));

    // Security check: Ensure both old and new paths are strictly within the uploads directory
    // Use path.sep to prevent directory traversal attacks like ../
    const uploadsPathWithSep = absoluteUploadsPath + path.sep;
    if (!absoluteOldFilePath.startsWith(uploadsPathWithSep) && absoluteOldFilePath !== absoluteUploadsPath) {
         console.warn(`Attempted rename outside uploads: oldFilename=${oldFilename}, resolved=${absoluteOldFilePath}`);
         return res.status(400).json({ error: "ชื่อไฟล์เดิมไม่ถูกต้อง" });
    }
     if (!absoluteNewFilePath.startsWith(uploadsPathWithSep) && absoluteNewFilePath !== absoluteUploadsPath) {
         console.warn(`Attempted rename outside uploads: newFilename=${newFilename}, resolved=${absoluteNewFilePath}`);
         return res.status(400).json({ error: "ชื่อไฟล์ใหม่ไม่ถูกต้อง" });
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
