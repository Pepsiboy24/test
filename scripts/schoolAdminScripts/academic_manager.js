// academic_manager.js
// Unified Academic Manager for School Admin Portal
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── State ────────────────────────────────────────────────────────────────────
let allSubjects = [];
let selectedSubject = null; // { subject_id, subject_name, is_core }
let pendingDeleteSubject = null; // for confirmation dialog
let pendingDeleteTopic = null;   // for confirmation dialog
let editingTopicId = null;       // when editing an existing topic

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupModalListeners();
    loadSubjects();

    // Subject search
    document.getElementById('subjectSearch').addEventListener('input', (e) => {
        renderSubjectList(e.target.value.trim().toLowerCase());
    });
});

// ─── Sidebar toggle (mobile) ─────────────────────────────────────────────────
function setupSidebar() {
    const sidebar = document.querySelector('[data-sideBar]');
    const openBtn = document.querySelector('[data-sideBarOpen]');
    const closeBtn = document.querySelector('[data-sideBarClose]');
    if (openBtn && sidebar) openBtn.addEventListener('click', () => sidebar.classList.add('show'));
    if (closeBtn && sidebar) closeBtn.addEventListener('click', () => sidebar.classList.remove('show'));
}

// ─── Load all subjects ────────────────────────────────────────────────────────
async function loadSubjects() {
    const { data, error } = await supabase
        .from('Subjects')
        .select('subject_id, subject_name, is_core')
        .order('subject_name');

    if (error) {
        console.error('Error loading subjects:', error);
        return;
    }

    allSubjects = data || [];
    document.getElementById('subjectCount').textContent = allSubjects.length;
    renderSubjectList('');

    // Re-select the previously selected subject if still present
    if (selectedSubject) {
        const found = allSubjects.find(s => s.subject_id === selectedSubject.subject_id);
        if (found) {
            selectedSubject = found;
            renderSubjectList(document.getElementById('subjectSearch').value.trim().toLowerCase());
            loadCurriculum(found);
        } else {
            selectedSubject = null;
            showEmptyState();
        }
    }
}

