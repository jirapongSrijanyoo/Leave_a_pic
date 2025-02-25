let selectedFile = null;

function previewFile() {
    const fileInput = document.getElementById("fileInput");
    const preview = document.getElementById("preview");
    const videoPreview = document.getElementById("videoPreview");
    const audioPreview = document.getElementById("audioPreview");
    const uploadBtn = document.getElementById("uploadBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const label = document.querySelector("label");

    selectedFile = fileInput.files[0];
    if (selectedFile) {
        // ซ่อนพรีวิวทั้งหมดก่อน
        preview.style.display = "none";
        videoPreview.style.display = "none";
        audioPreview.style.display = "none";

        // ตรวจสอบประเภทของไฟล์
        const fileType = selectedFile.type;
        if (fileType.startsWith("image/")) {
            // ถ้าเป็นไฟล์ภาพ
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.style.display = "block";
                preview.src = e.target.result;
                preview.style.maxWidth = "80%"; // ขยายกรอบให้ใหญ่ขึ้น
                preview.style.maxHeight = "80vh"; // ขยายขนาดสูงสุดตามหน้าจอ
                preview.style.objectFit = "contain"; // ทำให้ภาพขยายตามกรอบ
            };
            reader.readAsDataURL(selectedFile);
        } else if (fileType.startsWith("video/")) {
            // ถ้าเป็นไฟล์วิดีโอ
            const reader = new FileReader();
            reader.onload = function (e) {
                videoPreview.style.display = "block";
                videoPreview.src = e.target.result;
                videoPreview.style.maxWidth = "80%"; // ขยายกรอบให้ใหญ่ขึ้น
                videoPreview.style.maxHeight = "80vh"; // ขยายขนาดสูงสุดตามหน้าจอ
                videoPreview.style.objectFit = "contain"; // ทำให้วิดีโอขยายตามกรอบ
            };
            reader.readAsDataURL(selectedFile);
        } else if (fileType.startsWith("audio/")) {
            // ถ้าเป็นไฟล์เสียง
            const reader = new FileReader();
            reader.onload = function (e) {
                audioPreview.style.display = "block";
                audioPreview.src = e.target.result;
                audioPreview.style.maxWidth = "80%"; // ขยายกรอบให้ใหญ่ขึ้น
                audioPreview.style.objectFit = "contain"; // ทำให้ไฟล์เสียงขยายตามกรอบ
            };
            reader.readAsDataURL(selectedFile);
        }

        // ซ่อนปุ่มเลือกไฟล์และแสดงปุ่มอัปโหลด
        label.style.display = "none"; // ซ่อนปุ่มเลือกไฟล์
        uploadBtn.style.display = "inline-block";
        cancelBtn.style.display = "inline-block";
    }
}

function uploadFile() {
    if (!selectedFile) return;

    const progressBar = document.getElementById("progressBar");
    const link = document.getElementById("link");
    const copyBtn = document.getElementById("copyBtn");

    const formData = new FormData();
    formData.append("file", selectedFile);

    // เริ่มการแสดงโปรเกรสบาร์
    progressBar.style.display = "block";
    progressBar.value = 0; // เริ่มต้นโปรเกรสบาร์ที่ 0

    // สร้างฟังก์ชันจำลองการอัปโหลด
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        progressBar.value = progress; // อัปเดตโปรเกรสบาร์
        if (progress >= 100) {
            clearInterval(interval); // หยุดโปรเกรสบาร์เมื่อถึง 100%
        }
    }, 200); // จำลองการอัปโหลดไฟล์ทุกๆ 200ms

    // ส่งไฟล์ไปยังเซิร์ฟเวอร์
    fetch("/upload", {
        method: "POST",
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        // แสดงลิงก์หลังการอัปโหลดสำเร็จ
        const fileLink = data.fileUrl;
        link.innerHTML = `<a href="${fileLink}" target="_blank">${fileLink}</a>`;
        copyBtn.style.display = "inline-block"; // แสดงปุ่มคัดลอกลิงก์
    })
    .catch(err => {
        console.error("Error uploading file:", err);
    });
}

function cancelUpload() {
    const preview = document.getElementById("preview");
    const videoPreview = document.getElementById("videoPreview");
    const audioPreview = document.getElementById("audioPreview");
    const uploadBtn = document.getElementById("uploadBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const fileInput = document.getElementById("fileInput");
    const label = document.querySelector("label");
    const progressBar = document.getElementById("progressBar");

    preview.style.display = "none";
    videoPreview.style.display = "none";
    audioPreview.style.display = "none";
    uploadBtn.style.display = "none";
    cancelBtn.style.display = "none";
    label.style.display = "block"; // แสดงปุ่มเลือกไฟล์อีกครั้ง
    fileInput.value = ''; // ล้างค่าของ input
    progressBar.style.display = "none"; // ซ่อนโปรเกรสบาร์
}

function copyLink() {
    const link = document.getElementById("link").querySelector('a');
    navigator.clipboard.writeText(link.href)
        .then(() => {
            // สร้างป็อปอัพข้อความ
            const popup = document.createElement("div");
            popup.textContent = "คัดลอกลิงก์เรียบร้อย!";
            popup.style.position = "fixed";
            popup.style.top = "20px";
            popup.style.right = "20px";
            popup.style.backgroundColor = "#28a745";
            popup.style.color = "#fff";
            popup.style.padding = "10px 20px";
            popup.style.borderRadius = "5px";
            popup.style.fontSize = "1rem";
            popup.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
            popup.style.zIndex = "9999";
            document.body.appendChild(popup);

            // ลบป็อปอัพหลังจาก 3 วินาที
            setTimeout(() => {
                popup.style.transition = "opacity 0.5s ease";
                popup.style.opacity = 0;
                setTimeout(() => popup.remove(), 500); // ลบป็อปอัพหลังจากการหายไป
            }, 3000);
        })
        .catch(err => console.error("คัดลอกไม่สำเร็จ:", err));
}
