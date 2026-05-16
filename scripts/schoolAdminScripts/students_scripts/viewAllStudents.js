// viewStudents.js
import { supabaseClient } from './supabase_client.js';

// --- Module-level migration state ---
let _migrationStudentId = null;
let _migrationCurrentClassId = null;
let _allClasses = []; // cached for migration dropdown
let _countMap = {};   // class_id → student count (for capacity warning)

// --- 1. Fetch Students ---
async function fetchStudents() {
    try {
        const { data, error } = await supabaseClient
            .from('Students')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching students:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error:', err);
        return [];
    }
}

// --- 2. Fetch Classes (To match the ID) ---
async function fetchClasses() {
    try {
        const { data, error } = await supabaseClient
            .from('Classes')
            .select('class_id, class_name, section');

        if (error) {
            console.error('Error fetching classes:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        return [];
    }
}

// --- Helper Functions ---

function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 'N/A';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function getInitials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
}

// --- 3. Filter Functions ---

function filterStudents(students, searchTerm) {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter(student => {
        const fullName = (student.full_name || '').toLowerCase();
        const studentId = (student.student_id || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        return fullName.includes(term) || studentId.includes(term) || email.includes(term);
    });
}

function filterStudentsByGrade(students, gradeFilter, classMap) {
    if (gradeFilter === 'all') return students;
    return students.filter(student => {
        const className = classMap[student.class_id] || '';
        const classNameLower = className.toLowerCase();
        if (gradeFilter === 'primary') return classNameLower.includes('primary');
        if (gradeFilter === 'secondary') return classNameLower.includes('jss') || classNameLower.includes('ss');
        return false;
    });
}

// --- 4. Render Logic ---

function renderStudents(students, classMap = {}) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">No students found.</td></tr>`;
        return;
    }

    students.forEach(student => {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);
        const classDisplayText = classMap[student.class_id] || 'Not Assigned';
        const attendancePercent = 85; // Placeholder

        const row = `
            <tr class="student-row">
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-details">
                            <h4>${student.full_name || 'Unknown'}</h4>
                            <p>ID: #${student.student_id ? student.student_id.substr(0, 8) : 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td>${age}</td>
                <td>
                    <div class="class-badge">${classDisplayText}</div>
                </td>
                <td>
                    <div class="attendance-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${attendancePercent}%;"></div>
                        </div>
                        <span class="attendance-percent">${attendancePercent}%</span>
                    </div>
                </td>
                <td style="display:flex; gap:6px; align-items:center;">
                    <a href="#" class="action-btn" data-student-id="${student.student_id}">View</a>
                    <button
                        class="action-btn"
                        style="background:#ede7f6; color:#6200ea; border:none; cursor:pointer; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;"
                        onclick="window.openMigrationModal('${student.student_id}', ${student.class_id ?? 'null'}, '${(student.full_name || '').replace(/'/g, "\\'")}')">
                        &#8644; Change Class
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// --- 5. Migration Modal Logic ---

window.openMigrationModal = function (studentId, currentClassId, studentName) {
    _migrationStudentId = studentId;
    _migrationCurrentClassId = currentClassId;

    const nameEl = document.getElementById('migrationStudentName');
    const select = document.getElementById('migrationClassSelect');
    const warning = document.getElementById('migrationCapacityWarning');

    if (nameEl) nameEl.textContent = studentName || '';
    if (warning) warning.style.display = 'none';

    // Populate dropdown — exclude current class
    if (select) {
        select.innerHTML = '<option value="">Select a class...</option>';
        _allClasses.forEach(cls => {
            if (cls.class_id == currentClassId) return; // exclude current
            const label = `${cls.class_name}${cls.section ? ' - ' + cls.section : ''}`;
            const opt = document.createElement('option');
            opt.value = cls.class_id;
            opt.textContent = label;
            select.appendChild(opt);
        });

        // Capacity warning on change
        select.onchange = () => {
            const selectedId = parseInt(select.value);
            if (!selectedId || !warning) return;
            const count = _countMap[selectedId] ?? 0;
            warning.style.display = count >= 40 ? 'block' : 'none';
        };
    }

    document.getElementById('migrationModal').style.display = 'block';
    document.getElementById('migrationOverlay').style.display = 'block';
};

window.closeMigrationModal = function () {
    document.getElementById('migrationModal').style.display = 'none';
    document.getElementById('migrationOverlay').style.display = 'none';
    _migrationStudentId = null;
    _migrationCurrentClassId = null;
};

async function executeMigration() {
    const select = document.getElementById('migrationClassSelect');
    const targetClassId = select ? parseInt(select.value) : null;

    if (!targetClassId) {
        showToast('Please select a destination class.', 'warning');
        return;
    }
    if (!_migrationStudentId) return;

    const btn = document.getElementById('migrationConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Moving...'; }

    try {
        const { error } = await supabaseClient
            .from('Students')
            .update({ class_id: targetClassId })
            .eq('student_id', _migrationStudentId);

        if (error) throw error;

        window.closeMigrationModal();
        // Refresh the list
        if (window.refreshStudentList) await window.refreshStudentList();

    } catch (err) {
        console.error('Migration error:', err);
        showToast('Failed to move student: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Move Student'; }
    }
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading students...');
    let allStudents = await fetchStudents();
    let classes = await fetchClasses();
    _allClasses = classes; // cache for migration modal

    let classMap = {};
    classes.forEach(cls => {
        classMap[cls.class_id] = `${cls.class_name} ${cls.section || ''}`.trim();
    });

    // Build student count map for capacity warnings
    allStudents.forEach(s => {
        if (s.class_id != null) {
            _countMap[s.class_id] = (_countMap[s.class_id] || 0) + 1;
        }
    });

    let currentSearchTerm = '';
    let currentGradeFilter = 'all';

    function applyFilters() {
        let filtered = [...allStudents];
        if (currentSearchTerm) filtered = filterStudents(filtered, currentSearchTerm);
        if (currentGradeFilter !== 'all') filtered = filterStudentsByGrade(filtered, currentGradeFilter, classMap);
        renderStudents(filtered, classMap);
    }

    applyFilters();
    console.log(`Loaded ${allStudents.length} students`);

    // Search
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            currentSearchTerm = this.value.trim();
            applyFilters();
        });
    }

    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentGradeFilter = this.textContent.toLowerCase();
            applyFilters();
        });
    });

    // Migration confirm button
    const confirmBtn = document.getElementById('migrationConfirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', executeMigration);

    // Overlay click to close
    const overlay = document.getElementById('migrationOverlay');
    if (overlay) overlay.addEventListener('click', window.closeMigrationModal);
});

window.refreshStudentList = async () => {
    const allStudents = await fetchStudents();
    const classes = await fetchClasses();
    _allClasses = classes;
    _countMap = {};
    allStudents.forEach(s => {
        if (s.class_id != null) _countMap[s.class_id] = (_countMap[s.class_id] || 0) + 1;
    });
    const classMap = {};
    classes.forEach(cls => {
        classMap[cls.class_id] = `${cls.class_name} ${cls.section || ''}`.trim();
    });
    renderStudents(allStudents, classMap);
};

export { fetchStudents };
