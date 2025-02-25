const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// ตั้งค่าที่เก็บไฟล์
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Route อัปโหลดไฟล์
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `http://localhost/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// Route สำหรับดึงข้อมูลไฟล์ทั้งหมดในโฟลเดอร์ uploads
router.get("/files", (req, res) => {
  const files = fs.readdirSync("uploads");
  const fileDetails = files.map(file => {
    return {
      name: file,
      url: `http://localhost/uploads/${file}`
    };
  });
  res.json(fileDetails);
});

module.exports = router;
