/**
 * manage_notes.js
 * ─────────────────────────────────────────────────────────────────
 * Shared script for html/shared/manage_notes.html
 *
 * Roles:
 *   ADMIN   → page title "Global Notes Management", fetches ALL notes
 *             with teacher name via Teachers join
 *   TEACHER → page title "My Lesson Notes", filters by uploaded_by
 *
 * Dual-Delete safety:
 *   Storage delete is attempted first. If it hard-errors the DB row
 *   is NOT deleted (no broken records). Storage 404s are treated as
 *   soft-warnings (file already gone → DB row is still cleaned up).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://dzotwozhcxzkxtunmqth.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── DOM refs ──────────────────────────────────────────────────── */
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const notesBody = document.getElementById('notesBody');
const searchInput = document.getElementById('searchInput');
const deleteModal = document.getElementById('deleteModal');
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');
const loadingRow = document.getElementById('loadingRow');
const uploaderHeader = document.getElementById('uploaderHeader');
const noteCountEl = document.getElementById('noteCount');

let allNotes = [];
let pendingDeleteId = null;
let pendingFilePath = null;
let currentRole = null;

/* ── Helpers ───────────────────────────────────────────────────── */
function escAttr(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Derive the storage path from a public URL if file_path column is missing. */
function deriveFilePath(publicUrl) {
    if (!publicUrl) return '';
    try {
        const url = new URL(publicUrl);
        const marker = '/lesson-notes/';
        const idx = url.pathname.indexOf(marker);
        return idx !== -1 ? url.pathname.slice(idx + marker.length) : '';
    } catch {
        return '';
    }
}

function setNoteCount(n) {
    if (noteCountEl) noteCountEl.textContent = `${n} note${n !== 1 ? 's' : ''}`;
}

/* ── Row builder ───────────────────────────────────────────────── */
function buildRow(note) {
    const cls = note.Classes?.class_name ?? '—';
    const section = note.Classes?.section ?? '';
    const subject = note.Subjects?.subject_name ?? '—';
    const uploadDate = note.created_at
        ? new Date(note.created_at).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        })
        : '—';

    const fileUrl = note.file_url || '';
    const filePath = note.file_path || deriveFilePath(fileUrl);
    const noteId = note.id ?? '';
    const title = note.title ?? 'Untitled';

    const uploaderCell = currentRole === 'ADMIN'
        ? `<td data-label="Uploaded By">${escAttr(note.Teachers?.first_name ?? '')} ${escAttr(note.Teachers?.last_name ?? '')}</td>`
        : '';

    const viewBtn = fileUrl
        ? `<button class="btn btn-view" onclick="window.open('${escAttr(fileUrl)}','_blank')">
               <i class="fas fa-eye"></i> View
           </button>`
        : `<button class="btn btn-view" disabled title="No file attached">No file</button>`;

    const deleteBtn = `<button
        class="btn btn-delete"
        data-note-id="${escAttr(String(noteId))}"
        data-file-path="${escAttr(filePath)}"
        onclick="openDeleteModal(this)">
        <i class="fas fa-trash-alt"></i> Delete
    </button>`;

    return `
        <tr>
            <td class="title-cell" data-label="Title">${escAttr(title)}</td>
            <td data-label="Class">${escAttr(cls)}${section ? ' – ' + escAttr(section) : ''}</td>
            <td data-label="Subject">${escAttr(subject)}</td>
            <td data-label="Date">${escAttr(uploadDate)}</td>
            ${uploaderCell}
            <td class="actions-cell" data-label="Actions">${viewBtn} ${deleteBtn}</td>
        </tr>`;
}

function renderRows(notes) {
    const colSpan = currentRole === 'ADMIN' ? 6 : 5;
    if (!notes.length) {
        notesBody.innerHTML = `<tr><td colspan="${colSpan}" class="empty-state">
            <i class="fas fa-folder-open" style="font-size:36px;margin-bottom:10px;display:block;"></i>
            No notes found.
        </td></tr>`;
        return;
    }
    notesBody.innerHTML = notes.map(note => buildRow(note)).join('');
    setNoteCount(notes.length);
}

/* ── Delete modal ──────────────────────────────────────────────── */
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

cancelDelete.addEventListener('click', closeModal);
deleteModal.addEventListener('click', e => { if (e.target === deleteModal) closeModal(); });

/**
 * Dual-Delete:
 *   1. Remove file from Supabase Storage first.
 *      - If storage returns a hard error (not a 404 "not found"), abort
 *        and leave the DB row intact (no broken state).
 *      - If the file was already missing (404), treat as a soft-warning
 *        and continue to clean up the DB row.
 *   2. Only on storage success (or soft 404) → delete the DB record.
 */
