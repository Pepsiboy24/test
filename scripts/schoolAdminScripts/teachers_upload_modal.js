/**
 * teachers_upload_modal.js
 * Bulk Excel upload for the Teachers page.
 * Wraps the existing uploadAndProcessExcel() from multipleTeacherReg.js
 * in the new shared dark-themed modal UI.
 *
 * Required columns: First Name, Last Name, Email
 * Optional: Date of Birth, Gender, Address, Phone Number, Date Hired,
 *           TRCN Reg Number, Marital Status
 */
import { openUploadModal } from '../../../scripts/upload_modal_ui.js';
import { uploadAndProcessExcel } from './multipleTeacherReg.js';

const HINT_HTML = `
<strong style="color:#93c5fd;">Required:</strong>
<code style="color:#a5f3fc;">First Name</code>,
<code style="color:#a5f3fc;">Last Name</code>,
<code style="color:#a5f3fc;">Email</code>
&nbsp;·&nbsp;
<strong style="color:#93c5fd;">Optional:</strong>
<code style="color:#a5f3fc;">Date of Birth</code>,
<code style="color:#a5f3fc;">Gender</code>,
<code style="color:#a5f3fc;">Address</code>,
<code style="color:#a5f3fc;">Phone Number</code>,
<code style="color:#a5f3fc;">Date Hired</code>,
<code style="color:#a5f3fc;">TRCN Reg Number</code>,
<code style="color:#a5f3fc;">Marital Status</code>
<br>
<span style="color:#64748b;">
  Each row creates one teacher account + auth user (default password: <code style="color:#fcd34d;">123456</code>).
  Dates should be in <code style="color:#fcd34d;">YYYY-MM-DD</code> format or Excel date cells.
  Duplicate emails are skipped automatically.
</span>`;

const COLUMNS = [
    { key: 'First Name', label: 'First Name', required: true },
    { key: 'Last Name', label: 'Last Name', required: true },
    { key: 'Email', label: 'Email', required: true },
    { key: 'Gender', label: 'Gender' },
    { key: 'Phone Number', label: 'Phone' },
];

function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['First Name', 'Last Name', 'Email', 'Date of Birth', 'Gender', 'Address', 'Phone Number', 'Date Hired', 'TRCN Reg Number', 'Marital Status'],
        ['John', 'Doe', 'john@school.edu', '1985-03-20', 'Male', '12 Main St', '08012345678', '2024-01-15', 'TCH/001', 'Single'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
    XLSX.writeFile(wb, 'teachers_template.xlsx');
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
        const firstName = (r['First Name'] || r['first_name'] || r['FirstName'] || '').toString().trim();
        const lastName = (r['Last Name'] || r['last_name'] || r['LastName'] || '').toString().trim();
        const email = (r['Email'] || r['email'] || '').toString().trim().toLowerCase();
        if (!firstName) errors.push('Missing First Name');
        if (!lastName) errors.push('Missing Last Name');
        if (!email) errors.push('Missing Email');
        if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.push('Invalid email');
        return { ...r, 'First Name': firstName, 'Last Name': lastName, 'Email': email, __index: i, __errors: errors };
    });

    helpers._rows = rows;
    helpers._file = file;
    helpers.showPreview(rows, COLUMNS);
    const valid = rows.filter(r => !r.__errors.length).length;
    helpers.setUploadEnabled(valid > 0);
    if (valid === 0) showToast('No valid rows found.', 'warning');
    else showToast(`${valid} teacher${valid !== 1 ? 's' : ''} ready to upload.`, 'success', 3500);
}

async function doUpload(file, helpers) {
    const validCount = (helpers._rows || []).filter(r => !r.__errors.length).length;
    const confirmed = await window.showConfirm(
        `Upload ${validCount} teacher${validCount !== 1 ? 's' : ''}? Each receives a temporary password of "123456".`,
        'Confirm Bulk Upload'
    );
    if (!confirmed) return;

    helpers.startProgress(validCount);

    const errors = [];
    try {
        const results = await uploadAndProcessExcel(helpers._file);
        const succeeded = results ? results.filter(r => r && r.success !== false).length : 0;

        helpers.finishProgress(errors.map(e => `<div style="color:#fca5a5;margin-top:4px;">⚠ ${e}</div>`).join(''));
        helpers.showFooterDone();

        if (succeeded > 0)
            showToast(`✅ ${succeeded} teacher${succeeded !== 1 ? 's' : ''} uploaded!`, 'success', 6000);
        else
            showToast('Upload may have completed. Check the teacher list.', 'info');
    } catch (e) {
        helpers.finishProgress(`<div style="color:#fca5a5;">Upload error: ${e.message}</div>`);
        helpers.showFooterDone();
        showToast('Upload error: ' + e.message, 'error');
    }
}

window.openTeachersExcelUpload = function () {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded. Refresh and try again.', 'error'); return; }
    openUploadModal({
        title: 'Bulk Upload Teachers',
        icon: 'fa-chalkboard-teacher',
        accept: '.xlsx,.xls',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Upload Teachers',
        onFile: processFile,
        onConfirm: doUpload,
    });
};
