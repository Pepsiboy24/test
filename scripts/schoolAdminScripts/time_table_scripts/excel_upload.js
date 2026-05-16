import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase configuration
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function initExcelUpload() {
    addExcelUploadButton();
}

function addExcelUploadButton() {
    let container = document.querySelector('.wizard-actions') || document.querySelector('.toolbar');
    let insertBeforeElement = document.getElementById('saveTimetableBtn');
    if (!container) return;
    if (document.getElementById('excelUploadBtn')) return;

    const excelBtn = document.createElement('button');
    excelBtn.type = 'button';
    excelBtn.className = 'btn btn-primary';
    excelBtn.id = 'excelUploadBtn';
    excelBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Upload Excel';
    excelBtn.style.cssText = 'background-color: #107c41; border-color: #107c41; color: white; margin-right: 10px;';

    excelBtn.onclick = openExcelUploadModal;

    if (insertBeforeElement && container.contains(insertBeforeElement)) {
        container.insertBefore(excelBtn, insertBeforeElement);
    } else {
        container.appendChild(excelBtn);
    }
}

function openExcelUploadModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;`;
    modal.innerHTML = `
        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px;">
            <h3>Upload Excel</h3>
            <p style="margin-bottom:15px; font-size:13px; color:#666;">
                <b>Note:</b> Excel rows must match your Period Count.<br>
                Breaks in Excel are ignored; the system uses your Config.
            </p>
            <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="width:100%; margin-bottom:15px;">
            <div id="uploadProgress" style="display:none; margin-bottom:15px;">Processing...</div>
            <div style="text-align:right;">
                <button class="btn btn-secondary" onclick="closeExcelModal()">Cancel</button>
                <button class="btn btn-primary" style="background:#107c41;" onclick="processExcelUpload()">Preview</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    window.closeExcelModal = () => document.body.removeChild(modal);
    window.processExcelUpload = () => processExcelUpload();
}

async function processExcelUpload() {
    const fileInput = document.getElementById('excelFileInput');
    const urlParams = new URLSearchParams(window.location.search);
    let classId = urlParams.get('classId');
    if (!classId) classId = prompt("Enter Class ID:");

    if (!fileInput.files.length) { showToast('Please select an Excel file first.', 'warning'); return; }

    const progressDiv = document.getElementById('uploadProgress');
    progressDiv.style.display = 'block';

    try {
        const file = fileInput.files[0];
        const data = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });

        // Process data
        const processed = await processExcelData(jsonData, classId);

        if (processed.errors.length > 0) {
            // Join errors with newlines for alert
            const errorMsg = `Found ${processed.errors.length} issues:\n- ${processed.errors.slice(0, 5).join('\n- ')}\n${processed.errors.length > 5 ? '...and more.' : ''}\n\nDo you want to continue anyway?`;

            if (!await window.showConfirm(errorMsg, 'Format Warning')) {
                progressDiv.style.display = 'none';
                return;
            }
        }

        // Pass to main script
        if (window.previewUploadedData) {
            window.previewUploadedData(processed.entries);
            window.closeExcelModal();
            showToast(`Ready! ${processed.entries.length} classes loaded.`, 'success');
        } else {
            showToast("Error: previewUploadedData function missing in main script.", "error");
        }

    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    } finally {
        if (progressDiv) progressDiv.style.display = 'none';
    }
}

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

document.addEventListener('DOMContentLoaded', initExcelUpload);