async function doDelete() {
    if (!pendingDeleteId) return;
    confirmDelete.disabled = true;
    confirmDelete.textContent = 'Deleting…';

    try {
        // ── Step 1: Storage delete ─────────────────────────────
        if (pendingFilePath) {
            const { error: storageErr } = await supabaseClient.storage
                .from('lesson-notes')
                .remove([pendingFilePath]);

            if (storageErr) {
                // Treat "Object not found" as acceptable (file already gone)
                const alreadyGone = storageErr.message?.toLowerCase().includes('not found')
                    || storageErr.statusCode === 404;

                if (!alreadyGone) {
                    // Hard storage error — bail out, keep DB row safe
                    throw new Error(`Storage error: ${storageErr.message}`);
                }
                console.warn('[manage_notes] File not found in storage (already removed?):', pendingFilePath);
            }
        }

        // ── Step 2: DB delete ──────────────────────────────────
        const { error: dbErr } = await supabaseClient
            .from('Lesson_Notes')
            .delete()
            .eq('id', pendingDeleteId);

        if (dbErr) throw new Error(`Database error: ${dbErr.message}`);

        // Update UI
        allNotes = allNotes.filter(n => String(n.id) !== String(pendingDeleteId));
        renderRows(allNotes);
        setNoteCount(allNotes.length);

    } catch (err) {
        if (typeof showToast === 'function') {
            showToast('Delete failed — ' + err.message + '. The note record has been kept safe.', 'error', 7000);
        } else {
            console.error('Delete failed — ' + err.message);
        }
        console.error('[manage_notes] doDelete error:', err);
    } finally {
        confirmDelete.disabled = false;
        confirmDelete.textContent = 'Delete';
        closeModal();
    }
}

confirmDelete.addEventListener('click', doDelete);

/* ── Search ────────────────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) { renderRows(allNotes); return; }
    renderRows(allNotes.filter(n =>
        (n.title ?? '').toLowerCase().includes(q) ||
        (n.Classes?.class_name ?? '').toLowerCase().includes(q) ||
        (n.Subjects?.subject_name ?? '').toLowerCase().includes(q)
    ));
});

/* ── Bootstrap ─────────────────────────────────────────────────── */
async function bootstrap() {
    // 1. Authenticated user check
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !user) {
        setLoadingMessage('Not authenticated. Please log in.');
        console.error('[manage_notes] auth error:', authErr);
        return;
    }

    console.log('[manage_notes] Checking role for user:', user.id, user.email);

    // 2. Role detection — run both queries in parallel for speed.
    //
    //    School_Admin schema:
    //      PK = admin_id (auto UUID), NO user_id column → match by email
    //
    //    Teachers schema:
    //      PK = teacher_id (UUID set to auth user.id on registration)
    //      → match by teacher_id = user.id
    const [
        { data: adminRow, error: adminErr },
        { data: teacherRow, error: teacherErr }
    ] = await Promise.all([
        supabaseClient
            .from('School_Admin')
            .select('admin_id, email')
            .eq('email', user.email)
            .maybeSingle(),
        supabaseClient
            .from('Teachers')
            .select('teacher_id')
            .eq('teacher_id', user.id)
            .maybeSingle()
    ]);

    console.log('[manage_notes] adminRow:', adminRow, 'adminErr:', adminErr);
    console.log('[manage_notes] teacherRow:', teacherRow, 'teacherErr:', teacherErr);

    if (!adminErr && adminRow) {
        currentRole = 'ADMIN';
    } else if (!teacherErr && teacherRow) {
        currentRole = 'TEACHER';
    }

    if (!currentRole) {
        setLoadingMessage('Access denied. Only Admins and Teachers can view this page.');
        console.warn('[manage_notes] No matching admin or teacher row found for user:', user.id, user.email);
        return;
    }

    console.log('[manage_notes] Role resolved:', currentRole);

    // 3. Set role-specific page titles
    if (currentRole === 'ADMIN') {
        if (pageTitle) pageTitle.textContent = 'Global Notes Management';
        if (pageSubtitle) pageSubtitle.textContent = 'All lesson notes uploaded across every class and teacher.';
        document.title = 'Global Notes Management – EduHub Admin';
        if (uploaderHeader) uploaderHeader.style.display = '';
    } else {
        if (pageTitle) pageTitle.textContent = 'My Lesson Notes';
        if (pageSubtitle) pageSubtitle.textContent = 'Lesson notes you have uploaded for your classes.';
        document.title = 'My Lesson Notes – EduHub Teacher';
    }

    // 4. Build select — always join Subjects and Classes; add Teachers for Admin
    const select = currentRole === 'ADMIN'
        ? '*, Subjects(subject_name), Classes(class_name, section), Teachers(first_name, last_name)'
        : '*, Subjects(subject_name), Classes(class_name, section)';

    let query = supabaseClient
        .from('Lesson_Notes')
        .select(select)
        .order('created_at', { ascending: false });

    // 5. Teacher filter
    if (currentRole === 'TEACHER') {
        query = query.eq('teacher_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
        setLoadingMessage('Failed to fetch notes: ' + error.message);
        console.error('[manage_notes] fetch error:', error);
        return;
    }

    if (loadingRow) loadingRow.style.display = 'none';
    allNotes = data ?? [];
    renderRows(allNotes);
}

function setLoadingMessage(msg) {
    if (loadingRow) {
        loadingRow.querySelector('td').innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
    }
}

bootstrap();
