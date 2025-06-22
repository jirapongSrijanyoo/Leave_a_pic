const express = require('express');
const path = require('path');
const mainRouter = require('./routes'); // Import the new main router

const app = express();
const PORT = 5500;

// Middleware อ่าน JSON body
app.use(express.json());

// Static files (เฉพาะ /public เท่านั้น)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use(mainRouter); // Use the new main router

// Log server errors
app.use((err, req, res, next) => {
  console.error("Server error:", err); // Log the error
  res.status(500).json({ error: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" });
});

// Run server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:5500`);
});