// ─── Render subject list ──────────────────────────────────────────────────────
function renderSubjectList(filter = '') {
    const container = document.getElementById('subjectsList');
    const filtered = filter
        ? allSubjects.filter(s => s.subject_name.toLowerCase().includes(filter))
        : allSubjects;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-gray)">
                <i class="fa-solid fa-search" style="font-size:28px;margin-bottom:10px;display:block;color:#cbd5e1"></i>
                <p style="font-size:13px">No subjects found</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const initials = s.subject_name.substring(0, 2).toUpperCase();
        const isActive = selectedSubject && selectedSubject.subject_id === s.subject_id;
        const typeLabel = s.is_core ? 'Core' : 'Elective';
        return `
            <div class="subject-item ${isActive ? 'active' : ''}"
                 data-id="${s.subject_id}"
                 onclick="selectSubject('${s.subject_id}')">
                <div class="si-left">
                    <div class="si-icon">${initials}</div>
                    <span class="si-name">${s.subject_name}</span>
                </div>
                <div class="si-right">
                    <span class="si-badge ${s.is_core ? 'core' : ''}">${typeLabel}</span>
                    <button class="si-action" title="Edit subject"
                            onclick="event.stopPropagation(); openEditSubjectModal('${s.subject_id}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="si-action delete" title="Delete subject"
                            onclick="event.stopPropagation(); confirmDeleteSubject('${s.subject_id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

// ─── Select a subject ─────────────────────────────────────────────────────────
window.selectSubject = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    selectedSubject = subject;
    renderSubjectList(document.getElementById('subjectSearch').value.trim().toLowerCase());
    loadCurriculum(subject);
};

// ─── Show empty state (no subject selected) ───────────────────────────────────
function showEmptyState() {
    document.getElementById('cpEmpty').style.display = 'flex';
    document.getElementById('cpDetail').style.display = 'none';
}

// ─── Load curriculum for selected subject ─────────────────────────────────────
async function loadCurriculum(subject) {
    document.getElementById('cpEmpty').style.display = 'none';
    document.getElementById('cpDetail').style.display = 'flex';

    // Update header
    document.getElementById('cpSubjectName').textContent = subject.subject_name;
    const badge = document.getElementById('cpTypeBadge');
    badge.textContent = subject.is_core ? 'Core' : 'Elective';
    badge.className = 'cp-type-badge ' + (subject.is_core ? 'core' : 'elective');

    // Show spinner
    const content = document.getElementById('cpContent');
    content.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;

    const { data, error } = await supabase
        .from('Curriculum')
        .select('*')
        .eq('subject_id', subject.subject_id)
        .order('week', { ascending: true });

    if (error) {
        content.innerHTML = `
            <div class="cp-error">
                <i class="fa-solid fa-circle-exclamation"></i>
                Failed to load curriculum: ${error.message}
            </div>`;
        return;
    }

    const topics = data || [];
    document.getElementById('cpTopicCount').textContent =
        topics.length === 0 ? 'No topics yet' :
            topics.length === 1 ? '1 topic' : `${topics.length} topics`;

    if (topics.length === 0) {
        content.innerHTML = `
            <div class="cp-no-topics">
                <i class="fa-solid fa-clipboard-list"></i>
                <p>No topics yet for this subject.<br>Click <strong>+ Add Topic</strong> to get started.</p>
            </div>`;
        return;
    }

    content.innerHTML = `<div class="topics-list">
        ${topics.map(t => renderTopicCard(t)).join('')}
    </div>`;
}

// ─── Render a single topic card ───────────────────────────────────────────────
function renderTopicCard(t) {
    const statusClass = t.status === 'Completed' ? 'completed' : 'pending';
    const statusLabel = t.status === 'Completed' ? 'Completed' : 'Pending';
    const description = t.description ? `<p class="tc-desc">${t.description}</p>` : '';
    return `
        <div class="topic-card" id="tc-${t.curriculum_id}">
            <div class="tc-week">
                <span>${t.week}</span>
                WK
            </div>
            <div class="tc-body">
                <div class="tc-name">${t.topic_name}</div>
                ${description}
                <span class="tc-status ${statusClass}">
                    <i class="fa-solid fa-${statusClass === 'completed' ? 'check-circle' : 'clock'}"></i>
                    ${statusLabel}
                </span>
            </div>
            <div class="tc-actions">
                <button class="tc-btn" title="Edit topic"
                        onclick="openEditTopicModal('${t.curriculum_id}', '${escHtml(t.topic_name)}', ${t.week}, '${escHtml(t.description || '')}', '${t.status}')">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="tc-btn delete" title="Delete topic"
                        onclick="confirmDeleteTopic('${t.curriculum_id}', '${escHtml(t.topic_name)}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
}

function escHtml(s) {
    return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
// Close on backdrop click
function setupModalListeners() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        }
    });
}

// ─── ADD SUBJECT ──────────────────────────────────────────────────────────────
window.openAddSubjectModal = function () {
    document.getElementById('addSubjectForm').reset();
    openModal('addSubjectModal');
};

document.getElementById('addSubjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('asName').value.trim();
    const isCore = document.querySelector('input[name="asType"]:checked')?.value === 'core';
    if (!name) return;

    const btn = document.getElementById('addSubjectBtn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const { error } = await supabase.from('Subjects').insert([{ subject_name: name, is_core: isCore }]);
    btn.disabled = false; btn.textContent = 'Add Subject';

    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    closeModal('addSubjectModal');
    await loadSubjects();
});

// ─── EDIT SUBJECT ─────────────────────────────────────────────────────────────
window.openEditSubjectModal = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    document.getElementById('esId').value = id;
    document.getElementById('esName').value = subject.subject_name;
    document.querySelector(`input[name="esType"][value="${subject.is_core ? 'core' : 'elective'}"]`).checked = true;
    openModal('editSubjectModal');
};

document.getElementById('editSubjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('esId').value;
    const name = document.getElementById('esName').value.trim();
    const isCore = document.querySelector('input[name="esType"]:checked')?.value === 'core';

    const btn = document.getElementById('editSubjectBtn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const { error } = await supabase.from('Subjects').update({ subject_name: name, is_core: isCore }).eq('subject_id', id);
    btn.disabled = false; btn.textContent = 'Save Changes';

    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    closeModal('editSubjectModal');
    await loadSubjects();
});

