import { supabase } from '../../core/config.js';
import { waitForUser, debounce } from '../../core/perf.js';

let currentTeacherId = null;
let currentSchoolId = null;

// 1. AUTH GUARD
async function checkTeacherLogin() {
    try {
        const user = await waitForUser();
        if (!user) {
            window.location.href = '/login';
            return null;
        }

        const { data: teacherData, error: tErr } = await supabase
            .from('Teachers')
            .select('teacher_id, school_id')
            .eq('teacher_id', user.id)
            .single();

        if (tErr || !teacherData) {
            await supabase.auth.signOut();
            window.location.href = '/login';
            return null;
        }

        currentTeacherId = user.id;
        currentSchoolId = teacherData.school_id;
        return user.id;
    } catch (err) {
        return null;
    }
}

// 2. FETCH CLASSES (Only where this teacher is the Form Teacher)
async function fetchTeacherClasses(teacherId) {
    try {
        const { data, error } = await supabase
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('teacher_id', teacherId); // Fetches classes where they are the assigned head

        return error ? [] : data;
    } catch (err) {
        return [];
    }
}

// 3. FETCH SUBJECTS FOR CLASS
async function fetchSubjectsForClass(classId) {
    const { data, error } = await supabase
        .from('Subjects')
        .select('subject_id, subject_name')
        .eq('class_id', classId);
    
    return error ? [] : data;
}

// 4. FETCH STUDENTS
async function fetchStudentsFromClass(classId) {
    const { data, error } = await supabase
        .from('Students')
        .select('*')
        .eq('class_id', classId)
        .eq('school_id', currentSchoolId)
        .eq('enrollment_status', 'active')
        .order('full_name', { ascending: true });

    return error ? [] : data;
}

// 4. RENDER UI
function renderStudents(students) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem;">No active students in this class.</td></tr>`;
        return;
    }

    students.forEach(student => {
        const initials = student.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const row = `
            <tr data-student-id="${student.student_id}">
                <td>
                    <div class="student-name">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-info"><p>${student.full_name}</p></div>
                    </div>
                </td>
                <td>
                    <div class="attendance-options">
                        <div class="radio-group present">
                            <input type="radio" name="att-${student.student_id}" value="present" id="p-${student.student_id}" onchange="updateSummary()">
                            <label for="p-${student.student_id}">Present</label>
                        </div>
                        <div class="radio-group absent">
                            <input type="radio" name="att-${student.student_id}" value="absent" id="a-${student.student_id}" onchange="updateSummary()">
                            <label for="a-${student.student_id}">Absent</label>
                        </div>
                    </div>
                </td>
                <td><input type="text" class="remarks-input" placeholder="Notes..."></td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    document.getElementById('totalCount').textContent = students.length;
    updateSummary();
}

// 5. SAVE LOGIC
async function handleSaveAttendance() {
    const tbody = document.querySelector('#attendanceTableBody');
    const dateInput = document.querySelector('.date-input');

    // Fallback to today if date input is empty
    const attendanceDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];

    const rows = tbody.querySelectorAll('tr[data-student-id]');
    const attendanceData = [];

    rows.forEach(row => {
        const studentId = row.getAttribute('data-student-id');
        const status = row.querySelector('input[type="radio"]:checked')?.value;
        const notes = row.querySelector('.remarks-input')?.value.trim();

        if (status) {
            attendanceData.push({
                student_id: studentId,
                date: attendanceDate,
                attendance_status: status,
                notes: notes,
                recorded_by_user_id: currentTeacherId,
                school_id: currentSchoolId
            });
        }
    });

    if (attendanceData.length === 0) {
        showToast('Please mark attendance for at least one student.', 'warning');
        return;
    }

    const { error } = await supabase.from('Attendance').insert(attendanceData);
    if (error) {
        showToast('Save failed: ' + error.message, 'error');
    } else {
        showToast('Attendance saved successfully!', 'success');
    }
}

// 6. INITIALIZATION
async function initializeAttendanceModule() {
    if (!await checkTeacherLogin()) return;

    // Initialize date input with today's date
    const dateInput = document.querySelector('.date-input');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    const classes = await fetchTeacherClasses(currentTeacherId);
    const classSelect = document.querySelector('.class-select');
    const subjectSelect = document.querySelector('.subject-select');

    if (classSelect && subjectSelect) {
        classSelect.innerHTML = classes.map(c => `<option value="${c.class_id}">${c.class_name} ${c.section}</option>`).join('');
        
        classSelect.addEventListener('change', debounce(async () => {
            const classId = classSelect.value;
            
            // Reset and populate subjects
            subjectSelect.innerHTML = '<option value="">Select a subject</option>';
            subjectSelect.disabled = !classId;
            
            if (classId) {
                const subjects = await fetchSubjectsForClass(classId);
                subjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.subject_id;
                    option.textContent = subject.subject_name;
                    subjectSelect.appendChild(option);
                });
                
                // Load students for first subject by default
                if (subjects.length > 0) {
                    const students = await fetchStudentsFromClass(classId);
                    renderStudents(students);
                }
            }
        }));

        // Load first class by default
        if (classes.length > 0) {
            const students = await fetchStudentsFromClass(classes[0].class_id);
            renderStudents(students);
        }
    }

    // Add subject change listener
    if (subjectSelect) {
        subjectSelect.addEventListener('change', debounce(async () => {
            const classId = classSelect.value;
            if (classId) {
                const students = await fetchStudentsFromClass(classId);
                renderStudents(students);
            }
        }));
    }

    document.querySelector('.save-btn')?.addEventListener('click', handleSaveAttendance);
}

// UI Helpers
function updateSummary() {
    document.getElementById('presentCount').textContent = document.querySelectorAll('input[value="present"]:checked').length;
    document.getElementById('absentCount').textContent = document.querySelectorAll('input[value="absent"]:checked').length;
}

window.markAllPresent = () => {
    document.querySelectorAll('input[value="present"]').forEach(i => i.checked = true);
    updateSummary();
};

window.markAllAbsent = () => {
    document.querySelectorAll('input[value="absent"]').forEach(i => i.checked = true);
    updateSummary();
};

window.clearAll = () => {
    document.querySelectorAll('input[type="radio"]').forEach(i => i.checked = false);
    updateSummary();
};

window.updateSummary = updateSummary;

document.addEventListener('DOMContentLoaded', initializeAttendanceModule);