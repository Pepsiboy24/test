import { openUploadModal } from '../../../assets/js-shared/upload_modal_ui.js';
import { waitForUser } from '/core/perf.js';

document.addEventListener('DOMContentLoaded', function () {
    const uploadBtns = document.querySelectorAll('.add-multiple');
    
    uploadBtns.forEach(btn => {
        // If it's inside a button, attach to parent, else attach to itself
        const target = btn.closest('button') || btn;
        target.addEventListener('click', function (e) {
            e.preventDefault();
            openSubjectsExcelUpload();
        });
        
        if (!btn.closest('button')) {
            target.style.cursor = 'pointer';
        }
    });
});

const HINT_HTML = `
<strong style="color:#93c5fd;">Required:</strong>
<code style="color:#a5f3fc;">Subject Name</code>,
<code style="color:#a5f3fc;">Type</code> (Core / Elective)
<br>
<span style="color:#64748b;">
  Each row creates one subject. Duplicate subject names in the database will be skipped automatically.
</span>`;

const COLUMNS = [
    { key: 'Subject Name', label: 'Subject Name', required: true },
    { key: 'Type', label: 'Type', required: true },
];

function downloadTemplate() {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    const ws = XLSX.utils.aoa_to_sheet([
        ['Subject Name', 'Type'],
        ['Mathematics', 'Core'],
        ['Further Math', 'Elective'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
    XLSX.writeFile(wb, 'subjects_template.xlsx');
}

async function processFile(file, helpers) {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!raw.length) { showToast('File is empty.', 'warning'); return; }

    const rows = raw.map((r, i) => {
        const errors = [];
        const name = (r['Subject Name'] || r['subject name'] || r['Name'] || r['name'] || r['Subject_Name'] || '').toString().trim();
        const type = (r['Type'] || r['type'] || r['Subject Type'] || r['subject type'] || r['Subject_Type'] || '').toString().trim();
        
        if (!name) errors.push('Missing Subject Name');
        if (!type) errors.push('Missing Type (Core/Elective)');
        if (type && !['core', 'elective'].includes(type.toLowerCase())) errors.push('Type must be Core or Elective');
        
        return { ...r, 'Subject Name': name, 'Type': type, __index: i, __errors: errors };
    });

    helpers._rows = rows;
    helpers._file = file;
    helpers.showPreview(rows, COLUMNS);
    const valid = rows.filter(r => !r.__errors.length).length;
    helpers.setUploadEnabled(valid > 0);
    if (valid === 0) showToast('No valid rows found.', 'warning');
    else showToast(`${valid} subject${valid !== 1 ? 's' : ''} ready to upload.`, 'success', 3500);
}

async function doUpload(file, helpers) {
    const validRows = (helpers._rows || []).filter(r => !r.__errors.length);
    const validCount = validRows.length;
    if (validCount === 0) return;

    // Use standard window.confirm if showConfirm is not available globally
    const showConfirmFn = window.showConfirm || window.confirm;
    const confirmed = await window.showConfirm(
        `Upload ${validCount} subject${validCount !== 1 ? 's' : ''}?`,
        'Confirm Bulk Upload'
    );
    if (!confirmed) return;

    helpers.startProgress(validCount);

    try {
        // 1. Process Excel Data (Clean & Remove internal duplicates)
        const excelSubjectsMap = new Map();

        validRows.forEach(row => {
            const name = row['Subject Name'];
            const type = row['Type'];

            const cleanName = name;
            const cleanKey = cleanName.toLowerCase();

            // Only add if we haven't seen this name in the file yet
            if (!excelSubjectsMap.has(cleanKey)) {
                excelSubjectsMap.set(cleanKey, {
                    subject_name: cleanName,
                    is_core: type.toLowerCase() === 'core'
                });
            }
        });

        // Get school_id from Auth Metadata (Required for RLS)
        const user = await waitForUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('School context not found. Please log in again.');
        }

        // 2. Fetch ALL Existing Subjects from Database for this school
        helpers.tickProgress(0, validCount, "Checking for existing duplicate subjects...");
        const { data: existingDbSubjects, error: fetchError } = await window.supabase
            .from('Subjects')
            .select('subject_name')
            .eq('school_id', schoolId);

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
                // Inject school_id
                subjectObj.school_id = schoolId;
                newSubjectsToInsert.push(subjectObj);
            }
        }

        // 4. Handle Insert
        if (newSubjectsToInsert.length === 0) {
            helpers.finishProgress(`<div style="color:#fcd34d;">All ${excelSubjectsMap.size} subjects in the file already exist in the database.</div>`);
            helpers.showFooterDone();
            showToast(`All ${excelSubjectsMap.size} subjects in the file already exist.`, "info");
            return;
        }

        helpers.tickProgress(Math.floor(validCount / 2), validCount, `Inserting ${newSubjectsToInsert.length} non-duplicate subjects...`);
        
        const { error } = await window.supabase
            .from('Subjects')
            .insert(newSubjectsToInsert);

        if (error) {
            throw error;
        }

        let message = `${newSubjectsToInsert.length} new subjects added!`;
        if (duplicatesCount > 0) {
            message += `<br>(${duplicatesCount} duplicates were skipped)`;
        }
        
        helpers.finishProgress(`<div style="color:#22c55e;">${message}</div>`);
        helpers.showFooterDone();
        
        showToast(`${newSubjectsToInsert.length} new subjects added!`, 'success');
        
        // Allow a moment for the toast then reload the page to show latest subjects
        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (e) {
        console.error('Upload Error:', e);
        helpers.finishProgress(`<div style="color:#fca5a5;">Upload error: ${e.message}</div>`);
        helpers.showFooterDone();
        showToast('Upload error: ' + e.message, 'error');
    }
}

function openSubjectsExcelUpload() {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded. Refresh and try again.', 'error'); return; }
    openUploadModal({
        title: 'Bulk Upload Subjects',
        icon: 'fa-book-open',
        accept: '.xlsx,.xls',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Upload Subjects',
        onFile: processFile,
        onConfirm: doUpload,
    });
}