// ─── DELETE SUBJECT ───────────────────────────────────────────────────────────
window.confirmDeleteSubject = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    pendingDeleteSubject = subject;
    document.getElementById('dsSubjectName').textContent = subject.subject_name;
    openModal('deleteSubjectModal');
};

document.getElementById('confirmDeleteSubjectBtn').addEventListener('click', async () => {
    if (!pendingDeleteSubject) return;
    const btn = document.getElementById('confirmDeleteSubjectBtn');
    btn.disabled = true; btn.textContent = 'Deleting…';

    // Delete curriculum entries first, then the subject
    await supabase.from('Curriculum').delete().eq('subject_id', pendingDeleteSubject.subject_id);
    const { error } = await supabase.from('Subjects').delete().eq('subject_id', pendingDeleteSubject.subject_id);

    btn.disabled = false; btn.textContent = 'Yes, Delete';
    if (error) { showToast('Error: ' + error.message, 'error'); return; }

    if (selectedSubject && selectedSubject.subject_id === pendingDeleteSubject.subject_id) {
        selectedSubject = null;
        showEmptyState();
    }
    pendingDeleteSubject = null;
    closeModal('deleteSubjectModal');
    await loadSubjects();
});

// ─── ADD TOPIC ────────────────────────────────────────────────────────────────
window.openAddTopicModal = function () {
    if (!selectedSubject) return;
    editingTopicId = null;
    document.getElementById('topicModalTitle').textContent = 'Add Topic';
    document.getElementById('topicSaveBtn').textContent = 'Add Topic';
    document.getElementById('topicForm').reset();
    openModal('topicModal');
};

// ─── EDIT TOPIC ───────────────────────────────────────────────────────────────
window.openEditTopicModal = function (id, name, week, description, status) {
    editingTopicId = id;
    document.getElementById('topicModalTitle').textContent = 'Edit Topic';
    document.getElementById('topicSaveBtn').textContent = 'Save Changes';
    document.getElementById('tName').value = name;
    document.getElementById('tWeek').value = week;
    document.getElementById('tDescription').value = description;
    document.getElementById('tStatus').value = status || 'Pending';
    openModal('topicModal');
};

document.getElementById('topicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSubject) return;

    const name = document.getElementById('tName').value.trim();
    const week = parseInt(document.getElementById('tWeek').value);
    const description = document.getElementById('tDescription').value.trim();
    const status = document.getElementById('tStatus').value;

    const btn = document.getElementById('topicSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';

    let error;
    if (editingTopicId) {
        ({ error } = await supabase.from('Curriculum')
            .update({ topic_name: name, week, description, status })
            .eq('curriculum_id', editingTopicId));
    } else {
        ({ error } = await supabase.from('Curriculum')
            .insert([{ subject_id: selectedSubject.subject_id, topic_name: name, week, description, status }]));
    }

    btn.disabled = false;
    btn.textContent = editingTopicId ? 'Save Changes' : 'Add Topic';

    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    closeModal('topicModal');
    await loadCurriculum(selectedSubject);
});

// ─── DELETE TOPIC ─────────────────────────────────────────────────────────────
window.confirmDeleteTopic = function (id, name) {
    pendingDeleteTopic = id;
    document.getElementById('dtTopicName').textContent = name;
    openModal('deleteTopicModal');
};

document.getElementById('confirmDeleteTopicBtn').addEventListener('click', async () => {
    if (!pendingDeleteTopic) return;
    const btn = document.getElementById('confirmDeleteTopicBtn');
    btn.disabled = true; btn.textContent = 'Deleting…';

    const { error } = await supabase.from('Curriculum').delete().eq('curriculum_id', pendingDeleteTopic);
    btn.disabled = false; btn.textContent = 'Yes, Delete';

    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    pendingDeleteTopic = null;
    closeModal('deleteTopicModal');
    if (selectedSubject) await loadCurriculum(selectedSubject);
});

// ─── Expose close helpers to HTML ─────────────────────────────────────────────
window.closeModal = closeModal;
