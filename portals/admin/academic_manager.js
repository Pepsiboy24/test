// academic_manager.js
// Unified Academic Manager for School Admin Portal
import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

// ─── State ────────────────────────────────────────────────────────────────────
let allSubjects = [];
let selectedSubject = null;
let currentTab = 'curriculum';

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupModalListeners();
    loadSubjects();

    // Safety checks for event listeners to prevent "null" errors
    const searchInput = document.getElementById('subjectSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderSubjectList(e.target.value.trim().toLowerCase());
        });
    }

    const allocationForm = document.getElementById('allocationForm');
    if (allocationForm) {
        allocationForm.addEventListener('submit', handleAllocationSubmit);
    }
    
    const addSubjectForm = document.getElementById('addSubjectForm');
    if (addSubjectForm) {
        addSubjectForm.addEventListener('submit', handleAddSubjectSubmit);
    }
});

function setupSidebar() {
    const sidebar = document.querySelector('[data-sideBar]');
    const openBtn = document.querySelector('[data-sideBarOpen]');
    const closeBtn = document.querySelector('[data-sideBarClose]');
    if (openBtn && sidebar) openBtn.addEventListener('click', () => sidebar.classList.add('show'));
    if (closeBtn && sidebar) closeBtn.addEventListener('click', () => sidebar.classList.remove('show'));
}

// ─── Global Window Functions (Fixed for onclick access) ──────────────────────
window.openAddSubjectModal = function() {
    const form = document.getElementById('addSubjectForm');
    if (form) form.reset();
    openModal('addSubjectModal');
};

window.openEditSubjectModal = function(id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    document.getElementById('esId').value = subject.subject_id;
    document.getElementById('esName').value = subject.subject_name;
    if (subject.is_core) document.getElementById('esCore').checked = true;
    else document.getElementById('esElective').checked = true;
    openModal('editSubjectModal');
};

// ─── Load all subjects ────────────────────────────────────────────────────────
async function loadSubjects() {
    try {
        const user = await waitForUser();
        if (!user?.user_metadata?.school_id) {
            console.error('Cannot determine school_id from user metadata');
            return;
        }

        const schoolId = user.user_metadata.school_id;
        const { data, error } = await supabase
            .from('Subjects')
            .select('subject_id, subject_name, is_core')
            .eq('school_id', schoolId)
            .order('subject_name');

        if (error) throw error;

        allSubjects = data || [];
        const countEl = document.getElementById('subjectCount');
        if (countEl) countEl.textContent = allSubjects.length;
        renderSubjectList('');
    } catch (err) {
        console.error('Error in loadSubjects:', err);
    }
}

