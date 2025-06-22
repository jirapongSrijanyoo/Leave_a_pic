// --- State ---
const apiUrl = '/files';
let currentMediaList = [];
let currentFolder = "/";
let folderTree = {};
let viewMode = "grid";
let isFiltering = false;
let filteredResults = null;
let sidebarCollapsed = false; // Keep track of sidebar state

// --- DOM Elements ---
const gallery = document.getElementById('gallery');
const contextMenu = document.getElementById('contextMenu');
const modalBg = document.getElementById('modalBg'); // Get modal background

// --- Theme Toggle ---
        function toggleTheme() {
            const body = document.body;
            body.classList.toggle('dark-mode');
            const isDarkMode = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            updateThemeButton(isDarkMode);
        }

        function applyThemePreference() {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            let isDarkMode = false;
            if (savedTheme === 'dark') {
                isDarkMode = true;
            } else if (savedTheme === 'light') {
                isDarkMode = false;
            } else if (prefersDark) {
                isDarkMode = true; // Default to system preference if no saved theme
            }

            if (isDarkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            updateThemeButton(isDarkMode);
        }

        function updateThemeButton(isDarkMode) {
            const themeToggleBtn = document.getElementById('themeToggleBtn');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = isDarkMode ?
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>' : // Sun icon
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'; // Moon icon
            }
        }


        // --- Mobile Navigation ---
        function initMobileNavigation() {
            const sidebar = document.getElementById('sidebar');
            const sidebarToggle = document.getElementById('sidebarToggle');
            const mobileOverlay = document.getElementById('mobileOverlay');

            function toggleSidebar() {
                sidebar.classList.toggle('show');
                mobileOverlay.classList.toggle('show');
            }

            function closeSidebar() {
                sidebar.classList.remove('show');
                mobileOverlay.classList.remove('show');
            }

            // Toggle sidebar on button click
            if (sidebarToggle) {
                sidebarToggle.addEventListener('click', toggleSidebar);
            }

            // Close sidebar when clicking overlay
            if (mobileOverlay) {
                mobileOverlay.addEventListener('click', closeSidebar);
            }


            // Close sidebar when clicking on main content on mobile
            document.addEventListener('click', (e) => {
                // Check if the click is outside the sidebar and the toggle button
                const isClickInsideSidebar = sidebar && sidebar.contains(e.target);
                const isClickInsideToggle = sidebarToggle && sidebarToggle.contains(e.target);

                if (window.innerWidth <= 768 && !isClickInsideSidebar && !isClickInsideToggle) {
                    closeSidebar();
                }
            });
        }

        // --- Toast ---
        function showToast(message, type = 'success', duration = 3000) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = `toast ${type} show`;
            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }

        // --- Modal ---
        function showModal(html) {
            document.getElementById('modalContent').innerHTML = html;
            document.getElementById('modalBg').style.display = 'flex';

            // Focus first input if available
            setTimeout(() => {
                const firstInput = document.querySelector('#modalBg input');
                if (firstInput) firstInput.focus();
            }, 100);
        }

        function hideModal() {
            document.getElementById('modalBg').style.display = 'none';
        }

        // --- Folder Tree ---
        function buildFolderTree(items) {
            const tree = {};
            items.forEach(item => {
                const parts = item.name.split("/");
                let node = tree;
                if (item.folder) {
                    parts.forEach(part => {
                        if (!node[part]) node[part] = {};
                        node = node[part];
                    });
                } else {
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!node[parts[i]]) node[parts[i]] = {};
                        node = node[parts[i]];
                    }
                    if (!node._files) node._files = [];
                    node._files.push(item);
                }
            });
            return tree;
        }

        function getFilesInFolder(tree, folderPath) {
            if (folderPath === "/") {
                let files = [];
                for (const key in tree) {
                    if (key === "_files") files = files.concat(tree[key]);
                }
                return files;
            }
            const parts = folderPath.split("/").filter(Boolean);
            let node = tree;
            for (const part of parts) {
                if (!node[part]) return [];
                node = node[part];
            }
            let files = [];
            if (node._files) files = files.concat(node._files);
            return files;
        }

        function getSubfolders(tree, folderPath) {
            const parts = folderPath.split("/").filter(Boolean);
            let node = tree;
            for (const part of parts) {
                if (!node[part]) return [];
                node = node[part];
            }
            return Object.keys(node).filter(k => k !== "_files");
        }

        // --- Sidebar Folders ---
        function renderSidebarFolders() {
            const sidebar = document.getElementById('sidebarFolders');
            if (!sidebar) return;

            sidebar.innerHTML = "";

            // Add "My Drive" root folder option
            const rootFolderDiv = document.createElement('div');
            rootFolderDiv.className = 'folder' + (currentFolder === "/" ? " active" : "");
            rootFolderDiv.style.paddingLeft = "1rem";
            rootFolderDiv.innerHTML = `
                <span class="icon">🏠</span>
                <span>My Drive</span>
            `;
            rootFolderDiv.onclick = () => {
                currentFolder = "/";
                updateMediaDisplay();
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('show');
                    document.getElementById('mobileOverlay').classList.remove('show');
                }
            };
            sidebar.appendChild(rootFolderDiv);


            function walk(node, path, depth) {
                const sortedKeys = Object.keys(node).filter(k => k !== "_files").sort();

                sortedKeys.forEach(key => {
                    const folderDiv = document.createElement('div');
                    const folderPath = (path + "/" + key).replace(/\/+/g, "/");
                    folderDiv.className = 'folder' + (currentFolder === folderPath ? " active" : "");
                    folderDiv.style.paddingLeft = ((depth + 1) * 1) + "rem";
                    folderDiv.innerHTML = `
                        <span class="icon">📁</span>
                        <span>${key}</span>
                        <span class="folder-actions">
                            <button title="Rename" onclick="event.stopPropagation();showRenameFolderDialog('${folderPath}')">✏️</button>
                            <button title="Delete" onclick="event.stopPropagation();deleteFolder('${folderPath}')">🗑️</button>
                        </span>
                    `;
                    folderDiv.onclick = () => {
                        currentFolder = folderPath;
                        updateMediaDisplay();
                        if (window.innerWidth <= 768) {
                            document.getElementById('sidebar').classList.remove('show');
                            document.getElementById('mobileOverlay').classList.remove('show');
                        }
                    };
                    sidebar.appendChild(folderDiv);
                    walk(node[key], folderPath, depth + 1);
                });
            }
            walk(folderTree, "", 0);
        }

        // --- Path Bar ---
        function renderPathBar() {
            const pathBar = document.getElementById('pathBar');
            pathBar.innerHTML = "";

            const rootSpan = document.createElement("span");
            rootSpan.className = "folder-path";
            rootSpan.textContent = "Home";
            addFolderDropHandler(rootSpan, "");
            rootSpan.onclick = () => { currentFolder = "/"; updateMediaDisplay(); };
            pathBar.appendChild(rootSpan);

            const parts = currentFolder.split("/").filter(Boolean);
            let path = "";

            if (parts.length === 0) return;

            parts.forEach((part, idx) => {
                pathBar.appendChild(document.createTextNode(" / "));
                path += "/" + part;
                const span = document.createElement("span");
                span.className = "folder-path";
                span.textContent = part;
                if (idx === parts.length - 1) {
                    span.style.textDecoration = "none";
                    span.style.color = "var(--text)";
                    span.style.cursor = "default";
                    span.style.fontWeight = "500";
                } else {
                    span.onclick = () => { currentFolder = path; updateMediaDisplay(); };
                }
                pathBar.appendChild(span);
            });
        }

        // --- View Mode ---
        function setViewMode(mode) {
            viewMode = 'grid'; // Always force grid
            gallery.className = `gallery grid-view`;
        }

        // --- Fetch Media ---
        async function fetchMedia() {
            gallery.classList.add('loading');

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error("HTTP error");
                let data = await response.json();

                data = data.slice().sort((a, b) => {
                    const getTimestamp = fname => {
                        const num = parseInt(fname.name.split('.')[0], 10);
                        return isNaN(num) ? 0 : num;
                    };
                    return getTimestamp(b) - getTimestamp(a);
                });

                folderTree = buildFolderTree(data);
                currentMediaList = data;
                updateMediaDisplay();
                renderSidebarFolders();
            } catch (e) {
                showToast("โหลดข้อมูลล้มเหลว", "error");
            } finally {
                gallery.classList.remove('loading');
            }
        }

        // --- Gallery Display ---
        function updateMediaDisplay() {
            renderPathBar();
            renderSidebarFolders();

            gallery.className = `gallery ${viewMode}-view`;
            gallery.innerHTML = "";

            let itemsToDisplay;
            if (isFiltering && filteredResults) {
                itemsToDisplay = filteredResults;
            } else {
                // Combine folders and files for the current view
                const subfolders = getSubfolders(folderTree, currentFolder).map(name => ({ name: (currentFolder === "/" ? "" : currentFolder) + "/" + name, folder: true }));
                const filesInFolder = getFilesInFolder(folderTree, currentFolder);
                itemsToDisplay = [...subfolders, ...filesInFolder];
            }


            if (itemsToDisplay.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'folder-empty';
                emptyDiv.style.gridColumn = "1 / -1";
                emptyDiv.innerHTML = `
                    <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">ไม่พบไฟล์หรือโฟลเดอร์</div>
                    <div style="color: var(--text-muted);">โฟลเดอร์นี้ว่างเปล่า</div>
                `;
                gallery.appendChild(emptyDiv);
                return;
            }

            itemsToDisplay.forEach(item => {
                const mediaItem = document.createElement('div');
                mediaItem.className = `media-item ${viewMode}-view`;
                // Store item data on the element for context menu
                mediaItem._itemData = item;

                if (item.folder) {
                     // --- Folder Display ---
                    mediaItem.style.cursor = "pointer";
                    mediaItem.innerHTML = `
                        <div class="media-preview" style="justify-content:center; background: linear-gradient(135deg, #fbbf24, #f59e0b);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-3l5 0 2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div class="media-info">
                            <div class="media-name" style="color: var(--warning); font-weight: 600;">${item.name.split("/").pop()}</div>
                        </div>
                        <!-- Actions removed from HTML -->
                    `;
                     mediaItem.onclick = () => {
                        currentFolder = item.name;
                        updateMediaDisplay();
                    };
                     // Add drag and drop for moving folders (drop target)
                    addFolderDropHandler(mediaItem, item.name);

                } else {
                    // --- File Display ---
                    mediaItem.style.cursor = "pointer"; // Still clickable for context menu
                    const previewContainer = document.createElement('div');
                    previewContainer.className = `media-preview ${viewMode}-view`;
                    previewContainer.style.background = "#181a20";

                    const fileType = item.name.split('.').pop().toLowerCase();
                    let previewElement;

                    const allowedTypes = {
                        images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
                        videos: ['mp4', 'webm', 'mov'],
                        audios: ['mp3', 'wav', 'ogg'],
                        pdfs: ['pdf'],
                        zips: ['zip', 'rar', '7z']
                    };

                    if (!item.url) {
                        previewElement = document.createElement('div');
                        previewElement.innerHTML = '❌';
                        previewElement.style.fontSize = '2rem';
                        previewElement.style.color = 'var(--danger)';
                    } else if (allowedTypes.images.includes(fileType)) {
                        previewElement = document.createElement('img');
                        previewElement.src = item.url;
                        previewElement.alt = item.name;
                        previewElement.loading = "lazy";
                        previewElement.style.width = "100%";
                        previewElement.style.height = "100%";
                        previewElement.style.objectFit = "contain";
                        previewElement.style.background = "#181a20";
                    } else if (allowedTypes.videos.includes(fileType)) {
                        previewElement = document.createElement('video');
                        previewElement.src = item.url;
                        previewElement.controls = false; // No controls in preview
                        previewElement.muted = true;
                        previewElement.preload = "metadata";
                        previewElement.style.width = "100%";
                        previewElement.style.height = "100%";
                        previewElement.style.objectFit = "contain";
                        previewElement.style.background = "#181a20";
                    } else if (allowedTypes.audios.includes(fileType)) {
                        previewElement = document.createElement('div');
                        previewElement.style.display = "flex";
                        previewElement.style.flexDirection = "column";
                        previewElement.style.alignItems = "center";
                        previewElement.style.justifyContent = "center";
                        previewElement.style.height = "100%";
                        previewElement.style.width = "100%";
                        previewElement.innerHTML = `
                            <span style="font-size:2.5rem; color:#38bdf8;">🎵</span>
                            <!-- Audio controls will be in context menu or open action -->
                        `;
                    } else if (allowedTypes.pdfs.includes(fileType)) {
                        previewElement = document.createElement('div');
                        previewElement.innerHTML = '📄';
                        previewElement.style.fontSize = '2rem';
                        previewElement.style.color = 'var(--danger)';
                    } else if (allowedTypes.zips.includes(fileType)) {
                        previewElement = document.createElement('div');
                        previewElement.innerHTML = '📦';
                        previewElement.style.fontSize = '2rem';
                        previewElement.style.color = 'var(--warning)';
                    } else {
                        previewElement = document.createElement('div');
                        previewElement.innerHTML = '📁';
                        previewElement.style.fontSize = '2rem';
                        previewElement.style.color = 'var(--text-muted)';
                    }

                    previewContainer.appendChild(previewElement);

                    const infoDiv = document.createElement('div');
                    infoDiv.className = `media-info ${viewMode}-view`;

                    if (viewMode === "list") {
                        let pathParts = item.name.split("/");
                        let fileName = pathParts.pop();
                        let folderPath = pathParts.length ? pathParts.join("/") + "/" : "";
                        let extIdx = fileName.lastIndexOf(".");
                        let baseName = extIdx !== -1 ? fileName.substring(0, extIdx) : fileName;
                        let ext = extIdx !== -1 ? fileName.substring(extIdx) : "";

                        infoDiv.innerHTML = `
                            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                                <span style="color:var(--text-muted);font-size:0.92em;">${folderPath}</span>
                                <span style="font-weight:600;color:var(--text);">${baseName}</span>
                                <span style="color:var(--text-muted);font-size:0.92em;">${ext}</span>
                            </div>
                            <div class="media-size" style="margin-top:2px;">${formatFileSize(item.size || 0)}</div>
                        `;
                    } else {
                        infoDiv.innerHTML = `
                            <div class="media-name">${item.name.split("/").pop()}</div> <!-- Show only filename in grid view -->
                            <div class="media-size">${formatFileSize(item.size || 0)}</div>
                        `;
                    }

                    mediaItem.appendChild(previewContainer);
                    mediaItem.appendChild(infoDiv);

                    // Add drag source handler for files
                    addDragAndDropHandlers(mediaItem, item);
                }


                gallery.appendChild(mediaItem);
            });
        }

        // --- Helper Functions ---
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // --- Folder CRUD ---
        function showCreateFolderDialog() {
            showModal(`
                <h3>สร้างโฟลเดอร์ใหม่</h3>
                <input id="newFolderName" type="text" placeholder="ชื่อโฟลเดอร์">
                <div class="modal-actions">
                    <button onclick="hideModal()">ยกเลิก</button>
                    <button onclick="createFolder()">สร้าง</button>
                </div>
            `);
        }

        async function createFolder() {
            const name = document.getElementById('newFolderName').value.trim();
            if (!name) return showToast('กรุณากรอกชื่อโฟลเดอร์', 'error');

            let folderPath = currentFolder === "/" ? name : `${currentFolder}/${name}`.replace(/\/+/g, "/");

            try {
                const res = await fetch('/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderPath })
                });
                const data = await res.json();

                if (res.ok) {
                    showToast('สร้างโฟลเดอร์สำเร็จ', 'success');
                    hideModal();
                    fetchMedia();
                } else {
                    showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
                }
            } catch {
                showToast('เกิดข้อผิดพลาด', 'error');
            }
        }

        function showRenameFolderDialog(folderPath) {
            const parts = folderPath.split("/");
            const oldName = parts.pop();
            const parentPath = parts.join("/");

            showModal(`
                <h3>เปลี่ยนชื่อโฟลเดอร์</h3>
                <input id="renameFolderName" type="text" value="${oldName}">
                <div class="modal-actions">
                    <button onclick="hideModal()">ยกเลิก</button>
                    <button onclick="renameFolder('${folderPath}', '${parentPath}')">เปลี่ยนชื่อ</button>
                </div>
            `);
        }

        async function renameFolder(oldPath, parentPath) {
            const newName = document.getElementById('renameFolderName').value.trim();
            if (!newName) return showToast('กรุณากรอกชื่อใหม่', 'error');

            const fromFolder = oldPath.replace(/^\//, "");
            const toFolder = (parentPath + "/" + newName).replace(/^\//, "");

            try {
                const res = await fetch('/move-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fromFolder, toFolder })
                });
                const data = await res.json();

                if (res.ok) {
                    showToast('เปลี่ยนชื่อโฟลเดอร์สำเร็จ', 'success');
                    hideModal();
                    fetchMedia();
                } else {
                    showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
                }
            } catch {
                showToast('เกิดข้อผิดพลาด', 'error');
            }
        }

        async function deleteFolder(folderPath) {
            const password = prompt('กรุณาใส่รหัสผ่านเพื่อยืนยันการลบโฟลเดอร์:');
            if (!password) return;

            try {
                const res = await fetch('/folders', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderPath: folderPath.replace(/^\//, ""), password })
                });
                const data = await res.json();

                if (res.ok) {
                    showToast('ลบโฟลเดอร์สำเร็จ', 'success');
                    fetchMedia();
                } else {
                    showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
                }
            } catch {
                showToast('เกิดข้อผิดพลาด', 'error');
            }
        }

        // --- File Rename ---
        function showRenameFileDialog(oldFilename) {
             const filenameOnly = oldFilename.split("/").pop();

            showModal(`
                <h3>เปลี่ยนชื่อไฟล์</h3>
                <input id="newFileName" type="text" value="${filenameOnly}">
                <div class="modal-actions">
                    <button onclick="hideModal()">ยกเลิก</button>
                    <button onclick="renameFile('${oldFilename}')">เปลี่ยนชื่อ</button>
                </div>
            `);
        }

        async function renameFile(oldFilename) {
            const newFileNameOnly = document.getElementById('newFileName').value.trim();
            if (!newFileNameOnly) {
                showToast('กรุณากรอกชื่อใหม่', 'error');
                return;
            }

            const oldPathParts = oldFilename.split("/");
            oldPathParts.pop();
            const directoryPath = oldPathParts.join("/");
            const newFilename = directoryPath ? `${directoryPath}/${newFileNameOnly}` : newFileNameOnly;

            if (oldFilename === newFilename) {
                 showToast('ชื่อใหม่เหมือนชื่อเดิม', 'error');
                 hideModal();
                 return;
            }

            try {
                const res = await fetch('/rename-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldFilename, newFilename })
                });
                const data = await res.json();

                if (res.ok) {
                    showToast('เปลี่ยนชื่อไฟล์สำเร็จ', 'success');
                    hideModal();
                    fetchMedia();
                } else {
                    showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
                }
            } catch {
                showToast('เกิดข้อผิดพลาด', 'error');
            }
        }


        // --- Move File ---
        async function moveFile(filename, fromFolder, toFolder) {
            try {
                const res = await fetch('/move-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename,
                        fromFolder: fromFolder.replace(/\\/g, "/").replace(/\/+/g, "/"),
                        toFolder: toFolder.replace(/\\/g, "/").replace(/\/+/g, "/")
                    })
                });
                const data = await res.json();

                if (res.ok) {
                    showToast('ย้ายไฟล์สำเร็จ', 'success');
                    fetchMedia();
                } else {
                    showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
                }
            } catch {
                showToast('เกิดข้อผิดพลาด', 'error');
            }
        }

        // --- Search/Filter ---
        function searchFiles() {
            const searchInput = document.getElementById('searchInput').value.trim().toLowerCase();
            if (!searchInput) {
                showToast('Please enter a valid search term', 'error');
                return;
            }

            isFiltering = true;
            filteredResults = currentMediaList.filter(media => {
                const fileName = media.name.toLowerCase();
                return fileName.includes(searchInput);
            });
            updateMediaDisplay();
        }

        function resetGallery() {
            document.getElementById('searchInput').value = '';
            isFiltering = false;
            filteredResults = null;
            updateMediaDisplay();
        }

        // --- Add Enter key support for search ---
        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        searchFiles();
                    }
                });
            }
        });

        // --- Navigation ---
        function goToRoot() {
            currentFolder = "/";
            updateMediaDisplay();
        }

        // --- Drag and Drop ---
        function addDragAndDropHandlers(mediaItem, file) {
            mediaItem.setAttribute('draggable', true);
            mediaItem.addEventListener('dragstart', e => {
                e.dataTransfer.setData("text/plain", JSON.stringify({
                    filename: file.name.split("/").pop(),
                    fromFolder: currentFolder
                }));
                mediaItem.style.opacity = '0.5';
            });

            mediaItem.addEventListener('dragend', e => {
                mediaItem.style.opacity = '';
            });
        }

        // --- Drop handler for sidebar and path bar (unchanged) ---
        function addFolderDropHandler(folderDiv, folderPath) {
            folderDiv.addEventListener('dragover', e => {
                e.preventDefault();
                folderDiv.style.borderColor = 'var(--primary)';
                folderDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            });

            folderDiv.addEventListener('dragleave', e => {
                folderDiv.style.borderColor = '';
                folderDiv.style.backgroundColor = '';
            });

            folderDiv.addEventListener('drop', e => {
                e.preventDefault();
                folderDiv.style.borderColor = '';
                folderDiv.style.backgroundColor = '';

                try {
                    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                    if (data && data.filename != null) {
                        moveFile(data.filename, data.fromFolder, folderPath.replace(/^\//, ""));
                    }
                } catch (err) {
                    // ignore
                }
            });
        }

        // --- Context Menu ---
        function hideContextMenu() {
            contextMenu.style.display = 'none';
        }

        function showContextMenu(x, y, item) {
            contextMenu.innerHTML = ''; // Clear previous menu items

            // Add menu items based on item type (file or folder)
            if (item.folder) {
                 // Folder actions
                 addContextMenuItem('Rename', () => showRenameFolderDialog(item.name));
                 addContextMenuItem('Delete', () => deleteFolder(item.name), 'danger');
            } else {
                // File actions
                addContextMenuItem('Open', () => window.open(item.url, '_blank'));
                addContextMenuItem('Copy Link', () => {
                     navigator.clipboard.writeText(item.url)
                        .then(() => showToast('คัดลอกลิงก์เรียบร้อย', 'success'))
                        .catch(() => showToast('เกิดข้อผิดพลาดในการคัดลอก', 'error'));
                });
                addContextMenuItem('Rename', () => showRenameFileDialog(item.name));
                addContextMenuItem('Move to...', () => showMoveFileDialog(item)); // Show move modal
                addContextMenuItem('Delete', () => deleteFile(item.name), 'danger');
            }


            // Position the menu
            contextMenu.style.top = `${y}px`;
            contextMenu.style.left = `${x}px`;
            contextMenu.style.display = 'block';

            // Ensure menu doesn't go off-screen
            const menuWidth = contextMenu.offsetWidth;
            const menuHeight = contextMenu.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (x + menuWidth > viewportWidth) {
                contextMenu.style.left = `${x - menuWidth}px`;
            }
             if (y + menuHeight > viewportHeight) {
                contextMenu.style.top = `${y - menuHeight}px`;
            }
        }

        function addContextMenuItem(text, action, className = '') {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'context-menu-item' + (className ? ` ${className}` : '');
            itemDiv.textContent = text;
            itemDiv.onclick = () => {
                action();
                hideContextMenu(); // Hide menu after action
            };
            contextMenu.appendChild(itemDiv);
        }

        // Function to show the move file modal
        function showMoveFileDialog(file) {
             // Re-use the folder selection logic from the old move select
             const moveSelectHtml = `<select id="moveFileSelect" class="move-select"><option value="">Select folder...</option></select>`;

             showModal(`
                <h3>ย้ายไฟล์ "${file.name.split("/").pop()}"</h3>
                ${moveSelectHtml}
                <div class="modal-actions">
                    <button onclick="hideModal()">ยกเลิก</button>
                    <button id="confirmMoveBtn" disabled>ย้าย</button>
                </div>
            `);

            const moveSelect = document.getElementById('moveFileSelect');
            const confirmMoveBtn = document.getElementById('confirmMoveBtn');

            // Populate the select with folders
            function walkFoldersForMove(node, path) {
                for (const key in node) {
                    if (key === "_files") continue;
                    const folderPath = (path + "/" + key).replace(/\/+/g, "/");
                    // Prevent moving to the file's current folder
                    let fileDir = file.name.split("/").slice(0, -1).join("/");
                    if (fileDir === "") fileDir = "/"; // Root folder case
                    if (folderPath !== fileDir) {
                         moveSelect.innerHTML += `<option value="${folderPath}">${folderPath === "/" ? "My Drive" : folderPath}</option>`;
                    }
                    walkFoldersForMove(node[key], folderPath);
                }
            }
            walkFoldersForMove(folderTree, "");


            moveSelect.addEventListener('change', () => {
                 confirmMoveBtn.disabled = !moveSelect.value;
            });

            confirmMoveBtn.addEventListener('click', () => {
                 if (moveSelect.value) {
                    let fromFolder = file.name.split("/").slice(0, -1).join("/");
                    if (fromFolder === "") fromFolder = "/";
                    moveFile(file.name.split("/").pop(), fromFolder, moveSelect.value);
                    hideModal();
                 }
            });
        }


        // --- Keyboard Shortcuts ---
        document.addEventListener('keydown', (e) => {
            // ESC to close modal or sidebar or context menu
            if (e.key === 'Escape') {
                hideModal();
                hideContextMenu(); // Hide context menu
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('show');
                    document.getElementById('mobileOverlay').classList.remove('show');
                }
            }

            // Ctrl/Cmd + F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
        });

        // --- Init ---
        document.addEventListener('DOMContentLoaded', () => {
            applyThemePreference();
            initMobileNavigation();
            fetchMedia();

            // Close modal when clicking outside
            if (modalBg) {
                 modalBg.onclick = function(e) {
                    if (e.target === this) hideModal();
                };
            }

            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    const sidebar = document.getElementById('sidebar');
                    const mobileOverlay = document.getElementById('mobileOverlay');
                    if (sidebar) sidebar.classList.remove('show');
                    if (mobileOverlay) mobileOverlay.classList.remove('show');
                }
                 hideContextMenu(); // Hide context menu on resize
            });

            // Add event listener for theme toggle button
            const themeToggleBtn = document.getElementById('themeToggleBtn');
            if (themeToggleBtn) {
                themeToggleBtn.addEventListener('click', toggleTheme);
            }

            // --- Context Menu Event Listener ---
            gallery.addEventListener('contextmenu', (e) => {
                const mediaItem = e.target.closest('.media-item');
                if (mediaItem && mediaItem._itemData) {
                    e.preventDefault(); // Prevent default browser context menu
                    showContextMenu(e.clientX, e.clientY, mediaItem._itemData);
                } else {
                    // If not clicking on a media item, hide the custom menu
                    hideContextMenu();
                }
            });

            // Hide context menu on left click anywhere on the document
            document.addEventListener('click', (e) => {
                 // Check if the click is inside the context menu itself
                 const isClickInsideMenu = contextMenu.contains(e.target);
                 if (!isClickInsideMenu) {
                    hideContextMenu();
                 }
            });

             // Hide context menu on scroll
            document.addEventListener('scroll', hideContextMenu, true); // Use capture phase
        });
