import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    console.log("Timetable Wizard Loaded");
    fetchClasses();
    setupEventListeners();
    checkForEditMode();
});

// 1. Populate Class Dropdown
async function fetchClasses() {
    const classSelect = document.getElementById('classSelect');
    try {
        const { data, error } = await supabase.from('Classes').select('class_id, class_name, section');
        if (error) throw error;

        data.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.class_id;
            option.textContent = `${cls.class_name} ${cls.section}`;
            classSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching classes:", err);
    }
}

// 2. Setup Event Listeners
function setupEventListeners() {
    document.getElementById('addBreakBtn').addEventListener('click', () => addBreakField());
    const form = document.getElementById('scheduleSetupForm');
    if (form) {
        form.addEventListener('submit', handleSaveConfig);
    }
    document.getElementById('classSelect').addEventListener('change', (e) => {
        const classId = e.target.value;
        if (classId) {
            loadClassConfig(classId);
        } else {
            resetForm();
        }
    });
}

// Check for edit mode from URL parameters
async function checkForEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');

    if (classId) {
        console.log(`Edit mode detected for class ID: ${classId}`);

        // Set the class dropdown to the specified class
        const classSelect = document.getElementById('classSelect');
        classSelect.value = classId;

        // Load the existing configuration for editing
        await loadClassConfig(classId);

        // Update page title and subtitle to indicate edit mode
        const pageTitle = document.querySelector('.page-title');
        const pageSubtitle = document.querySelector('.page-subtitle');

        if (pageTitle) pageTitle.textContent = 'Edit Timetable Configuration';
        if (pageSubtitle) pageSubtitle.textContent = 'Modify existing schedule settings';
    }
}

// Load Config
async function loadClassConfig(classId) {
    console.log(`Checking config for class ${classId}...`);
    try {
        const { data, error } = await supabase
            .from('schedule_configs')
            .select('*')
            .eq('class_id', classId)
            .maybeSingle();

        if (error) {
            console.error("Error fetching config:", error);
            return;
        }

        if (data) {
            const wantsToEdit = await window.showConfirm("A timetable configuration already exists for this class. Would you like to load and edit it?", "Existing Configuration Found");

            if (!wantsToEdit) {
                document.getElementById('classSelect').value = "";
                resetForm();
                return;
            }

            console.log("Loading config for editing...");
            showEditModeBanner(true);

            document.getElementById('startTime').value = data.start_time.slice(0, 5);
            document.getElementById('periodDuration').value = data.period_duration;

            const activeDays = data.active_days || [];
            document.querySelectorAll('input[name="active_days"]').forEach(cb => {
                cb.checked = activeDays.includes(cb.value);
            });

            const container = document.getElementById('breaksContainer');
            container.innerHTML = '';

            const breaks = data.break_times || [];
            let totalBreakMinutes = 0;

            breaks.forEach(b => {
                const start = typeof b === 'object' ? b.start : b;
                const duration = typeof b === 'object' ? parseInt(b.duration) : 20;
                totalBreakMinutes += duration;
                addBreakField(start, duration);
            });

            const periods = data.periods_per_day || 0;
            const periodDur = data.period_duration || 40;
            const totalClassMinutes = periods * periodDur;
            const startMins = timeToMinutes(data.start_time);
            const endMins = startMins + totalClassMinutes + totalBreakMinutes;
            document.getElementById('endTime').value = minutesToTime(endMins);

            const submitBtn = document.querySelector('button[type="submit"]');
            submitBtn.innerHTML = `Update Configuration <i class="fa-solid fa-rotate"></i>`;
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-warning');

        } else {
            showEditModeBanner(false);
            resetForm();
        }

    } catch (err) {
        console.error("Load Config Error:", err);
    }
}

function showEditModeBanner(show) {
    const form = document.getElementById('scheduleSetupForm');
    const existingBanner = document.getElementById('editModeBanner');

    if (show) {
        if (!existingBanner) {
            const banner = document.createElement('div');
            banner.id = 'editModeBanner';
            banner.style.cssText = `
                background-color: #fff3cd; 
                color: #856404; 
                padding: 12px; 
                margin-bottom: 20px; 
                border: 1px solid #ffeeba; 
                border-radius: 4px;
                display: flex;
                align-items: center;
                font-size: 14px;
            `;
            banner.innerHTML = `<i class="fa-solid fa-pencil" style="margin-right: 10px;"></i> <b>Editing Mode:</b> You are modifying an existing configuration.`;
            form.insertBefore(banner, form.firstChild);
        }
    } else {
        if (existingBanner) existingBanner.remove();
    }
}

