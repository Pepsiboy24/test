document.addEventListener('DOMContentLoaded', function () {
    // Locate the upload button in your UI
    const uploadBtn = document.querySelector('.action-card .action-icon.add-multiple')?.parentElement;

    if (uploadBtn) {
        uploadBtn.addEventListener('click', function () {
            createUploadModal();
        });
    }

    // --- Modal Creation Logic ---
    function createUploadModal() {
        // Remove existing modal if any
        const existingModal = document.querySelector('.upload-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'upload-modal';
        modal.innerHTML = `
            <div class="upload-modal-content">
                <div class="upload-modal-header">
                    <h2>Upload Subjects Excel Sheet</h2>
                    <button class="close-modal" onclick="closeUploadModal()">&times;</button>
                </div>
                <div class="upload-modal-body">
                    <p>Please upload an Excel file with columns: <strong>Subject Name, Type</strong> (Core/Elective)</p>
                    <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="display: none;">
                    <div id="dragDropArea">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 48px; color: #6200ea; margin-bottom: 16px;"></i>
                        <h3>Drag & Drop or Click to Upload</h3>
                        <p>Supported formats: .xlsx, .xls</p>
                    </div>
                    <button id="uploadBtn" class="btn btn-primary" style="display: none;">Upload Subjects</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        injectStyles(); // Helper to add CSS

        // Event Listeners for Drag/Drop
        const dragDropArea = document.getElementById('dragDropArea');
        const fileInput = document.getElementById('excelFileInput');
        const uploadBtnAction = document.getElementById('uploadBtn');

        dragDropArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileUpload(file);
        });

        dragDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragDropArea.style.borderColor = '#6200ea';
            dragDropArea.style.backgroundColor = '#ede7f6';
        });

        dragDropArea.addEventListener('dragleave', () => {
            dragDropArea.style.borderColor = '#e2e8f0';
            dragDropArea.style.backgroundColor = '#f8fafc';
        });

        dragDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDropArea.style.borderColor = '#e2e8f0';
            dragDropArea.style.backgroundColor = '#f8fafc';
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload(file);
        });

        uploadBtnAction.addEventListener('click', async () => {
            const file = fileInput.files[0] || (e.dataTransfer ? e.dataTransfer.files[0] : null);
            // Re-grab file from input just to be safe
            if (fileInput.files[0]) {
                await processExcelFile(fileInput.files[0]);
            }
        });
    }

    // --- UI Update on File Select ---
    function handleFileUpload(file) {
        const uploadBtn = document.getElementById('uploadBtn');
        const dragDropArea = document.getElementById('dragDropArea');

        dragDropArea.innerHTML = `
            <i class="fa-solid fa-file-excel" style="font-size: 48px; color: #217346; margin-bottom: 16px;"></i>
            <h3>${file.name}</h3>
            <p>File selected. Click Upload to proceed.</p>
        `;
        uploadBtn.style.display = 'block';
    }

    // --- CORE LOGIC: Process File & Check Duplicates ---
    async function processExcelFile(file) {
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.textContent = "Processing...";
        uploadBtn.disabled = true;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // 1. Process Excel Data (Clean & Remove internal duplicates)
            const excelSubjectsMap = new Map();

            jsonData.forEach(row => {
                const name = row['Subject Name'] || row['subject name'] || row['Name'] || row['name'];
                const type = row['Type'] || row['type'] || row['Subject Type'] || row['subject type'];

                if (name && type) {
                    const cleanName = name.trim();
                    const cleanKey = cleanName.toLowerCase();

                    // Only add if we haven't seen this name in the file yet
                    if (!excelSubjectsMap.has(cleanKey)) {
                        excelSubjectsMap.set(cleanKey, {
                            subject_name: cleanName,
                            is_core: type.toLowerCase() === 'core'
                        });
                    }
                }
            });

            if (excelSubjectsMap.size === 0) {
                showToast('No valid subjects found in file. Please check column names.', 'warning');
                uploadBtn.textContent = "Upload Subjects";
                uploadBtn.disabled = false;
                return;
            }

            // 2. Fetch ALL Existing Subjects from Database
            const { data: existingDbSubjects, error: fetchError } = await window.supabase
                .from('Subjects')
                .select('subject_name');

            if (fetchError) throw fetchError;

            // Create a Set of existing names for fast lookup
            const existingNamesSet = new Set(existingDbSubjects.map(s => s.subject_name.toLowerCase()));

            // 3. Filter: Keep only items NOT in the database
            const newSubjectsToInsert = [];
            let duplicatesCount = 0;

            for (const [key, subjectObj] of excelSubjectsMap) {
                if (existingNamesSet.has(key)) {
                    duplicatesCount++;
                } else {
                    newSubjectsToInsert.push(subjectObj);
                }
            }

            // 4. Handle Insert
            if (newSubjectsToInsert.length === 0) {
                showToast(`All ${excelSubjectsMap.size} subjects in the file already exist in the database.`, "info");
                closeUploadModal();
                return;
            }

            const { data: insertedData, error } = await window.supabase
                .from('Subjects')
                .insert(newSubjectsToInsert);

            if (error) {
                console.error('Error inserting subjects:', error);
                showToast('Failed to upload subjects. Please check the Excel file format.', 'error');
            } else {
                console.log('Subjects uploaded successfully:', insertedData);

                let message = `${newSubjectsToInsert.length} new subjects added!`;
                if (duplicatesCount > 0) {
                    message += `\n(${duplicatesCount} duplicates were skipped)`;
                }
                showToast(message, 'info');
                closeUploadModal();
            }

        } catch (err) {
            console.error('Error processing Excel file:', err);
            showToast('Error processing the file. Ensure it is a valid Excel file.', 'error');
        } finally {
            // Reset button state if modal is still open
            const btn = document.getElementById('uploadBtn');
            if (btn) {
                btn.textContent = "Upload Subjects";
                btn.disabled = false;
            }
        }
    }

    // --- Helper: Inject CSS ---
    function injectStyles() {
        if (document.getElementById('upload-modal-styles')) return;
        const style = document.createElement('style');
        style.id = 'upload-modal-styles';
        style.textContent = `
            .upload-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 10001; backdrop-filter: blur(4px); }
            .upload-modal-content { background: white; padding: 32px; border-radius: 16px; max-width: 500px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
            .upload-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
            .close-modal { background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; }
            #dragDropArea { border: 2px dashed #e2e8f0; border-radius: 12px; padding: 40px; text-align: center; margin: 20px 0; background: #f8fafc; cursor: pointer; transition: all 0.2s; }
            .btn-primary { background-color: #6200ea; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; width: 100%; font-size: 16px; }
            .btn-primary:disabled { background-color: #a5a5a5; cursor: not-allowed; }
        `;
        document.head.appendChild(style);
    }

    // Expose close function globally
    window.closeUploadModal = function () {
        const modal = document.querySelector('.upload-modal');
        if (modal) modal.remove();
    };
});