/**
 * timetable_entries.js — Weekly Grid Edition
 * Fixed: UUID/Integer ID mismatch, Teacher mapping, and Roster synchronization.
 */

import { supabase } from '../../../core/config.js';
import { waitForUser } from '/core/perf.js';

// ── State ────────────────────────────────────────────────────────────────────
let config = null;
let entries = [];
let classSubjects = [];
let teachers = [];
let classId = null;
let schoolId = null;

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('classId');
    if (!raw) return window.location.href = '/admin/create_timetable_setup';

    classId = parseInt(raw, 10);

    const user = await waitForUser();
    schoolId = user?.user_metadata?.school_id;

    if (userError || !schoolId) {
        alert('Authentication error. Please log in again.');
        return;
    }

    const [configRes, entriesRes, teachersRes, classRes] = await Promise.all([
        supabase.from('schedule_configs').select('*').eq('class_id', classId).eq('school_id', schoolId).single(),
        supabase.from('timetable_entries').select('*').eq('class_id', classId).eq('school_id', schoolId),
        supabase.from('Teachers').select('teacher_id, first_name, last_name').eq('school_id', schoolId),
        supabase.from('Classes').select('class_name, section').eq('class_id', classId).eq('school_id', schoolId).single(),
    ]);

    config = configRes.data;
    entries = entriesRes.data || [];
    teachers = teachersRes.data || [];
    const classInfo = classRes.data;

    if (classInfo) {
        const label = [classInfo.class_name, classInfo.section].filter(Boolean).join(' — ');
        document.getElementById('pageTitle').textContent = `Timetable: ${label}`;
        document.getElementById('pageSubtitle').textContent = `Academic Year · ${label}`;
    }

    await populateDropdowns();
    updateScheduleInfo();
    renderWeeklyGrid();
    setupSaveButton();
}

// =============================================================================
// 2. DROPDOWNS & MAPPING — The Fix for "Unknown" subjects
// =============================================================================
async function populateDropdowns() {
    const select = document.getElementById('modalSubject');
    if (!select || !classId) return;

    select.innerHTML = '<option value="">Loading subjects...</option>';
    select.disabled = true;

    try {
        // Fetch allocations from the table used by the Academic Manager
        const { data: allocations, error: allocError } = await supabase
            .from('Subject_Allocations')
            .select('subject_id, teacher_id')
            .eq('class_id', classId)
            .eq('school_id', schoolId);

        if (allocError) throw allocError;

        if (!allocations || allocations.length === 0) {
            select.innerHTML = '<option value="">No subjects assigned to class</option>';
            return;
        }

        const subjectIds = allocations.map(r => r.subject_id);

        const { data: subjectsData, error: subjError } = await supabase
            .from('Subjects')
            .select('subject_id, subject_name')
            .in('subject_id', subjectIds)
            .eq('school_id', schoolId);

        if (subjError) throw subjError;

        const subjectsMap = new Map();
        (subjectsData || []).forEach(s => subjectsMap.set(String(s.subject_id), s));

        // Update global state using string-based matching to prevent UUID vs Int errors
        classSubjects = allocations.map(row => {
            const t = teachers.find(t => String(t.teacher_id) === String(row.teacher_id));
            const s = subjectsMap.get(String(row.subject_id));
            return {
                ...row,
                Subjects: s || { subject_name: 'Unknown Subject' },
                Teachers: t ? { first_name: t.first_name, last_name: t.last_name } : null,
            };
        });

        select.innerHTML = '<option value="">-- Select Subject --</option>';
        (subjectsData || []).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.subject_id;
            opt.textContent = s.subject_name;
            select.appendChild(opt);
        });

    } catch (err) {
        console.error("Dropdown Error:", err);
        select.innerHTML = '<option value="">Error loading data</option>';
    } finally {
        select.disabled = false;
    }
}

// =============================================================================
// 3. GRID RENDERING
// =============================================================================
function addMinutes(time, mins) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function generateMasterTimeline() {
    const timesSet = new Set();
    if (config) {
        let mins = 0;
        for (let i = 0; i < (config.periods_per_day || 8); i++) {
            const t = addMinutes(config.start_time, mins);
            timesSet.add(t.slice(0, 5));
            const isBreak = config.break_times?.find(b => (typeof b === 'object' ? b.start : b).startsWith(t.slice(0, 5)));
            mins += isBreak ? (parseInt(isBreak.duration) || 20) : (parseInt(config.period_duration) || 40);
        }
    }
    entries.forEach(e => { if (e.start_time) timesSet.add(e.start_time.slice(0, 5)); });
    return Array.from(timesSet).sort();
}