function resetForm() {
    document.getElementById('startTime').value = "08:00";
    document.getElementById('endTime').value = "16:00";
    document.getElementById('periodDuration').value = "40";
    document.querySelectorAll('input[name="active_days"]').forEach(cb => cb.checked = true);
    document.getElementById('breaksContainer').innerHTML = '';
    addBreakField("10:00", 20);

    showEditModeBanner(false);

    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.innerHTML = `Next: Add Entries <i class="fa-solid fa-arrow-right"></i>`;
    submitBtn.classList.add('btn-primary');
    submitBtn.classList.remove('btn-warning');
}

function addBreakField(startTime = '', duration = '20') {
    const container = document.getElementById('breaksContainer');
    const breakDiv = document.createElement('div');
    breakDiv.className = 'break-item';
    breakDiv.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label>Break Start Time</label>
                <input type="time" name="break_start_time" value="${startTime}" required>
            </div>
            <div class="form-group">
                <label>Break Duration (minutes)</label>
                <input type="number" name="break_duration" value="${duration}" min="5" max="120" required>
            </div>
            <div class="form-group" style="display: flex; align-items: flex-end;">
                <button type="button" class="btn btn-sm btn-danger remove-break" onclick="this.closest('.break-item').remove()">
                    <i class="fa-solid fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `;
    container.appendChild(breakDiv);
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function calculatePeriodsAndValidate(startTime, endTime, periodDuration, breaks) {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const periodDur = parseInt(periodDuration);

    let currentTime = startMinutes;
    let periodCount = 0;
    const periodEndTimes = [];

    while (currentTime < endMinutes) {
        const periodEnd = currentTime + periodDur;
        if (periodEnd > endMinutes) break;
        periodEndTimes.push(periodEnd);
        currentTime = periodEnd;
        periodCount++;
    }

    for (const breakItem of breaks) {
        const breakStart = timeToMinutes(breakItem.start);

        const alignedBreak = periodEndTimes.find(endTime => endTime === breakStart);

        if (!alignedBreak) {
            let closestAlignedTime = null;
            let minDifference = Infinity;
            for (const periodEnd of periodEndTimes) {
                const difference = Math.abs(periodEnd - breakStart);
                if (difference < minDifference) {
                    minDifference = difference;
                    closestAlignedTime = periodEnd;
                }
            }
            const suggestedTime = closestAlignedTime ? minutesToTime(closestAlignedTime) : "period boundary";
            return {
                valid: false,
                error: `Invalid Break Time: The break at ${breakItem.start} interrupts a class period. Please adjust it to align with the schedule (e.g., try ${suggestedTime}).`,
                periodsPerDay: periodCount
            };
        }
    }

    return { valid: true, periodsPerDay: periodCount };
}

// 4. Handle Save
async function handleSaveConfig(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.textContent = "Processing...";
    btn.disabled = true;

    try {
        const classId = document.getElementById('classSelect').value;
        const startTime = document.getElementById('startTime').value;
        const periodDuration = parseInt(document.getElementById('periodDuration').value);

        const activeDays = Array.from(document.querySelectorAll('input[name="active_days"]:checked')).map(cb => cb.value);
        if (activeDays.length === 0) throw new Error("Please select at least one active day.");

        const breakItems = document.querySelectorAll('.break-item');
        const breaks = Array.from(breakItems).map(item => ({
            start: item.querySelector('input[name="break_start_time"]').value,
            duration: parseInt(item.querySelector('input[name="break_duration"]').value)
        })).filter(b => b.start);

        const calc = calculatePeriodsAndValidate(startTime, "16:00", periodDuration, breaks);
        if (!calc.valid) throw new Error(calc.error);

        const newConfig = {
            class_id: classId,
            start_time: startTime,
            period_duration: periodDuration,
            periods_per_day: calc.periodsPerDay,
            active_days: activeDays,
            break_times: breaks
        };

        const { data: existingConfig } = await supabase.from('schedule_configs').select('*').eq('class_id', classId).maybeSingle();
        const { data: existingEntries } = await supabase.from('timetable_entries').select('*').eq('class_id', classId);

        let performMigration = false;

        if (existingConfig && existingEntries && existingEntries.length > 0) {
            const timeChanged = existingConfig.start_time.slice(0, 5) !== startTime;
            const durationChanged = existingConfig.period_duration !== periodDuration;
            const breaksChanged = JSON.stringify(existingConfig.break_times) !== JSON.stringify(breaks);

            if (timeChanged || durationChanged || breaksChanged) {
                const confirmShift = await window.showConfirm("You changed the time structure. Auto-adjust existing classes to new times? (Cancel = delete existing entries and start over)", "Schedule Change Detected ⚠️");

                if (confirmShift) {
                    performMigration = true;
                } else {
                    await supabase.from('timetable_entries').delete().eq('class_id', classId);
                }
            }
        }

        // SAVE CONFIG (Using Option 1: check existence then Update or Insert)
        let saveError;
        if (existingConfig) {
            const { error } = await supabase.from('schedule_configs').update(newConfig).eq('class_id', classId);
            saveError = error;
        } else {
            const { error } = await supabase.from('schedule_configs').insert(newConfig);
            saveError = error;
        }
        if (saveError) throw saveError;

        // EXECUTE MIGRATION
        if (performMigration) {
            console.log("Migrating entries to new timeline...");
            const oldPeriodMap = generatePeriodMap(existingConfig);
            const newTimesArray = generateValidPeriodTimes(newConfig);

            const updates = [];
            const idsToDelete = [];

            for (const entry of existingEntries) {
                const oldTime = entry.start_time.slice(0, 5);
                const periodIndex = oldPeriodMap[oldTime];

                if (periodIndex !== undefined && newTimesArray[periodIndex]) {
                    const newTime = newTimesArray[periodIndex];
                    if (newTime !== oldTime || entry.duration_minutes !== periodDuration) {
                        updates.push({
                            id: entry.id,
                            start_time: newTime + ":00",
                            duration_minutes: periodDuration
                        });
                    }
                } else {
                    idsToDelete.push(entry.id);
                }
            }

            if (updates.length > 0) {
                const { error: updateErr } = await supabase.from('timetable_entries').upsert(updates);
                if (updateErr) console.error("Migration update failed", updateErr);
            }
            if (idsToDelete.length > 0) {
                await supabase.from('timetable_entries').delete().in('id', idsToDelete);
            }
        }

        window.location.href = `create_timetable_entries.html?classId=${classId}`;

    } catch (err) {
        console.error("Save Error:", err);
        showToast(err.message, 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- HELPERS FOR MIGRATION ---

// 1. Map Times to Index
function generatePeriodMap(config) {
    const map = {};
    let currentMinutes = 0;
    const limit = config.periods_per_day || 20;

    for (let i = 0; i < limit; i++) {
        let timeFound = false;
        let safety = 0;

        while (!timeFound && safety < 50) {
            safety++;
            // 🟢 THIS WAS THE MISSING FUNCTION CAUSING YOUR ERROR
            const t = addMinutes(config.start_time, currentMinutes);
            const timeStr = t.slice(0, 5);

            const breakObj = config.break_times.find(b => {
                const start = typeof b === 'object' ? b.start : b;
                return start.startsWith(timeStr);
            });

            if (breakObj) {
                const dur = typeof breakObj === 'object' ? parseInt(breakObj.duration) || 20 : 20;
                currentMinutes += dur;
            } else {
                map[timeStr] = i;
                const pDur = parseInt(config.period_duration) || 40;
                currentMinutes += pDur;
                timeFound = true;
            }
        }
    }
    return map;
}

// 2. Generate New Times Array
function generateValidPeriodTimes(config) {
    const times = [];
    let currentMinutes = 0;
    const limit = config.periods_per_day || 20;

    for (let i = 0; i < limit; i++) {
        let timeFound = false;
        let safety = 0;

        while (!timeFound && safety < 50) {
            safety++;
            // 🟢 THIS ALSO NEEDS addMinutes
            const t = addMinutes(config.start_time, currentMinutes);
            const timeStr = t.slice(0, 5);

            const breakObj = config.break_times.find(b => {
                const start = typeof b === 'object' ? b.start : b;
                return start.startsWith(timeStr);
            });

            if (breakObj) {
                const dur = typeof breakObj === 'object' ? parseInt(breakObj.duration) || 20 : 20;
                currentMinutes += dur;
            } else {
                times.push(timeStr);
                const pDur = parseInt(config.period_duration) || 40;
                currentMinutes += pDur;
                timeFound = true;
            }
        }
    }
    return times;
}

// 3. 🟢 THE MISSING FUNCTION
function addMinutes(time, minutesToAdd) {
    if (!time) return "08:00";
    const [hours, mins] = time.split(':').map(Number);
    let totalMinutes = (hours * 60) + mins + minutesToAdd;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}