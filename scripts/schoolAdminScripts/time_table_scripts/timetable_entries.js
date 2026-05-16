/**
 * timetable_entries.js — Weekly Grid Edition
 *
 * Features:
 *  – Weekly <table> grid (rows = time slots, columns = active days)
 *  – Dynamic class name in page header  ("Timetable: Senior Secondary School sci14")
 *  – Click any cell to Add/Edit the entry via modal
 *  – Quick-Delete X button on every filled cell
 *  – Delete button in the modal for saved entries
 *  – Safe 2-step Subjects fetch (no FK join dependency)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State ────────────────────────────────────────────────────────────────────
let config = null;
let entries = [];
let classSubjects = [];   // [{ subject_id, Subjects: { subject_name }, Teachers: {...} }]
let teachers = [];
let classId = null;

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupSaveButton();
});

// =============================================================================
// 1. INIT — Load all data for the selected class
// =============================================================================
async function init() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('classId');
    if (!raw) return window.location.href = 'create_timetable_setup.html';

    classId = parseInt(raw, 10);   // class_id is INTEGER in the DB

    // ── Parallel flat fetches (no FK join dependency) ─────────────────────────
    const [configRes, entriesRes, csRes, teachersRes, classRes] = await Promise.all([
        supabase.from('schedule_configs').select('*').eq('class_id', classId).single(),
        supabase.from('timetable_entries').select('*').eq('class_id', classId),
        supabase.from('Class_Subjects').select('subject_id, teacher_id').eq('class_id', classId),
        supabase.from('Teachers').select('teacher_id, first_name, last_name'),
        supabase.from('Classes').select('class_name, section').eq('class_id', classId).single(),
    ]);

    // Log any errors but don't crash
    [configRes, entriesRes, csRes, teachersRes, classRes].forEach(r => {
        if (r.error) console.error('[Timetable]', r.error.message);
    });

    config = configRes.data;
    entries = entriesRes.data || [];
    teachers = teachersRes.data || [];

    // ── Dynamic page header ───────────────────────────────────────────────────
    const cls = classRes.data;
    if (cls) {
        const label = [cls.class_name, cls.section].filter(Boolean).join(' — ');
        const titleEl = document.getElementById('pageTitle');
        const subtitleEl = document.getElementById('pageSubtitle');
        if (titleEl) titleEl.textContent = `Timetable: ${label}`;
        if (subtitleEl) subtitleEl.textContent = `Senior Secondary School · ${label}`;
        document.title = `Timetable: ${label} — EduHubAdmin`;
    } else {
        const subtitleEl = document.getElementById('pageSubtitle');
        if (subtitleEl) subtitleEl.textContent = `Class ID: ${classId}`;
    }

    // ── Step 2: Fetch subjects by ID ──────────────────────────────────────────
    const rawCS = csRes.data || [];
    const subjectIds = rawCS.map(r => r.subject_id).filter(Boolean);
    let subjectsMap = {};

    if (subjectIds.length) {
        const { data: subs } = await supabase
            .from('Subjects')
            .select('subject_id, subject_name')
            .in('subject_id', subjectIds);

        (subs || []).forEach(s => { subjectsMap[s.subject_id] = s; });
    }

    // Merge into a shape compatible with the rest of the code
    classSubjects = rawCS.map(cs => {
        const t = teachers.find(t => t.teacher_id === cs.teacher_id);
        return {
            ...cs,
            Subjects: subjectsMap[cs.subject_id] || null,
            Teachers: t ? { first_name: t.first_name, last_name: t.last_name } : null,
        };
    });

    // Defaults
    if (config) {
        config.active_days = config.active_days || [];
        config.break_times = config.break_times || [];
    }

    // ── Build classSubjects + populate dropdown (single source of truth) ─────
    await populateDropdowns();
    updateScheduleInfo();
    renderWeeklyGrid();
}

// =============================================================================
// 2. SCHEDULE INFO BAR
// =============================================================================
function updateScheduleInfo() {
    const el = document.getElementById('scheduleInfo');
    if (!el || !config) return;

    const days = config.active_days?.join(', ') || 'None';
    const breakCount = config.break_times?.length || 0;
    el.innerHTML = `
        <strong>Config:</strong> Start ${config.start_time} &bull;
        ${config.period_duration}min periods &bull;
        ${config.periods_per_day} per day &bull;
        Days: ${days} &bull;
        ${breakCount} break${breakCount !== 1 ? 's' : ''}
    `;
}

// =============================================================================
// 3. TIME UTILITIES
// =============================================================================
function addMinutes(time, mins) {
    if (!time) return '08:00';
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function generateMasterTimeline() {
    const timesSet = new Set();

    // A. Times from existing entries
    entries.forEach(e => { if (e.start_time) timesSet.add(e.start_time.slice(0, 5)); });

    // B. Times from config
    if (config) {
        let mins = 0;
        let counted = 0;
        let safety = 0;
        const limit = config.periods_per_day || 8;

        while (counted < limit && safety < 50) {
            safety++;
            const t = addMinutes(config.start_time, mins);
            timesSet.add(t.slice(0, 5));

            const brk = config.break_times?.find(b => {
                const s = typeof b === 'object' ? b.start : b;
                return s?.startsWith(t.slice(0, 5));
            });

            if (brk) {
                mins += typeof brk === 'object' ? (parseInt(brk.duration, 10) || 20) : 20;
            } else {
                mins += parseInt(config.period_duration, 10) || 40;
                counted++;
            }
        }

        // C. Explicitly add all break start times
        config.break_times?.forEach(b => {
            const s = typeof b === 'object' ? b.start : b;
            if (s) timesSet.add(s.slice(0, 5));
        });
    }

    return Array.from(timesSet).sort();
}

function isBreakSlot(timeStr) {
    return config?.break_times?.some(b => {
        const s = typeof b === 'object' ? b.start : b;
        return s?.startsWith(timeStr);
    }) || false;
}

// =============================================================================
// 4. WEEKLY GRID RENDERER
//    Rows = time slots, Columns = active days
// =============================================================================
function renderWeeklyGrid() {
    const container = document.getElementById('gridContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!config || !config.active_days?.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-gray);padding:40px;">No schedule configuration found. Go back to Setup.</p>';
        return;
    }

    const timeline = generateMasterTimeline();
    const days = config.active_days;

    // Build the <table>
    const table = document.createElement('table');
    table.className = 'week-table';

    // ── Header row ────────────────────────────────────────────────────────────
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th class="time-col">Time</th>` +
        days.map(d => `<th>${d}</th>`).join('');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // ── Body rows ─────────────────────────────────────────────────────────────
    const tbody = document.createElement('tbody');

    timeline.forEach(timeSlot => {
        const tr = document.createElement('tr');

        // Time label cell
        const timeCell = document.createElement('td');
        timeCell.className = 'time-col';
        timeCell.textContent = timeSlot;
        tr.appendChild(timeCell);

        const isBreak = isBreakSlot(timeSlot);

        days.forEach(day => {
            const td = document.createElement('td');

            if (isBreak) {
                td.innerHTML = '<div class="break-cell">BREAK</div>';
            } else {
                // Find entry for this day + time
                const entry = entries.find(e => {
                    if (!e.start_time || !e.day_of_week) return false;
                    return e.day_of_week.substring(0, 3) === day.substring(0, 3)
                        && e.start_time.slice(0, 5) === timeSlot;
                });

                if (entry) {
                    td.appendChild(buildEntryCell(entry, day, timeSlot));
                } else {
                    td.appendChild(buildEmptyCell(day, timeSlot));
                }
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

// Build a filled entry cell with Edit + Delete buttons
function buildEntryCell(entry, day, timeSlot) {
    const cs = classSubjects.find(c => c.subject_id === entry.subject_id);
    const subjectName = cs?.Subjects?.subject_name || 'Unknown Subject';
    const teacher = cs?.Teachers;
    const teacherName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';
    const isUnsaved = !entry.id;

    const div = document.createElement('div');
    div.className = `entry-cell${isUnsaved ? ' unsaved' : ''}`;
    div.innerHTML = `
        <div class="entry-subject">${subjectName}${isUnsaved ? ' <i class="fa-solid fa-asterisk" style="font-size:9px;opacity:.7;"></i>' : ''}</div>
        ${teacherName ? `<div class="entry-teacher">${teacherName}</div>` : ''}
        <div class="cell-actions">
            <button class="cell-btn" title="Edit" onclick="openModal('${day}','${timeSlot}',null)">
                <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="cell-btn del" title="Delete" onclick="quickDelete('${entry.id || ''}','${day}','${timeSlot}')">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`;

    // Clicking the cell body (not buttons) also opens edit
    div.addEventListener('click', e => {
        if (e.target.closest('.cell-btn')) return;
        openModal(day, timeSlot, entry);
    });

    return div;
}

// Build an empty "+ Add" cell
function buildEmptyCell(day, timeSlot) {
    const div = document.createElement('div');
    div.className = 'empty-cell';
    div.innerHTML = `<i class="fa-solid fa-plus" style="font-size:11px;"></i> Add`;
    div.addEventListener('click', () => openModal(day, timeSlot));
    return div;
}

// =============================================================================
// 5. DROPDOWNS — fetches subjects DIRECTLY from DB scoped to the current class
// =============================================================================
async function populateDropdowns() {
    const select = document.getElementById('modalSubject');
    if (!select || !classId) return;

    // Show loading state
    select.innerHTML = '<option value="">Loading subjects…</option>';
    select.disabled = true;

    // ── STEP 1: Fetch Class_Subjects rows for this class ──────────────────────
    const { data: csData, error: csError } = await supabase
        .from('Class_Subjects')
        .select('subject_id, teacher_id')
        .eq('class_id', classId);

    if (csError) {
        console.error('[Timetable] Class_Subjects dropdown fetch:', csError.message);
        select.innerHTML = '<option value="">Error loading subjects</option>';
        select.disabled = false;
        return;
    }

    const rows = csData || [];
    const subjectIds = rows.map(r => r.subject_id).filter(Boolean);

    if (!subjectIds.length) {
        select.innerHTML = '<option value="">No subjects assigned to this class</option>';
        select.disabled = false;
        // Keep classSubjects empty so the grid shows empty-state too
        classSubjects = [];
        return;
    }

    // ── STEP 2: Fetch subject names by ID ─────────────────────────────────────
    const { data: subjectsData, error: subjError } = await supabase
        .from('Subjects')
        .select('subject_id, subject_name')
        .in('subject_id', subjectIds);

    if (subjError) {
        console.error('[Timetable] Subjects dropdown fetch:', subjError.message);
    }

    const subjectsMap = {};
    (subjectsData || []).forEach(s => { subjectsMap[s.subject_id] = s; });

    // teacher_id lookup map (subject_id → teacher_id) from Class_Subjects
    const teacherMap = {};
    rows.forEach(r => { teacherMap[r.subject_id] = r.teacher_id; });

    // ── Rebuild classSubjects (used by renderWeeklyGrid for subject names) ────
    classSubjects = rows.map(r => {
        const t = teachers.find(t => t.teacher_id === r.teacher_id);
        return {
            ...r,
            Subjects: subjectsMap[r.subject_id] || null,
            Teachers: t ? { first_name: t.first_name, last_name: t.last_name } : null,
        };
    });

    // ── Populate the <select> ─────────────────────────────────────────────────
    select.innerHTML = '<option value="">-- Select Subject --</option>';
    (subjectsData || []).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.subject_id;
        opt.textContent = s.subject_name || 'Unknown';
        opt.dataset.teacherId = teacherMap[s.subject_id] || '';
        select.appendChild(opt);
    });

    select.disabled = false;
}

// =============================================================================
// 6. MODAL — Open / Close
// =============================================================================
window.closeModal = () => {
    document.getElementById('entryModal').style.display = 'none';
};

let currentEditingEntry = null;

window.openModal = function (day, time, entryData) {
    const modal = document.getElementById('entryModal');
    const titleEl = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('modalDeleteBtn');

    titleEl.textContent = entryData ? `Edit — ${day} @ ${time}` : `Add Entry — ${day} @ ${time}`;

    document.getElementById('modalDay').value = day;
    document.getElementById('modalTime').value = time;

    currentEditingEntry = entryData || null;

    const savedId = entryData?.id || '';
    document.getElementById('modalEntryId').value = savedId;

    // Show delete button only for persisted (saved) entries
    if (deleteBtn) deleteBtn.style.display = savedId ? 'inline-flex' : 'none';

    if (entryData) {
        document.getElementById('modalSubject').value = entryData.subject_id;
        document.getElementById('modalDuration').value = entryData.duration_minutes;
    } else {
        document.getElementById('entryForm').reset();
        document.getElementById('modalDuration').value = config?.period_duration || 40;
    }

    modal.style.display = 'flex';
};

// =============================================================================
// 7. QUICK-DELETE (X button on cell) — persisted entries go to DB; unsaved removed locally
// =============================================================================
window.quickDelete = async function (entryId, day, timeSlot) {
    if (!await window.showConfirm(`Delete the entry at ${day} ${timeSlot}?`, 'Delete Entry')) return;

    if (entryId) {
        // Saved to DB — delete from Supabase
        const { error } = await supabase.from('timetable_entries').delete().eq('id', entryId);
        if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    }

    // Remove from local array (both saved & unsaved cases)
    entries = entries.filter(e => {
        const matchTime = e.start_time?.slice(0, 5) === timeSlot;
        const matchDay = e.day_of_week?.substring(0, 3) === day.substring(0, 3);
        return !(matchTime && matchDay);
    });

    renderWeeklyGrid();
};

// =============================================================================
// 8. DELETE FROM MODAL (trash button) — only for saved entries
// =============================================================================
window.deleteCurrentEntry = async function () {
    const entryId = document.getElementById('modalEntryId').value;
    if (!entryId) return;

    if (!await window.showConfirm('Permanently delete this timetable entry?', 'Delete Entry')) return;

    const { error } = await supabase.from('timetable_entries').delete().eq('id', entryId);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }

    entries = entries.filter(e => e.id !== entryId);
    window.closeModal();
    renderWeeklyGrid();
};

// =============================================================================
// 9. FORM SUBMIT — Add / Edit
// =============================================================================
const form = document.getElementById('entryForm');
if (form) {
    form.addEventListener('submit', async e => {
        e.preventDefault();

        const entryId = document.getElementById('modalEntryId').value;

        let startTime = document.getElementById('modalTime').value;
        if (startTime.length === 5) startTime += ':00';   // time column needs HH:MM:SS

        // NOTE: timetable_entries has no teacher_id column — don't include it
        const payload = {
            class_id: classId,
            day_of_week: document.getElementById('modalDay').value,
            start_time: startTime,
            subject_id: document.getElementById('modalSubject').value,
            duration_minutes: parseInt(document.getElementById('modalDuration').value, 10),
        };

        // ── SCENARIO A: Edit a saved entry ────────────────────────────────────
        if (entryId) {
            const { error } = await supabase
                .from('timetable_entries')
                .update(payload)
                .eq('id', entryId);

            if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
            window.location.reload();   // refresh from DB
        }
        // ── SCENARIO B: Edit an unsaved (preview) entry ───────────────────────
        else if (currentEditingEntry) {
            currentEditingEntry.subject_id = payload.subject_id;
            currentEditingEntry.duration_minutes = payload.duration_minutes;
            window.closeModal();
            renderWeeklyGrid();
        }
        // ── SCENARIO C: New entry (local preview) ─────────────────────────────
        else {
            entries.push({ ...payload, tempId: Date.now() });
            window.closeModal();
            renderWeeklyGrid();
            updateSaveButtonState();
        }
    });
}

// =============================================================================
// 10. SAVE UNSAVED ENTRIES batch
// =============================================================================
function updateSaveButtonState() {
    const unsaved = entries.filter(e => !e.id).length;
    const btn = document.getElementById('saveTimetableBtn');
    if (!btn) return;

    if (unsaved > 0) {
        btn.innerHTML = `<i class="fa-solid fa-save"></i> Save ${unsaved} Change${unsaved !== 1 ? 's' : ''}`;
        btn.style.background = 'var(--warning)';
        btn.style.borderColor = 'var(--warning)';
        btn.style.color = 'white';
    }
}

function setupSaveButton() {
    const btn = document.getElementById('saveTimetableBtn');
    if (!btn) return;

    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);

    fresh.addEventListener('click', async () => {
        const unsaved = entries.filter(e => !e.id);
        if (!unsaved.length) { showToast('No unsaved changes.', 'info'); return; }

        fresh.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
        try {
            const clean = unsaved.map(({ tempId, ...rest }) => rest);
            const { error } = await supabase.from('timetable_entries').insert(clean);
            if (error) throw error;
            showToast('Timetable entries saved!', 'success');
            location.reload();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
            fresh.innerHTML = '<i class="fa-solid fa-save"></i> Save Timetable';
        }
    });
}

// =============================================================================
// 11. PREVIEW from Excel upload (called externally by excel_upload.js)
// =============================================================================
window.previewUploadedData = function (newEntries) {
    entries = [...entries, ...newEntries];
    renderWeeklyGrid();
    updateSaveButtonState();
};