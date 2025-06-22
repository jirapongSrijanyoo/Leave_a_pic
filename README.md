# Leave_a_pic
ฝากรูปและแสดงลิงค์
รองรับไฟล์ PNG, JPEG, JPG, GIF, WEBP, MP4, MP3, ZIP, PDF

# วิธีนำโค้ดไปใช้
## โคลน repo นี้
```
git clone https://github.com/jirapongSrijanyoo/Leave_a_pic.git
```
เข้าไดเรทเทอรี
```
cd Leave_a_pic
```
สร้างโฟลเดอร์ uploads
```
md dir uploads
```
ติดตั้งแพ็กเกจโดยใช้ [NPM](https://www.npmjs.com/)
```
npm install
```
แก้ไข routes.js บรรทัด 55 และ 78 เป็นชื่อเว็บของคุณ
```
const fileUrl = `http://example.com/file/${req.file.filename}`;
```
```
url: `http://example.com/file/${entryRel.replace(/\\/g, "/")}`,
```
เริ่มรันโปรเจกต์
```
node index.js
```
## คุณสามารถลองใช้ DEMO ได้ที่
https://demo.lamar.in.th/
demo ปิดให้ทดสอบวันที่ 30/06/2025
