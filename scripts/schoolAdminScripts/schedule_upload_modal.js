/**
 * schedule_upload_modal.js
 * Upload modal for the Schedule page calendar file upload.
 * Wraps the existing handleCalendarUpload() from upload_calendar.js
 * in the new shared dark-themed modal UI.
 *
 * Supported formats: .ics, .csv, .xlsx
 * ICS: standard calendar events
 * CSV/XLSX columns: Title, Start Date, End Date, Description (optional)
 */
import { openUploadModal } from '../../../scripts/upload_modal_ui.js';

const HINT_HTML = `
<strong style="color:#93c5fd;">ICS file:</strong> Standard calendar file exported from Google Calendar, Outlook, etc.
<br>
<strong style="color:#93c5fd;">CSV / Excel columns:</strong>
<code style="color:#a5f3fc;">Title</code> (required),
<code style="color:#a5f3fc;">Start Date</code> (required),
<code style="color:#a5f3fc;">End Date</code>,
<code style="color:#a5f3fc;">Description</code>,
<code style="color:#a5f3fc;">Term Period</code>
<br>
<span style="color:#64748b;">Dates should be in <code style="color:#fcd34d;">YYYY-MM-DD</code> format.
Each row adds one academic event to the current session calendar.</span>`;

const COLUMNS = [
    { key: 'Title', label: 'Event Title', required: true },
    { key: 'Start Date', label: 'Start Date', required: true },
    { key: 'End Date', label: 'End Date' },
    { key: 'Term Period', label: 'Term Period' },
    { key: 'Description', label: 'Description' },
];

function downloadTemplate() {
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Title', 'Start Date', 'End Date', 'Term Period', 'Description'],
            ['First Term Exams', '2024-11-18', '2024-11-29', 'First Term', 'End of term examinations'],
            ['Christmas Break', '2024-12-01', '2025-01-05', 'First Term', 'School holiday'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Events');
        XLSX.writeFile(wb, 'calendar_template.xlsx');
    }
}

async function processFile(file, helpers) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'ics') {
        // ICS file — just confirm it's selected, parse happens on upload
        helpers._file = file;
        helpers._isICS = true;
        // Show simple preview for ICS
        const text = await file.text();
        const events = (text.match(/BEGIN:VEVENT/g) || []).length;
        // Show minimal preview message
        document.getElementById('__umPreview').style.display = 'block';
        document.getElementById('__umDropZone').style.display = 'none';
        document.getElementById('__umPreviewTitle').textContent = `ICS file: "${file.name}" — ${events} event${events !== 1 ? 's' : ''} detected`;
        document.getElementById('__umPreviewBody').innerHTML = `<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;font-size:14px;">
            <i class="fa-solid fa-calendar-check" style="font-size:32px;color:#3b82f6;display:block;margin-bottom:12px;"></i>
            Ready to import <strong style="color:#e2e8f0;">${events} calendar event${events !== 1 ? 's' : ''}</strong> from this ICS file.
        </td></tr>`;
        document.getElementById('__umPreviewHead').innerHTML = '';
        helpers.setUploadEnabled(events > 0);
        if (events === 0) showToast('No events found in this ICS file.', 'warning');
        else showToast(`${events} event${events !== 1 ? 's' : ''} ready to import.`, 'success', 3000);
        return;
    }

    // CSV / XLSX
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }

    let raw;
    if (ext === 'csv') {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        raw = lines.slice(1).map(l => {
            const vals = l.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = vals[i] ?? '');
            return obj;
        });
    } else {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    }

    if (!raw.length) { showToast('File is empty.', 'warning'); return; }

    const rows = raw.map((r, i) => {
        // Normalize keys for common header variations
        const lower = {};
        Object.keys(r).forEach(k => lower[k.toLowerCase().trim()] = r[k]);
        const row = {
            'Title': (lower['title'] || lower['event'] || lower['event name'] || '').toString().trim(),
            'Start Date': (lower['start date'] || lower['start'] || lower['date'] || '').toString().trim(),
            'End Date': (lower['end date'] || lower['end'] || '').toString().trim(),
            'Term Period': (lower['term period'] || lower['term'] || '').toString().trim(),
            'Description': (lower['description'] || lower['desc'] || '').toString().trim(),
            __index: i,
            __errors: [],
        };
        if (!row['Title']) row.__errors.push('Missing Title');
        if (!row['Start Date']) row.__errors.push('Missing Start Date');
        return row;
    });

    helpers._rows = rows;
    helpers._file = file;
    helpers._isICS = false;
    helpers.showPreview(rows, COLUMNS);
    const valid = rows.filter(r => !r.__errors.length).length;
    helpers.setUploadEnabled(valid > 0);
    if (valid === 0) showToast('No valid rows found.', 'warning');
    else showToast(`${valid} event${valid !== 1 ? 's' : ''} ready.`, 'success', 3000);
}

async function doUpload(file, helpers) {
    const confirmed = await window.showConfirm(
        helpers._isICS
            ? 'Import all events from this ICS file into the current session calendar?'
            : `Upload ${(helpers._rows || []).filter(r => !r.__errors.length).length} calendar events?`,
        'Confirm Calendar Upload'
    );
    if (!confirmed) return;

    // For ICS files, delegate to the existing upload_calendar.js handler
    if (helpers._isICS) {
        helpers.startProgress(1);
        document.getElementById('__umProgressLabel').textContent = 'Importing ICS…';
        // Dispatch a synthetic file input change event to the existing #fileInput
        const existingInput = document.getElementById('fileInput');
        if (existingInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            existingInput.files = dt.files;
            existingInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        helpers.finishProgress('');
        helpers.showFooterDone();
        showToast('ICS file sent to calendar processor. Check the calendar below.', 'info', 5000);
        return;
    }

    // CSV/XLSX — insert rows into academic_events table
    const validRows = (helpers._rows || []).filter(r => !r.__errors.length);
    helpers.startProgress(validRows.length);

    // Import Supabase client for direct insert
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(
        'https://dzotwozhcxzkxtunmqth.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE'
    );

    let succeeded = 0, failed = 0;
    const errors = [];

    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        helpers.tickProgress(i, validRows.length, `Uploading ${i + 1} of ${validRows.length}: ${row['Title']}`);
        try {
            const { error } = await sb.from('academic_events').insert([{
                activity_event: row['Title'],
                start_date: row['Start Date'] || null,
                end_date: row['End Date'] || null,
                term_period: row['Term Period'] || null,
                remarks: row['Description'] || null,
            }]);
            if (error) throw new Error(error.message);
            succeeded++;
        } catch (e) {
            failed++;
            errors.push(`Row ${row.__index + 1} (${row['Title']}): ${e.message}`);
        }
    }

    helpers.finishProgress(errors.map(e => `<div style="color:#fca5a5;margin-top:4px;">⚠ ${e}</div>`).join(''));
    helpers.showFooterDone();

    if (succeeded > 0 && failed === 0)
        showToast(`✅ ${succeeded} event${succeeded !== 1 ? 's' : ''} added to calendar!`, 'success', 6000);
    else if (succeeded > 0)
        showToast(`Added ${succeeded}, ${failed} failed.`, 'warning', 7000);
    else
        showToast('Upload failed. Check details.', 'error');
}

window.openScheduleUploadModal = function () {
    openUploadModal({
        title: 'Upload Calendar Events',
        icon: 'fa-calendar-plus',
        accept: '.ics,.csv,.xlsx',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Import Events',
        onFile: processFile,
        onConfirm: doUpload,
    });
};
