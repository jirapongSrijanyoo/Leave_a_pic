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
        const allowedTypes = [
            "image/png", "image/jpeg", "image/jpg", "image/webp",
            "video/mp4",
            "audio/mp3", "audio/wav"
        ];

        if (!allowedTypes.includes(fileType)) {
            showPopup("ไฟล์ที่เลือกไม่รองรับ! กรุณาอัปโหลดเฉพาะ PNG, JPEG, JPG, WEBP, MP4, MP3, WAV เท่านั้น", "error");
            fileInput.value = ""; // ล้างค่า input
            selectedFile = null;
            return;
        }

        // แสดงตัวอย่างไฟล์ที่รองรับ
        if (fileType.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.style.display = "block";
                preview.src = e.target.result;
                preview.style.maxWidth = "90%";
                preview.style.maxHeight = "90vh";
                preview.style.objectFit = "contain";
            };
            reader.readAsDataURL(selectedFile);
        } else if (fileType.startsWith("video/")) {
            const reader = new FileReader();
            reader.onload = function (e) {
                videoPreview.style.display = "block";
                videoPreview.src = e.target.result;
                videoPreview.style.maxWidth = "90%";
                videoPreview.style.maxHeight = "90vh";
                videoPreview.style.objectFit = "contain";
            };
            reader.readAsDataURL(selectedFile);
        } else if (fileType.startsWith("audio/")) {
            const reader = new FileReader();
            reader.onload = function (e) {
                audioPreview.style.display = "block";
                audioPreview.src = e.target.result;
                audioPreview.style.maxWidth = "90%";
            };
            reader.readAsDataURL(selectedFile);
        }

        // ซ่อนปุ่มเลือกไฟล์และแสดงปุ่มอัปโหลด
        label.style.display = "none";
        uploadBtn.style.display = "inline-block";
        cancelBtn.style.display = "inline-block";
    }
}

function uploadFile() {
    if (!selectedFile) {
        showPopup("กรุณาเลือกไฟล์ก่อนอัปโหลด", "error");
        return;
    }

    const progressBar = document.getElementById("progressBar");
    const link = document.getElementById("link");
    const copyBtn = document.getElementById("copyBtn");

    const formData = new FormData();
    formData.append("file", selectedFile);

    // เริ่มการแสดงโปรเกรสบาร์
    progressBar.style.display = "block";
    progressBar.value = 0; // เริ่มต้นโปรเกรสบาร์ที่ 0

    // ใช้ XMLHttpRequest เพื่อติดตาม progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload", true);

    xhr.upload.onprogress = function (event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.value = percentComplete;
        }
    };

    xhr.onload = function () {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);

            // แสดงลิงก์ดาวน์โหลด
            link.innerHTML = `<a href="${response.fileUrl}" target="_blank">${response.fileUrl}</a>`;
            copyBtn.style.display = "inline-block";

            // แสดง popup แจ้งเตือน
            showPopup("อัปโหลดสำเร็จ!", "success");
        } else {
            showPopup("เกิดข้อผิดพลาดในการอัปโหลด", "error");
        }
    };

    xhr.onerror = function () {
        showPopup("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
    };

    xhr.send(formData);
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
    const link = document.getElementById("link");
    const copyBtn = document.getElementById("copyBtn");

    // ซ่อนพรีวิวไฟล์ทั้งหมด
    preview.style.display = "none";
    preview.src = ""; 
    videoPreview.style.display = "none";
    videoPreview.src = "";
    audioPreview.style.display = "none";
    audioPreview.src = "";

    // ซ่อนปุ่มอัปโหลดและยกเลิก
    uploadBtn.style.display = "none";
    cancelBtn.style.display = "none";

    // แสดงปุ่มเลือกไฟล์ใหม่
    label.style.display = "block";

    // รีเซ็ตค่า input file
    fileInput.value = "";

    // รีเซ็ต progress bar
    progressBar.style.display = "none";
    progressBar.value = 0;

    // ซ่อนลิงก์ดาวน์โหลด
    link.innerHTML = "";
    copyBtn.style.display = "none";

    // เคลียร์ตัวแปร selectedFile
    selectedFile = null;

    // แสดง popup แจ้งเตือน
    showPopup("ยกเลิกการอัปโหลดเรียบร้อย", "info");
}

function copyLink() {
    const linkElement = document.getElementById("link").querySelector("a");

    if (!linkElement) {
        showPopup("ไม่มีลิงก์ให้คัดลอก", "error");
        return;
    }

    navigator.clipboard.writeText(linkElement.href)
        .then(() => {
            showPopup("คัดลอกลิงก์เรียบร้อย!", "success");
        })
        .catch(() => {
            showPopup("ไม่สามารถคัดลอกลิงก์ได้", "error");
        });
}

// ฟังก์ชันแสดง Popup แจ้งเตือน
function showPopup(message, type = "info") {
    const popup = document.createElement("div");
    popup.textContent = message;
    popup.style.position = "fixed";
    popup.style.top = "20px";
    popup.style.right = "20px";
    popup.style.padding = "10px 20px";
    popup.style.borderRadius = "5px";
    popup.style.fontSize = "1rem";
    popup.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    popup.style.zIndex = "9999";
    popup.style.color = "#fff";

    // กำหนดสีพื้นหลังตามประเภทของ popup
    if (type === "error") {
        popup.style.backgroundColor = "#dc3545"; // สีแดง (error)
    } else if (type === "success") {
        popup.style.backgroundColor = "#28a745"; // สีเขียว (success)
    } else {
        popup.style.backgroundColor = "#007bff"; // สีน้ำเงิน (info)
    }

    document.body.appendChild(popup);

    // ลบ Popup หลังจาก 3 วินาที
    setTimeout(() => {
        popup.style.transition = "opacity 0.5s ease";
        popup.style.opacity = 0;
        setTimeout(() => popup.remove(), 500); // ลบ popup ออกจาก DOM
    }, 3000);
}
