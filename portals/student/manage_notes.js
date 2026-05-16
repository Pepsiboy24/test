/**
 * manage_notes.js — Final Stabilized Version
 */

import { supabase } from '/core/config.js';
import { waitForUser } from '/core/perf.js';

const supabaseClient = supabase;
/* ── DOM refs ──────────────────────────────────────────── */
const notesBody = document.getElementById('notesBody');
const searchInput = document.getElementById('searchInput');
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const noteCountEl = document.getElementById('noteCount');
const loadingRow = document.getElementById('loadingRow'); // <--- ADD THIS LINE


/* ── DOM refs ──────────────────────────────────────────── */
// const notesBody = document.getElementById('notesBody');
// const searchInput = document.getElementById('searchInput');
// const deleteModal = document.getElementById('deleteModal');
// const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
// const noteCountEl = document.getElementById('noteCount');

let allNotes = [];
let pendingDeleteId = null;
let pendingFilePath = null;
let currentRole = null;
let currentSchoolId = null;

/* ── Helpers ───────────────────────────────────────────────────── */
function escAttr(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function deriveFilePath(publicUrl) {
    if (!publicUrl) return '';
    try {
        const url = new URL(publicUrl);
        const marker = '/lesson-notes/';
        const idx = url.pathname.indexOf(marker);
        return idx !== -1 ? url.pathname.slice(idx + marker.length) : '';
    } catch { return ''; }
}

/* ── Row builder ───────────────────────────────────────────────── */
function buildRow(note) {
    const cls = note.Classes?.class_name ?? '—';
    const section = note.Classes?.section ?? '';
    const subject = note.Subjects?.subject_name ?? '—';
    const uploadDate = note.created_at ? new Date(note.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const fileUrl = note.file_url || '';
    const filePath = note.file_path || deriveFilePath(fileUrl);

    const uploaderCell = currentRole === 'ADMIN'
        ? `<td data-label="Uploaded By">${escAttr(note.Teachers?.first_name ?? '')} ${escAttr(note.Teachers?.last_name ?? '')}</td>`
        : '';

    return `
        <tr>
            <td class="title-cell" data-label="Title">${escAttr(note.title ?? 'Untitled')}</td>
            <td data-label="Class">${escAttr(cls)}${section ? ' – ' + escAttr(section) : ''}</td>
            <td data-label="Subject">${escAttr(subject)}</td>
            <td data-label="Date">${escAttr(uploadDate)}</td>
            ${uploaderCell}
            <td class="actions-cell" data-label="Actions">
                <button class="btn btn-view" onclick="window.open('${escAttr(fileUrl)}','_blank')"><i class="fas fa-eye"></i> View</button>
                <button class="btn btn-delete" data-note-id="${note.id}" data-file-path="${filePath}" onclick="openDeleteModal(this)"><i class="fas fa-trash-alt"></i> Delete</button>
            </td>
        </tr>`;
}

function renderRows(notes) {
    const colSpan = currentRole === 'ADMIN' ? 6 : 5;
    if (!notes.length) {
        notesBody.innerHTML = `<tr><td colspan="${colSpan}" class="empty-state">No notes found.</td></tr>`;
        return;
    }
    notesBody.innerHTML = notes.map(note => buildRow(note)).join('');
    if (noteCountEl) noteCountEl.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
}

/* ── Modal Control ────────────────────────────────────────────── */
window.openDeleteModal = function (btn) {
    pendingDeleteId = btn.dataset.noteId;
    pendingFilePath = btn.dataset.filePath || '';
    deleteModal.classList.add('show');
};

function closeModal() {
    deleteModal.classList.remove('show');
    pendingDeleteId = null;
    pendingFilePath = null;
}
// Remove the problematic event listener - buttons use onclick directly

/* ── Delete Action ────────────────────────────────────────────── */
async function doDelete() {
    if (!pendingDeleteId) return;
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting…';

    try {
        if (pendingFilePath) {
            await supabaseClient.storage.from('lesson-notes').remove([pendingFilePath]);
        }
        const { error } = await supabaseClient.from('Lesson_Notes').delete().eq('id', pendingDeleteId);
        if (error) throw error;

        allNotes = allNotes.filter(n => String(n.id) !== String(pendingDeleteId));
        renderRows(allNotes);
        closeModal();
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Delete';
    }
}
// Event listener removed - button uses onclick directly

/* ── Bootstrap (The Fix) ───────────────────────────────────────── */
async function bootstrap() {
    const user = await waitForUser();

    if (!user) {
        window.location.href = '/login';
        return;
    }

    currentSchoolId = user.user_metadata?.school_id;

    // FIX 1: Detect role from Metadata first (instant and reliable)
    const userType = user.user_metadata?.user_type || user.user_metadata?.role;

    if (userType === 'school_admin' || userType === 'admin') {
        currentRole = 'ADMIN';
    } else if (userType === 'teacher') {
        currentRole = 'TEACHER';
    }

    // FIX 2: Database fallback if metadata is missing
    if (!currentRole) {
        const [adminRes, teacherRes] = await Promise.all([
            supabaseClient.from('School_Admin').select('admin_id').eq('email', user.email).maybeSingle(),
            supabaseClient.from('Teachers').select('id, teacher_id, user_id').eq('id', user.id).maybeSingle()
            // We check generic 'id' above to cover all potential column naming schemes
        ]);

        if (adminRes.data) currentRole = 'ADMIN';
        else if (teacherRes.data) currentRole = 'TEACHER';
    }

    // Guard Clause
    if (!currentRole) {
        if (loadingRow) loadingRow.querySelector('td').innerHTML = 'Access Denied. Role not recognized.';
        setTimeout(() => window.location.href = '/login', 2500);
        return;
    }

    // Setup UI Titles - Commented out since pageTitle element doesn't exist
    // if (currentRole === 'ADMIN') {
    //     pageTitle.textContent = 'Global Notes Management';
    //     if (uploaderHeader) uploaderHeader.style.display = '';
    // } else {
    //     pageTitle.textContent = 'My Lesson Notes';
    // }

    // Fetch Notes based on Role
    const selection = currentRole === 'ADMIN'
        ? '*, Subjects(subject_name), Classes(class_name, section), Teachers(first_name, last_name)'
        : '*, Subjects(subject_name), Classes(class_name, section)';

    let query = supabaseClient.from('Lesson_Notes').select(selection).eq('school_id', currentSchoolId);

    if (currentRole === 'TEACHER') {
        query = query.eq('teacher_id', user.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    if (loadingRow) loadingRow.style.display = 'none';
    allNotes = data ?? [];
    renderRows(allNotes);
}

bootstrap();