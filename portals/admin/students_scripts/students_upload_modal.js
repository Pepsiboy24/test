/**
 * students_upload_modal.js
 * Bulk Excel upload for the Students page.
 * Wraps the existing uploadAndProcessExcel() from multipleStudentReg.js
 * in the new shared dark-themed modal UI.
 *
 * Required columns: Full Name, Email
 * Optional: Date of Birth, Gender, Admission Date, Classes,
 *           Parent Name, Parent Email, Parent Phone, Relationship
 */
// import { openUploadModal } from '../../../scripts/upload_modal_ui.js';
import { openUploadModal } from '../../../assets/js-shared/upload_modal_ui.js';
import { uploadAndProcessExcel } from './multipleStudentReg.js';
import { lazyScript } from '/core/perf.js';

const HINT_HTML = `
<strong style="color:#93c5fd;">Required:</strong>
<code style="color:#a5f3fc;">Full Name</code>,
<code style="color:#a5f3fc;">Email</code>
&nbsp;·&nbsp;
<strong style="color:#93c5fd;">Optional:</strong>
<code style="color:#a5f3fc;">Date of Birth</code>,
<code style="color:#a5f3fc;">Gender</code>,
<code style="color:#a5f3fc;">Admission Date</code>,
<code style="color:#a5f3fc;">Classes</code>,
<code style="color:#a5f3fc;">Parent Name</code>,
<code style="color:#a5f3fc;">Parent Email</code>,
<code style="color:#a5f3fc;">Parent Phone</code>,
<code style="color:#a5f3fc;">Relationship</code>
<br>
<span style="color:#64748b;">
  Each row creates one student account + auth user (default password: <code style="color:#fcd34d;">123456</code>).
  If Parent Email is provided, a parent account is linked automatically.
  Rows with duplicate emails are skipped.
</span>`;

const COLUMNS = [
    { key: 'Full Name', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
    { key: 'Gender', label: 'Gender' },
    { key: 'Classes', label: 'Class' },
    { key: 'Parent Name', label: 'Parent Name' },
];

async function downloadTemplate() {
    await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
    const ws = XLSX.utils.aoa_to_sheet([
        ['Full Name', 'Email', 'Date of Birth', 'Gender', 'Admission Date', 'Classes', 'Parent Name', 'Parent Email', 'Parent Phone', 'Relationship'],
        ['Jane Doe', 'jane@school.edu', '2010-05-14', 'Female', '2024-09-01', 'Primary 3 A', 'Mary Doe', 'mary@mail.com', '+2348012345678', 'Mother'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students_template.xlsx');
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
        const fullName = (r['Full Name'] || r['full_name'] || r['Name'] || '').toString().trim();
        const email = (r['Email'] || r['email'] || '').toString().trim().toLowerCase();
        if (!fullName) errors.push('Missing Full Name');
        if (!email) errors.push('Missing Email');
        if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.push('Invalid email');
        return { ...r, 'Full Name': fullName, 'Email': email, __index: i, __errors: errors };
    });

    helpers._rows = rows;
    helpers._file = file;
    helpers.showPreview(rows, COLUMNS);
    const valid = rows.filter(r => !r.__errors.length).length;
    helpers.setUploadEnabled(valid > 0);
    if (valid === 0) showToast('No valid rows found.', 'warning');
    else showToast(`${valid} student${valid !== 1 ? 's' : ''} ready to upload.`, 'success', 3500);
}

async function doUpload(file, helpers) {
    const validCount = (helpers._rows || []).filter(r => !r.__errors.length).length;
    const confirmed = await window.showConfirm(
        `Upload ${validCount} student${validCount !== 1 ? 's' : ''}? Each will get a temporary password of "123456".`,
        'Confirm Bulk Upload'
    );
    if (!confirmed) return;

    helpers.startProgress(validCount);

    const errors = [];
    // Delegate to existing uploadAndProcessExcel which handles DB + Auth per-row
    // We wrap it to show progress via the modal
    try {
        const results = await uploadAndProcessExcel(helpers._file);
        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);

        failed.forEach(r => errors.push(`${r.email || 'Row'}: ${r.error}`));
        helpers.finishProgress(errors.map(e => `<div style="color:#fca5a5;margin-top:4px;">⚠ ${e}</div>`).join(''));
        helpers.showFooterDone();

        if (succeeded > 0 && failed.length === 0)
            showToast(`✅ ${succeeded} student${succeeded !== 1 ? 's' : ''} uploaded!`, 'success', 6000);
        else if (succeeded > 0)
            showToast(`Uploaded ${succeeded}, ${failed.length} failed.`, 'warning', 7000);
        else
            showToast('All uploads failed. Check details.', 'error');
    } catch (e) {
        helpers.finishProgress(`<div style="color:#fca5a5;">Upload error: ${e.message}</div>`);
        helpers.showFooterDone();
        showToast('Upload error: ' + e.message, 'error');
    }
}

window.openStudentsExcelUpload = function () {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded. Refresh and try again.', 'error'); return; }
    openUploadModal({
        title: 'Bulk Upload Students',
        icon: 'fa-user-graduate',
        accept: '.xlsx,.xls',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Upload Students',
        onFile: processFile,
        onConfirm: doUpload,
    });
};