function renderSubjectList(filter = '') {
    const container = document.getElementById('subjectsList');
    if (!container) return;

    const filtered = filter
        ? allSubjects.filter(s => s.subject_name.toLowerCase().includes(filter))
        : allSubjects;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-gray)"><p>No subjects found</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const initials = s.subject_name.substring(0, 2).toUpperCase();
        const isActive = selectedSubject && selectedSubject.subject_id === s.subject_id;
        return `
            <div class="subject-item ${isActive ? 'active' : ''}" onclick="selectSubject('${s.subject_id}')">
                <div class="si-left">
                    <div class="si-icon">${initials}</div>
                    <span class="si-name">${s.subject_name}</span>
                </div>
                <div class="si-right">
                    <span class="si-badge ${s.is_core ? 'core' : ''}">${s.is_core ? 'Core' : 'Elective'}</span>
                    <button class="si-action" onclick="event.stopPropagation(); window.openEditSubjectModal('${s.subject_id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="si-action delete" onclick="event.stopPropagation(); window.confirmDeleteSubject('${s.subject_id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    }).join('');
}

window.selectSubject = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    selectedSubject = subject;
    
    const searchVal = document.getElementById('subjectSearch')?.value || '';
    renderSubjectList(searchVal.trim().toLowerCase());

    if (currentTab === 'curriculum') loadCurriculum(subject);
    else loadAssignments(subject);
};

// ─── Assignments Functions ───────────────────────────────────────────────────
async function loadAssignments(subject) {
    try {
        const user = await waitForUser();
        const schoolId = user?.user_metadata?.school_id;

        const content = document.getElementById('cpContent');
        if (content) content.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;

        const { data: allocations, error } = await supabase
            .from('Subject_Allocations')
            .select(`
                *,
                Subjects(subject_name),
                Classes(class_name, section),
                Teachers(first_name, last_name)
            `)
            .eq('subject_id', subject.subject_id)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderAssignmentsTable(allocations || []);
    } catch (err) {
        console.error('Error loading assignments:', err);
        const content = document.getElementById('cpContent');
        if (content) content.innerHTML = `<div class="cp-error">Failed to load assignments.</div>`;
    }
}

function renderAssignmentsTable(allocations) {
    const content = document.getElementById('cpContent');
    if (!content) return;

    if (allocations.length === 0) {
        content.innerHTML = `<div class="cp-no-topics"><p>No assignments found.</p><button class="btn-primary" onclick="openAllocationModal()">Assign to Class</button></div>`;
        return;
    }

    content.innerHTML = `
        <div class="assignments-header">
            <h3>Class Assignments</h3>
            <button class="btn-primary" onclick="openAllocationModal()">+ Assign to Class</button>
        </div>
        <div class="assignments-table">
            <table>
                <thead>
                    <tr>
                        <th>Class</th>
                        <th>Teacher</th>
                        <th>Year</th>
                        <th>Term</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allocations.map(a => `
                        <tr>
                            <td>${a.Classes?.class_name || ''} ${a.Classes?.section || ''}</td>
                            <td>${a.Teachers?.first_name || ''} ${a.Teachers?.last_name || ''}</td>
                            <td>${a.academic_year || 'N/A'}</td>
                            <td>${a.term || 'N/A'}</td>
                            <td>
                                <button class="btn-danger btn-sm" onclick="removeAllocation('${a.allocation_id}')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

// ─── Allocation Logic ────────────────────────────────────────────────────────
async function handleAllocationSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveAllocationBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
    }

    try {
        const user = await waitForUser();
        const schoolId = user.user_metadata.school_id;
        const classId = parseInt(document.getElementById('allocationClass').value);
        const subjectId = selectedSubject.subject_id;
        const teacherId = document.getElementById('allocationTeacher').value;

        const { error: rosterError } = await supabase
            .from('Class_Subjects')
            .upsert({
                class_id: classId,
                subject_id: subjectId,
                school_id: schoolId
            }, { onConflict: 'class_id, subject_id' });

        if (rosterError) throw rosterError;

        const { error: allocError } = await supabase
            .from('Subject_Allocations')
            .insert([{
                subject_id: subjectId,
                class_id: classId,
                teacher_id: teacherId,
                academic_year: document.getElementById('allocationAcademicYear').value,
                term: document.getElementById('allocationTerm').value,
                school_id: schoolId,
                created_by: user.email
            }]);

        if (allocError) throw allocError;

        showToast('Assignment saved and student roster updated!', 'success');
        closeModal('allocationModal');
        loadAssignments(selectedSubject);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Save Assignment';
        }
    }
}

// ─── Add Subject Logic ───────────────────────────────────────────────────────
async function handleAddSubjectSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('addSubjectBtn');
    const name = document.getElementById('asName').value.trim();
    const isCore = document.getElementById('asCore').checked;

    try {
        const user = await waitForUser();
        const schoolId = user.user_metadata.school_id;

        const { error } = await supabase.from('Subjects').insert([{
            subject_name: name,
            is_core: isCore,
            school_id: schoolId
        }]);

        if (error) throw error;

        showToast('Subject added successfully', 'success');
        closeModal('addSubjectModal');
        loadSubjects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.removeAllocation = async function (allocationId) {
    if (!confirm('Are you sure?')) return;

    try {
        const user = await waitForUser();
        const schoolId = user?.user_metadata?.school_id;

        const { data: target } = await supabase
            .from('Subject_Allocations')
            .select('subject_id, class_id')
            .eq('allocation_id', allocationId)
            .single();

        await supabase.from('Subject_Allocations').delete().eq('allocation_id', allocationId);

        const { data: remaining } = await supabase
            .from('Subject_Allocations')
            .select('allocation_id')
            .eq('subject_id', target.subject_id)
            .eq('class_id', target.class_id);

        if (!remaining || remaining.length === 0) {
            await supabase
                .from('Class_Subjects')
                .delete()
                .eq('subject_id', target.subject_id)
                .eq('class_id', target.class_id)
                .eq('school_id', schoolId);
        }

        showToast('Assignment removed successfully', 'success');
        loadAssignments(selectedSubject);
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ─── Shared UI Helpers ────────────────────────────────────────────────────────
window.openAllocationModal = function () {
    if (!selectedSubject) return showToast('Select a subject first', 'warning');
    document.getElementById('allocationForm').reset();
    populateAllocationDropdowns();
    openModal('allocationModal');
};

async function populateAllocationDropdowns() {
    try {
        const user = await waitForUser();
        const schoolId = user?.user_metadata?.school_id;

        const [classesRes, teachersRes] = await Promise.all([
            supabase.from('Classes').select('class_id, class_name, section').eq('school_id', schoolId).order('class_name'),
            supabase.from('Teachers').select('teacher_id, first_name, last_name').eq('school_id', schoolId).eq('employment_status', 'active').order('first_name')
        ]);

        document.getElementById('allocationClass').innerHTML = '<option value="">Select a class...</option>' +
            (classesRes.data || []).map(cls => `<option value="${cls.class_id}">${cls.class_name} ${cls.section || ''}</option>`).join('');

        document.getElementById('allocationTeacher').innerHTML = '<option value="">Select a teacher...</option>' +
            (teachersRes.data || []).map(t => `<option value="${t.teacher_id}">${t.first_name} ${t.last_name}</option>`).join('');
    } catch (err) { console.error('Dropdown init failed:', err); }
}

function openModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active'); 
}
function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active'); 
}
window.closeModal = closeModal;
window.openModal = openModal;

function setupModalListeners() {
    document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', (e) => { if (e.target === o) closeModal(o.id); }));
}

window.switchTab = function (tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    if (selectedSubject) tabName === 'curriculum' ? loadCurriculum(selectedSubject) : loadAssignments(selectedSubject);
};

async function loadCurriculum(subject) {
    const emptyEl = document.getElementById('cpEmpty');
    const detailEl = document.getElementById('cpDetail');
    if (emptyEl) emptyEl.style.display = 'none';
    if (detailEl) detailEl.style.display = 'flex';
    document.getElementById('cpSubjectName').textContent = subject.subject_name;
}