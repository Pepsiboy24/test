/**
 * classes_excel_upload.js
 * Bulk CSV upload for the Classes page.
 *
 * Required columns: class_name, section
 * Optional: teacher_name, students_count
 */
import { openUploadModal } from '../../../scripts/upload_modal_ui.js';
import { supabase as supabaseClient } from '../../config.js';

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

function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.trim());
        const row = { __index: i };
        headers.forEach((h, hi) => row[h] = vals[hi] ?? '');
        const errors = [];
        if (!row.class_name) errors.push('Missing class_name');
        if (!row.section) errors.push('Missing section');
        row.__errors = errors;
        return row;
    });
}

function parseXLSX(data) {
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return raw.map((r, i) => {
        const row = { __index: i };
        for (const k of Object.keys(r)) {
            row[k.toLowerCase().trim().replace(/\s+/g, '_')] = r[k];
        }
        const errors = [];
        if (!row.class_name) errors.push('Missing class_name');
        if (!row.section) errors.push('Missing section');
        row.__errors = errors;
        return row;
    });
}

function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['class_name', 'section', 'teacher_name', 'students_count'],
        ['Primary 1', 'A', 'Mr. John Doe', '30'],
        ['JSS 1', 'B', '', '25'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Classes');
    XLSX.writeFile(wb, 'classes_template.xlsx');
}

async function processFile(file, helpers) {
    const ext = file.name.split('.').pop().toLowerCase();
    let rows;
    if (ext === 'csv') {
        rows = parseCSV(await file.text());
    } else {
        rows = parseXLSX(await file.arrayBuffer());
    }
    if (!rows.length) { showToast('File is empty.', 'warning'); return; }
    helpers.showPreview(rows, COLUMNS);
    const valid = rows.filter(r => !r.__errors.length).length;
    helpers.setUploadEnabled(valid > 0);
    if (valid === 0) showToast('No valid rows found. Fix errors and re-upload.', 'warning');
    else showToast(`${valid} class${valid !== 1 ? 'es' : ''} ready to upload.`, 'success', 3500);
    helpers._rows = rows;
}

async function doUpload(file, helpers) {
    const validRows = (helpers._rows || []).filter(r => !r.__errors.length);
    if (!validRows.length) return;
    const confirmed = await window.showConfirm(
        `Upload ${validRows.length} class${validRows.length !== 1 ? 'es' : ''}?`,
        'Confirm Upload'
    );
    if (!confirmed) return;

    helpers.startProgress(validRows.length);
    let succeeded = 0, failed = 0;
    const errors = [];

    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        helpers.tickProgress(i, validRows.length, `Uploading ${i + 1} of ${validRows.length}: ${row.class_name} ${row.section}`);
        try {
            const { error } = await supabaseClient.from('Classes').insert([{
                class_name: row.class_name,
                section: row.section,
                students_count: row.students_count ? Number(row.students_count) : null,
            }]);
            if (error) throw new Error(error.message);
            succeeded++;
        } catch (e) {
            failed++;
            errors.push(`Row ${row.__index + 1}: ${e.message}`);
        }
    }

    helpers.finishProgress(errors.map(e => `<div style="color:#fca5a5;margin-top:4px;">⚠ ${e}</div>`).join(''));
    helpers.showFooterDone();

    if (succeeded > 0 && failed === 0) showToast(`✅ ${succeeded} class${succeeded !== 1 ? 'es' : ''} uploaded!`, 'success', 6000);
    else if (succeeded > 0) showToast(`Uploaded ${succeeded}, ${failed} failed. Check details.`, 'warning', 7000);
    else showToast('Upload failed. Check details.', 'error');

    if (typeof window.reloadClasses === 'function') window.reloadClasses();
}

window.openClassesExcelUpload = function () {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded. Refresh and try again.', 'error'); return; }
    openUploadModal({
        title: 'Bulk Upload Classes',
        icon: 'fa-chalkboard',
        accept: '.xlsx,.xls,.csv',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Upload Classes',
        onFile: processFile,
        onConfirm: doUpload,
    });
};