function renderWeeklyGrid() {
    const container = document.getElementById('gridContainer');
    if (!container || !config) return;
    container.innerHTML = '';

    const timeline = generateMasterTimeline();
    const days = config.active_days || [];

    const table = document.createElement('table');
    table.className = 'week-table';
    table.innerHTML = `<thead><tr><th class="time-col">Time</th>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>`;

    const tbody = document.createElement('tbody');
    timeline.forEach(timeSlot => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-col">${timeSlot}</td>`;

        days.forEach(day => {
            const td = document.createElement('td');
            const isBreak = config.break_times?.some(b => (typeof b === 'object' ? b.start : b).startsWith(timeSlot));

            if (isBreak) {
                td.innerHTML = '<div class="break-cell">BREAK</div>';
            } else {
                const entry = entries.find(e => e.day_of_week?.substring(0, 3) === day.substring(0, 3) && e.start_time?.startsWith(timeSlot));
                td.appendChild(entry ? buildEntryCell(entry, day, timeSlot) : buildEmptyCell(day, timeSlot));
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function buildEntryCell(entry, day, timeSlot) {
    // FIX: String coercion to ensure IDs match regardless of database type
    const cs = classSubjects.find(c => String(c.subject_id) === String(entry.subject_id));
    const name = cs?.Subjects?.subject_name || 'Unknown';
    const tName = cs?.Teachers ? `${cs.Teachers.first_name} ${cs.Teachers.last_name}` : 'No Teacher Assigned';

    const div = document.createElement('div');
    div.className = `entry-cell ${!entry.id ? 'unsaved' : ''}`;
    div.innerHTML = `
        <div class="entry-subject">${name}</div>
        <div class="entry-teacher">${tName}</div>
        <div class="cell-actions">
            <button class="cell-btn del" onclick="quickDelete('${entry.id || ''}','${day}','${timeSlot}')"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    div.onclick = (e) => { if (!e.target.closest('.cell-btn')) openModal(day, timeSlot, entry); };
    return div;
}

function buildEmptyCell(day, timeSlot) {
    const div = document.createElement('div');
    div.className = 'empty-cell';
    div.innerHTML = `<i class="fa-solid fa-plus"></i> Add`;
    div.onclick = () => openModal(day, timeSlot);
    return div;
}

// =============================================================================
// 4. MODAL & ACTIONS
// =============================================================================
window.openModal = (day, time, entryData) => {
    document.getElementById('modalDay').value = day;
    document.getElementById('modalTime').value = time;
    document.getElementById('modalEntryId').value = entryData?.id || '';
    document.getElementById('modalSubject').value = entryData?.subject_id || '';
    document.getElementById('modalDuration').value = entryData?.duration_minutes || config?.period_duration || 40;
    document.getElementById('modalDeleteBtn').style.display = entryData?.id ? 'inline-flex' : 'none';
    document.getElementById('entryModal').style.display = 'flex';
};

window.closeModal = () => document.getElementById('entryModal').style.display = 'none';

document.getElementById('entryForm').onsubmit = async (e) => {
    e.preventDefault();
    const entryId = document.getElementById('modalEntryId').value;
    const subjectIdValue = document.getElementById('modalSubject').value;

    const payload = {
        class_id: classId,
        day_of_week: document.getElementById('modalDay').value,
        start_time: document.getElementById('modalTime').value + ':00',
        subject_id: subjectIdValue,
        duration_minutes: parseInt(document.getElementById('modalDuration').value),
        school_id: schoolId
    };

    if (entryId) {
        await supabase.from('timetable_entries').update(payload).eq('id', entryId);
        location.reload();
    } else {
        entries.push({ ...payload, tempId: Date.now() });
        closeModal();
        renderWeeklyGrid();
        updateSaveButtonState();
    }
};

window.quickDelete = async (id, day, time) => {
    if (!confirm('Delete this entry?')) return;
    if (id) await supabase.from('timetable_entries').delete().eq('id', id);
    entries = entries.filter(e => !(e.day_of_week?.substring(0, 3) === day.substring(0, 3) && e.start_time?.startsWith(time)));
    renderWeeklyGrid();
    updateSaveButtonState();
};

window.previewUploadedData = (uploadedEntries) => {
    const newEntries = uploadedEntries.map(e => ({
        ...e,
        tempId: Date.now() + Math.random()
    }));
    entries = [...entries, ...newEntries];
    renderWeeklyGrid();
    updateSaveButtonState();
};

function updateSaveButtonState() {
    const unsavedCount = entries.filter(e => !e.id).length;
    const btn = document.getElementById('saveTimetableBtn');
    if (unsavedCount > 0) {
        btn.innerHTML = `<i class="fa-solid fa-save"></i> Save ${unsavedCount} Changes`;
        btn.classList.replace('btn-success', 'btn-warning');
    } else {
        btn.innerHTML = `<i class="fa-solid fa-save"></i> Save Timetable`;
        btn.classList.replace('btn-warning', 'btn-success');
    }
}

function setupSaveButton() {
    const btn = document.getElementById('saveTimetableBtn');
    if (!btn) return;

    btn.onclick = async () => {
        const unsaved = entries.filter(e => !e.id);
        if (!unsaved.length) {
            // If no changes, just go back
            window.location.href = '/admin/timeTable';
            return;
        }

        // 1. Visual Loading State
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finalizing Save...';

        try {
            const cleanData = unsaved.map(({ tempId, ...rest }) => ({
                ...rest,
                school_id: schoolId
            }));

            const { error } = await supabase.from('timetable_entries').insert(cleanData);

            if (error) throw error;

            // 2. Inform the User (Bridge the Evaluation Gulf)
            if (window.showToast) {
                showToast('Timetable saved successfully!', 'success');
            } else {
                alert('Timetable saved successfully!');
            }

            // 3. Redirect to the main timetable page after a short delay
            setTimeout(() => {
                window.location.href = '/admin/timeTable';
            }, 1500);

        } catch (error) {
            console.error('Save error:', error);
            if (window.showToast) {
                showToast('Error: ' + error.message, 'error');
            } else {
                alert('Error: ' + error.message);
            }
            btn.disabled = false;
            updateSaveButtonState();
        }
    };
}

function updateScheduleInfo() {
    if (!config) return;
    document.getElementById('scheduleInfo').innerHTML = `
        <strong>Config:</strong> ${config.start_time} | ${config.period_duration}m periods | ${config.periods_per_day} daily
    `;
}