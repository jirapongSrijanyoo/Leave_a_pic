const express = require('express');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = 3000;

// กำหนดให้ Express serve ไฟล์จากโฟลเดอร์ uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ใช้ static files สำหรับ public
app.use(express.static(path.join(__dirname, 'public')));

// ใช้ routes
app.use(routes);

// รันเซิร์ฟเวอร์
app.listen(PORT, () => {
    console.log(`Server running on http://localhost/${PORT}`);
});
