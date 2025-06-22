let selectedFiles = [];
let uploadXHRs = [];
let uploadedLinks = [];

const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const cancelBtn = document.getElementById('cancelBtn');
const previewList = document.getElementById('previewList');
const link = document.getElementById('link');
const copyBtn = document.getElementById('copyBtn');

const allowedTypes = [
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
    "video/mp4",
    "audio/mp3", "audio/mpeg", "audio/wav",
    "application/pdf", "application/zip", "application/x-zip-compressed"
];

dropArea.addEventListener('dragover', e => {
    e.preventDefault();
    dropArea.classList.add('dragover');
});
dropArea.addEventListener('dragleave', e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
});
dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});
dropArea.addEventListener('click', (e) => {
    if (e.target !== fileInput) {
        fileInput.value = "";
        fileInput.click();
    }
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function handleFiles(files) {
    let arr = Array.from(files).filter(file => allowedTypes.includes(file.type));
    if (arr.length === 0) {
        showPopup("ไม่รองรับไฟล์ที่เลือก", "error");
        resetPreview();
        return;
    }
    if (arr.length > 5) {
        showPopup("เลือกได้สูงสุด 5 ไฟล์ต่อครั้ง", "error");
        arr = arr.slice(0, 5);
    }
    selectedFiles = arr;
    renderPreviewList();
    uploadBtn.disabled = selectedFiles.length === 0;
    link.innerHTML = "";
    copyBtn.style.display = "none";
}

function renderPreviewList() {
    previewList.innerHTML = "";
    selectedFiles.forEach((file, idx) => {
        const box = document.createElement('div');
        box.className = 'preview-box';

        let thumb;
        if (file.type.startsWith("image/")) {
            thumb = document.createElement('img');
            thumb.className = 'preview-img';
            const reader = new FileReader();
            reader.onload = e => thumb.src = e.target.result;
            reader.readAsDataURL(file);
            thumb.style.display = "block";
        } else if (file.type.startsWith("video/")) {
            thumb = document.createElement('video');
            thumb.className = 'preview-video';
            thumb.controls = false;
            const reader = new FileReader();
            reader.onload = e => thumb.src = e.target.result;
            reader.readAsDataURL(file);
            thumb.style.display = "block";
        } else if (file.type.startsWith("audio/")) {
            thumb = document.createElement('audio');
            thumb.className = 'preview-audio';
            thumb.controls = false;
            const reader = new FileReader();
            reader.onload = e => thumb.src = e.target.result;
            reader.readAsDataURL(file);
            thumb.style.display = "block";
        } else if (file.type === "application/pdf") {
            thumb = document.createElement('img');
            thumb.className = 'preview-icon';
            thumb.src = "https://img.icons8.com/ios-filled/50/6200ea/pdf.png";
            thumb.style.display = "block";
        } else if (file.type === "application/zip" || file.type === "application/x-zip-compressed") {
            thumb = document.createElement('img');
            thumb.className = 'preview-icon';
            thumb.src = "https://img.icons8.com/ios-filled/50/6200ea/zip.png";
            thumb.style.display = "block";
        } else {
            thumb = document.createElement('img');
            thumb.className = 'preview-icon';
            thumb.src = "https://img.icons8.com/ios-filled/50/6200ea/file.png";
            thumb.style.display = "block";
        }
        box.appendChild(thumb);

        const info = document.createElement('div');
        info.className = 'preview-info';
        const name = document.createElement('div');
        name.className = 'preview-name';
        name.textContent = file.name;
        const size = document.createElement('div');
        size.className = 'preview-size';
        size.textContent = formatSize(file.size);
        info.appendChild(name);
        info.appendChild(size);
        box.appendChild(info);

        // Per-file progress bar (moved to bottom, full width)
        const progBar = document.createElement('div');
        progBar.className = 'progress-bar';
        progBar.style.display = 'none';
        progBar.style.position = 'absolute';
        progBar.style.left = '0';
        progBar.style.right = '0';
        progBar.style.bottom = '0';
        progBar.style.width = '100%';
        progBar.style.margin = '0';
        progBar.style.borderRadius = '0 0 10px 10px';
        progBar.style.background = '#23263a';
        progBar.style.height = '8px';
        progBar.style.overflow = 'hidden';

        const progInner = document.createElement('div');
        progInner.className = 'progress-bar-inner';
        progBar.appendChild(progInner);

        // Attach progress bar DOM refs for later update
        file._progBar = progBar;
        file._progInner = progInner;

        // Wrap preview-box content in a relative container for absolute progress bar
        const contentWrap = document.createElement('div');
        contentWrap.style.position = 'relative';
        contentWrap.style.width = '100%';
        contentWrap.style.display = 'flex';
        contentWrap.style.alignItems = 'center';
        contentWrap.style.gap = '14px';
        contentWrap.appendChild(thumb);
        contentWrap.appendChild(info);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'ลบไฟล์นี้';
        removeBtn.onclick = () => {
            selectedFiles.splice(idx, 1);
            renderPreviewList();
            uploadBtn.disabled = selectedFiles.length === 0;
        };
        contentWrap.appendChild(removeBtn);

        box.style.position = 'relative';
        box.appendChild(contentWrap);
        box.appendChild(progBar);

        previewList.appendChild(box);
    });
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1024/1024).toFixed(2) + ' MB';
}

function resetPreview() {
    selectedFiles = [];
    renderPreviewList();
    uploadBtn.disabled = true;
    link.innerHTML = "";
    copyBtn.style.display = "none";
}

function uploadFiles() {
    if (selectedFiles.length === 0) {
        showPopup("กรุณาเลือกไฟล์ก่อนอัปโหลด", "error");
        return;
    }
    uploadBtn.disabled = true;
    cancelBtn.style.display = "inline-block";
    link.innerHTML = "";
    copyBtn.style.display = "none";
    uploadedLinks = [];
    uploadXHRs = [];

    selectedFiles.forEach((file, idx) => {
        // Show per-file progress bar
        if (file._progBar) {
            file._progBar.style.display = "block";
            file._progInner.style.width = "0";
        }

        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        uploadXHRs.push(xhr);
        xhr.open("POST", "/upload", true);

        xhr.upload.onprogress = function (event) {
            if (event.lengthComputable && file._progInner) {
                const percent = (event.loaded / event.total) * 100;
                file._progInner.style.width = percent + "%";
            }
        };
        xhr.onload = function () {
            if (xhr.status === 200) {
                if (file._progBar) file._progBar.remove(); // Remove progress bar after upload
                const response = JSON.parse(xhr.responseText);
                uploadedLinks.push(response.fileUrl);
                if (uploadedLinks.length === selectedFiles.length) {
                    showLinks();
                    showPopup("อัปโหลดสำเร็จ!", "success");
                    cancelBtn.style.display = "none";
                }
            } else if (xhr.status === 429) {
                showPopup("อัปโหลดเกินกำหนดเวลา! (สูงสุด 5 ไฟล์/นาที)", "error");
                cancelUpload();
            } else {
                try {
                    const parsed = JSON.parse(xhr.responseText);
                    showPopup(`เกิดข้อผิดพลาด: ${parsed.error || xhr.responseText}`, "error");
                } catch {
                    showPopup(`เกิดข้อผิดพลาด: ${xhr.responseText}`, "error");
                }
                cancelUpload();
            }
        };
        xhr.onerror = function () {
            showPopup("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
            cancelUpload();
        };
        xhr.send(formData);
    });
}

function showLinks() {
    link.innerHTML = uploadedLinks.map(url =>
        `<a href="${url}" target="_blank">${url}</a>`
    ).join('<br>');
    copyBtn.style.display = "inline-block";
    cancelBtn.style.display = "none";
    // Do NOT resetPreview() here, so previews and links remain visible after upload
}

function cancelUpload() {
    uploadXHRs.forEach(xhr => { try { xhr.abort(); } catch {} });
    uploadXHRs = [];
    link.innerHTML = "";
    copyBtn.style.display = "none";
    cancelBtn.style.display = "none";
    uploadBtn.disabled = selectedFiles.length === 0;
    showPopup("ยกเลิกการอัปโหลดเรียบร้อย", "info");
}

function copyLink() {
    if (!uploadedLinks.length) {
        showPopup("ไม่มีลิงก์ให้คัดลอก", "error");
        return;
    }
    navigator.clipboard.writeText(uploadedLinks.join('\n'))
        .then(() => showPopup("คัดลอกลิงก์เรียบร้อย!", "success"))
        .catch(() => showPopup("ไม่สามารถคัดลอกลิงก์ได้", "error"));
}

function showPopup(message, type = "info") {
    const popup = document.createElement("div");
    popup.className = "popup" + (type === "error" ? " error" : "");
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.classList.add("fade-out");
        setTimeout(() => popup.remove(), 500);
    }, 2000);
}
