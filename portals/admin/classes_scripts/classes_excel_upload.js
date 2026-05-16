import { openUploadModal } from '../../../assets/js-shared/upload_modal_ui.js';
import { supabase } from '../../../core/config.js';
import { waitForUser, lazyScript } from '/core/perf.js';

const HINT_HTML = `
<strong style="color:#93c5fd;">Required columns:</strong>
<code style="color:#a5f3fc;">class_name</code>,
<code style="color:#a5f3fc;">section</code>
&nbsp;·&nbsp;
<strong style="color:#93c5fd;">Optional:</strong>
<code style="color:#a5f3fc;">teacher_name</code>,
<code style="color:#a5f3fc;">students_count</code>
<br>
<span style="color:#64748b;">One row per class. The section value should be a letter or number (e.g. "A", "1").
If a Teacher name is provided it must already exist in the Teachers table.</span>`;

const COLUMNS = [
    { key: 'class_name', label: 'Class Name', required: true },
    { key: 'section', label: 'Section', required: true },
    { key: 'teacher_name', label: 'Teacher Name' },
    { key: 'students_count', label: 'Students Count' },
];

// ── Template download ─────────────────────────────────────────────────────
async function downloadTemplate() {
    await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
    const ws = XLSX.utils.aoa_to_sheet([
        ['class_name', 'section', 'teacher_name', 'students_count'],
        ['JSS 1', 'A', 'Mr James', '30'],
        ['JSS 2', 'B', 'Mrs Adaeze', '28'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Classes');
    XLSX.writeFile(wb, 'classes_template.xlsx');
}

// ── Parse & preview the chosen file ──────────────────────────────────────
async function processFile(file, helpers) {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!raw.length) { showToast('File is empty.', 'warning'); return; }

    const rows = raw.map((r, i) => {
        const errors = [];
        const className = (r['class_name'] || r['Class Name'] || r['ClassName'] || '').toString().trim();
        const section = (r['section'] || r['Section'] || '').toString().trim();

        if (!className) errors.push('Missing class_name');
        if (!section) errors.push('Missing section');

        return {
            class_name: className,
            section: section,
            teacher_name: (r['teacher_name'] || r['Teacher Name'] || '').toString().trim(),
            students_count: (r['students_count'] || r['Students Count'] || 0),
            __index: i,
            __errors: errors,
        };
    });

    helpers._rows = rows;
    helpers.showPreview(rows, COLUMNS);

    const valid = rows.filter(r => !r.__errors.length).length;
    helpers.setUploadEnabled(valid > 0);

    if (valid === 0) showToast('No valid rows found.', 'warning');
    else showToast(`${valid} class${valid !== 1 ? 'es' : ''} ready to upload.`, 'success', 3500);
}

// ── Upload valid rows to Supabase ─────────────────────────────────────────
async function doUpload(file, helpers) {
    const validRows = (helpers._rows || []).filter(r => !r.__errors.length);
    if (!validRows.length) return;

    const confirmed = await window.showConfirm(
        `Upload ${validRows.length} class${validRows.length !== 1 ? 'es' : ''}?`,
        'Confirm Upload'
    );
    if (!confirmed) return;

    const user = await waitForUser();
    const schoolId = user?.user_metadata?.school_id;

    if (!schoolId) {
        showToast('Error: School ID not found in session.', 'error');
        return;
    }

    helpers.startProgress(validRows.length);
    let succeeded = 0, failed = 0;
    const errors = [];

    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        helpers.tickProgress(i, validRows.length, `Uploading: ${row.class_name} (${row.section})`);

        try {
            let teacherId = null;

            // Resolve Teacher Name to ID
            if (row.teacher_name) {
                // This search is flexible: it checks if the name matches first_name OR last_name
                // For optimal results, use "First Last" in your Excel
                const { data: teacherData } = await supabase
                    .from('Teachers')
                    .select('teacher_id')
                    .or(`first_name.ilike.%${row.teacher_name}%,last_name.ilike.%${row.teacher_name}%`)
                    .eq('school_id', schoolId)
                    .limit(1)
                    .single();

                if (teacherData) {
                    teacherId = teacherData.teacher_id;
                }
            }

            const { error } = await supabase.from('Classes').insert([{
                class_name: row.class_name,
                section: row.section,
                school_id: schoolId,
                teacher_id: teacherId, // Now we are actually saving the teacher!
                created_at: new Date().toISOString(),
            }]);

            if (error) throw new Error(error.message);
            succeeded++;
        } catch (e) {
            // ... error handling
        }
    }

    helpers.finishProgress(errors.map(e => `<div style="color:#fca5a5;margin-top:4px;">⚠ ${e}</div>`).join(''));
    helpers.showFooterDone();

    if (succeeded > 0 && failed === 0) showToast(`✅ ${succeeded} classes uploaded!`, 'success');
    else if (succeeded > 0) showToast(`Uploaded ${succeeded}, ${failed} failed.`, 'warning');
    else showToast('All uploads failed. Check details.', 'error');

    if (typeof window.reloadClasses === 'function') window.reloadClasses();
}

// ── Public entry-point ────────────────────────────────────────────────────
window.openClassesExcelUpload = function () {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    openUploadModal({
        title: 'Bulk Upload Classes',
        icon: 'fa-file-excel',
        accept: '.xlsx,.xls,.csv',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Upload Classes',
        onFile: processFile,
        onConfirm: doUpload,
    });
};

// ── Wire the button ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const bulkBtn = document.getElementById('bulkUploadBtn');
    if (bulkBtn) {
        bulkBtn.addEventListener('click', () => {
            window.openClassesExcelUpload();
        });
    }
});