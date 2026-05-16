import { supabase } from '../../../core/config.js';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs';
import { openUploadModal } from '../../../assets/js-shared/upload_modal_ui.js';

// Supabase configuration
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const HINT_HTML = `
<strong style="color:#93c5fd;">Required:</strong> A timetable grid with Days as headers.<br>
<span style="color:#64748b;">
  Note: Excel rows must match your Period Count (Setup). Breaks in Excel are ignored; the system uses your Config.
</span>`;

const COLUMNS = [
    { key: 'day_of_week', label: 'Day' },
    { key: 'start_time', label: 'Time' },
    { key: 'subject', label: 'Subject' }
];

function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        ['Mathematics', 'English', 'Science', 'Mathematics', 'English'],
        ['Break', 'Break', 'Break', 'Break', 'Break'],
        ['History', 'Geography', 'Art', 'History', 'Geography']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
    XLSX.writeFile(wb, 'timetable_template.xlsx');
}

window.openTimetableExcelUpload = function() {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded. Refresh and try again.', 'error'); return; }
    
    openUploadModal({
        title: 'Upload Timetable Excel',
        icon: 'fa-calendar-days',
        accept: '.xlsx,.xls',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Apply Schedule',
        onFile: async (file, helpers) => {
            const urlParams = new URLSearchParams(window.location.search);
            let classId = urlParams.get('classId');
            if (!classId) { showToast("Class ID not found.", "error"); return; }
            
            const data = await readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
            
            const processed = await processExcelData(jsonData, classId);
            
            const validRows = processed.entries.map((e, i) => ({
                __index: i,
                __errors: [],
                day_of_week: e.day_of_week,
                start_time: e.start_time,
                subject: e.subject_name || 'Unknown'
            }));
            
            const errRows = processed.errors.map((err, i) => ({
                __index: validRows.length + i,
                __errors: [err],
                day_of_week: '-',
                start_time: '-',
                subject: '-'
            }));
            
            const allRows = [...validRows, ...errRows];
            helpers._processedEntries = processed.entries;
            
            helpers.showPreview(allRows, COLUMNS);
            helpers.setUploadEnabled(processed.entries.length > 0);
            
            if (processed.errors.length > 0) {
                showToast(`Found ${processed.errors.length} issues in Excel.`, 'warning', 4000);
            } else {
                showToast(`Ready! ${processed.entries.length} classes parsed.`, 'success', 3000);
            }
        },
        onConfirm: async (file, helpers) => {
            if (window.previewUploadedData) {
                window.previewUploadedData(helpers._processedEntries);
                helpers.close();
                showToast('Schedule applied to grid. Click "Save Timetable" to confirm.', 'success');
            } else {
                showToast("Error: previewUploadedData function missing in main script.", "error");
            }
        }
    });
};

async function processExcelData(jsonData, classId) {
    if (!jsonData.length) throw new Error('Empty file');

    // 1. Fetch Config
    const { data: config, error } = await supabase
        .from('schedule_configs')
        .select('*')
        .eq('class_id', classId)
        .single();

    if (error || !config) throw new Error("Please complete 'Setup' first. No schedule config found.");

    // 2. Generate Expected Times (Skeleton)
    const validPeriodTimes = generateValidPeriodTimes(config);
    const expectedCount = validPeriodTimes.length;

    let entries = [];
    let errors = [];

    // --- NEW VALIDATION: Check Row Counts ---
    // Count rows in Excel that are actual data (skipping headers/breaks)
    const validExcelRows = jsonData.slice(1).filter(row => {
        if (!row || !row.length) return false;
        const firstCell = row[0] ? row[0].toString().toLowerCase() : "";
        return !firstCell.includes("break") && !firstCell.includes("lunch");
    });

    if (validExcelRows.length !== expectedCount) {
        errors.push(`Row Count Mismatch: Excel has ${validExcelRows.length} class rows, but your Setup expects ${expectedCount} periods.`);
    }

    // 3. Prepare Headers
    const headers = jsonData[0];
    const dayColumns = [];
    headers.forEach((h, i) => {
        if (h && DAYS_OF_WEEK.includes(h.trim())) {
            dayColumns.push({ day: h.trim(), index: i });
        }
    });

    const { data: subjects } = await supabase.from('Subjects').select('*');

    // 4. Process Rows
    let periodIndex = 0;

    for (let r = 1; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row || !row.length) continue;

        const firstCell = row[0] ? row[0].toString().toLowerCase() : "";

        // Skip visual breaks in Excel
        if (firstCell.includes("break") || firstCell.includes("lunch")) {
            continue;
        }

        // Stop if we exceed configured periods (Validation already caught this, but safety check)
        if (periodIndex >= validPeriodTimes.length) {
            continue;
        }

        const timeStr = validPeriodTimes[periodIndex];

        for (const col of dayColumns) {
            const subName = row[col.index];
            if (subName && subName.toString().trim()) {
                const term = subName.toLowerCase().trim();
                let match = subjects.find(s => s.subject_name.toLowerCase() === term || (s.subject_code && s.subject_code.toLowerCase() === term));

                if (match) {
                    entries.push({
                        class_id: parseInt(classId),
                        subject_id: match.subject_id,
                        subject_name: match.subject_name,
                        day_of_week: col.day,
                        start_time: timeStr + ":00",
                        duration_minutes: parseInt(config.period_duration) || 40,
                        // room_number: 'TBD'
                    });
                } else {
                    errors.push(`Row ${r + 1} (${col.day}): Subject "${subName}" not found.`);
                }
            }
        }

        periodIndex++;
    }

    return { entries, errors };
}

// Helper: Generates list of start times for CLASSES only
function generateValidPeriodTimes(config) {
    const times = [];
    let currentMinutes = 0;
    let periodsFound = 0;
    const limit = config.periods_per_day || 8;
    let safety = 0;

    while (periodsFound < limit && safety < 50) {
        safety++;
        const timeStr = addMinutes(config.start_time, currentMinutes);

        // Check Break
        const breakObj = config.break_times.find(b => {
            const start = typeof b === 'object' ? b.start : b;
            return start.startsWith(timeStr);
        });

        if (breakObj) {
            // Add duration to clock, DO NOT save time
            const dur = typeof breakObj === 'object' ? parseInt(breakObj.duration, 10) || 20 : 20;
            currentMinutes += dur;
        } else {
            // Save time, add duration
            times.push(timeStr);
            const pDur = parseInt(config.period_duration, 10) || 40;
            currentMinutes += pDur;
            periodsFound++;
        }
    }
    return times;
}

function addMinutes(time, minutesToAdd) {
    if (!time) return "08:00";
    const [hours, mins] = time.split(':').map(Number);
    let totalMinutes = (hours * 60) + mins + minutesToAdd;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}