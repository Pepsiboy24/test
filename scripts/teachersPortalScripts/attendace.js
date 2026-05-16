import { supabase } from '../config.js';

let currentTeacherId = null; // Store the current teacher ID

// Check if teacher is logged in
async function checkTeacherLogin() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.error('No user logged in:', error);
            showToast('Please log in as a teacher to view this page.', 'error');
            setTimeout(() => window.location.href = '/login', 1500);
            return null;
        }

        // Verify this user is actually a teacher in the Teachers table
        const { data: teacherData, error: teacherError } = await supabase
            .from('Teachers')
            .select('*')
            .eq('teacher_id', user.id)
            .single();

        if (teacherError || !teacherData) {
            console.error('User is not authorized as a teacher:', teacherError);
            showToast('You are not authorized as a teacher. Please log in with teacher credentials.', 'error');
            await supabase.auth.signOut();
            setTimeout(() => window.location.href = '/login', 1500);
            return null;
        }

        currentTeacherId = user.id; // Store the teacher ID
        return user.id;
    } catch (err) {
        console.error('Error checking teacher login:', err);
        showToast('An error occurred while verifying your login. Please try logging in again.', 'error');
        setTimeout(() => window.location.href = '/login', 1500);
        return null;
    }
}

// Fetch teacher's assigned classes
async function fetchTeacherClasses(teacherId) {
    try {
        console.log('Fetching classes for teacher:', teacherId);
        const { data, error } = await supabase
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('teacher_id', teacherId);

        if (error) {
            console.error('Error fetching teacher classes:', error);
            return [];
        }
        console.log('Fetched classes:', data);
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching teacher classes:', err);
        return [];
    }
}

// Fetch subjects for a specific class and teacher
async function fetchClassSubjects(classId) {
    try {
        console.log(`Fetching subjects for class ${classId} and teacher ${currentTeacherId}`);
        const { data, error } = await supabase
            .from('Class_Subjects')
            .select(`
                subject_id,
                Subjects (subject_name)
            `)
            .eq('class_id', classId)
            .eq('teacher_id', currentTeacherId);

        if (error) {
            console.error('Error fetching class subjects:', error);
            return [];
        }

        // Format the return data
        return data.map(item => ({
            subject_id: item.subject_id,
            subject_name: item.Subjects?.subject_name || 'Unknown Subject'
        }));
    } catch (err) {
        console.error('Unexpected error fetching class subjects:', err);
        return [];
    }
}

// Fetch students from a specific class
async function fetchStudentsFromClass(classId) {
    try {
        const { data, error } = await supabase
            .from('Students')
            .select('*')
            .eq('class_id', classId)
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching students:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching students:', err);
        return [];
    }
}

// Populate class selector with teacher's classes
function populateClassSelector(classes) {
    const classSelect = document.querySelector('.class-select');
    if (!classSelect) return;

    classSelect.innerHTML = '<option value="">Select a class</option>';

    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.class_id;
        option.textContent = `${cls.class_name} ${cls.section}`;
        classSelect.appendChild(option);
    });
}

// Populate subject selector dynamically based on selected class
function populateSubjectSelector(subjects) {
    const subjectSelect = document.querySelector('.subject-select');
    if (!subjectSelect) return;

    subjectSelect.innerHTML = '<option value="">Select a subject</option>';

    if (!subjects || subjects.length === 0) {
        subjectSelect.disabled = true;
        return;
    }

    subjects.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub.subject_id;
        option.textContent = sub.subject_name;
        subjectSelect.appendChild(option);
    });

    subjectSelect.disabled = false;
}

// Get initials for avatar
function getInitials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
}

// Render students in the attendance table
function renderStudents(students) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem;">No students found in this class.</td></tr>`;
        return;
    }

    students.forEach((student, index) => {
        const initials = getInitials(student.full_name);
        const rowId = `student-${student.student_id}`;

        const row = `
            <tr data-student-id="${student.student_id}">
                <td>
                    <div class="student-name">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-info">
                            <p>${student.full_name || 'Unknown'}</p>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="attendance-options">
                        <div class="radio-group present">
                            <input type="radio" name="attendance-${student.student_id}" value="present" id="present-${student.student_id}" onchange="updateSummary()">
                            <label for="present-${student.student_id}">Present</label>
                        </div>
                        <div class="radio-group absent">
                            <input type="radio" name="attendance-${student.student_id}" value="absent" id="absent-${student.student_id}" onchange="updateSummary()">
                            <label for="absent-${student.student_id}">Absent</label>
                        </div>
                        <div class="radio-group late">
                            <input type="radio" name="attendance-${student.student_id}" value="late" id="late-${student.student_id}" onchange="updateSummary()">
                            <label for="late-${student.student_id}">Late</label>
                        </div>
                    </div>
                </td>
                <td>
                    <input type="text" class="remarks-input" placeholder="Add remarks...">
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    });

    // Update total count
    document.getElementById('totalCount').textContent = students.length;
    updateSummary();
}

// Utility function to get attendance status value for a student row
function getAttendanceStatus(row) {
    const radios = row.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return null; // No status selected
}

// Utility function to get remarks for a student row
function getRemarks(row) {
    const remarksInput = row.querySelector('.remarks-input');
    return remarksInput ? remarksInput.value.trim() : '';
}

// Function to gather attendance data from the page
async function gatherAttendanceData() {
    const attendanceTableBody = document.querySelector('.attendance-table tbody');
    if (!attendanceTableBody) {
        console.error('Attendance table body not found');
        return [];
    }

    const dateInput = document.querySelector('.date-input');
    const attendanceDate = dateInput ? dateInput.value : '';
    const subjectSelect = document.querySelector('.subject-select');
    const selectedSubjectId = subjectSelect ? subjectSelect.value : null;

    if (!attendanceDate) {
        showToast('Please select a date for the attendance.', 'warning');
        return [];
    }

    if (!selectedSubjectId) {
        showToast('Please select a subject for the attendance.', 'warning');
        return [];
    }

    const attendanceData = [];

    const rows = attendanceTableBody.querySelectorAll('tr');
    for (const row of rows) {
        const studentId = row.getAttribute('data-student-id');
        if (!studentId) {
            console.warn('Student ID not found in row');
            continue;
        }

        const status = getAttendanceStatus(row);
        if (!status) {
            console.warn(`Attendance status not set for student: ${studentId}`);
            continue;
        }

        const notes = getRemarks(row);

        attendanceData.push({
            student_id: studentId,
            date: attendanceDate,
            subject_id: selectedSubjectId, // Added subject ID
            attendance_status: status,
            notes: notes,
            recorded_by_user_id: currentTeacherId,
        });
    }

    return attendanceData;
}

// Function to handle Save Attendance button click
async function handleSaveAttendance() {
    const attendanceData = await gatherAttendanceData();

    if (attendanceData.length === 0) {
        showToast('No attendance data to save.', 'warning');
        return;
    }

    // Here should be the logic to send attendanceData to backend API
    // For now, just logging the data
    console.log('Submitting attendance data:', attendanceData);

    try {
        const { data, error } = await supabase
            .from('Attendance')
            .insert(attendanceData);

        if (error) {
            console.error('Error saving attendance:', error);
            showToast('Failed to save attendance: ' + error.message, 'error');
        } else {
            console.log('Attendance saved successfully:', data);
            showToast('Attendance saved successfully!', 'success');
        }
    } catch (error) {
        console.error('Error submitting attendance:', error);
        showToast('Error submitting attendance. See console for details.', 'error');
    }
}

// Attach event listener to Save Attendance button
function setupSaveButton() {
    const saveBtn = document.querySelector('.save-btn');
    if (!saveBtn) {
        console.error('Save Attendance button not found');
        return;
    }

    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSaveAttendance();
    });
}

// Handle class selection change
async function handleClassChange() {
    const classSelect = document.querySelector('.class-select');
    const selectedClassId = parseInt(classSelect.value);
    
    // Clear the current students and summary
    document.getElementById('attendanceTableBody').innerHTML = '';
    document.getElementById('totalCount').textContent = '0';
    updateSummary();

    if (!selectedClassId || isNaN(selectedClassId)) {
        populateSubjectSelector([]); // Disable subject dropdown
        return;
    }

    // Fetch and populate subjects for this specific class
    const subjects = await fetchClassSubjects(selectedClassId);
    populateSubjectSelector(subjects);

    // Fetch and render students
    const students = await fetchStudentsFromClass(selectedClassId);
    renderStudents(students);
}

// Initialize module
async function initializeAttendanceModule() {
    // Check teacher login
    const teacherId = await checkTeacherLogin();
    if (!teacherId) return;

    // Fetch and populate classes
    const classes = await fetchTeacherClasses(teacherId);
    if (classes.length === 0) {
        showToast('No classes are assigned to your account. Please contact an administrator.', 'error');
        return;
    }

    populateClassSelector(classes);

    // Set up event listeners
    setupSaveButton();

    const classSelect = document.querySelector('.class-select');
    if (classSelect) {
        classSelect.addEventListener('change', handleClassChange);

        // Auto-select first class and trigger load if classes exist
        if (classes.length > 0) {
            classSelect.value = classes[0].class_id;
            // Trigger change event manually or call the handler
            handleClassChange();
        }
    }
}

// Attendance functionality functions
function updateSummary() {
    const presentInputs = document.querySelectorAll('input[value="present"]:checked');
    const absentInputs = document.querySelectorAll('input[value="absent"]:checked');
    const lateInputs = document.querySelectorAll('input[value="late"]:checked');

    document.getElementById('presentCount').textContent = presentInputs.length;
    document.getElementById('absentCount').textContent = absentInputs.length;
    document.getElementById('lateCount').textContent = lateInputs.length;
}

function markAllPresent() {
    const presentInputs = document.querySelectorAll('input[value="present"]');
    presentInputs.forEach(input => {
        input.checked = true;
    });
    updateSummary();
}

function markAllAbsent() {
    const absentInputs = document.querySelectorAll('input[value="absent"]');
    absentInputs.forEach(input => {
        input.checked = true;
    });
    updateSummary();
}

function clearAll() {
    const allInputs = document.querySelectorAll('input[type="radio"]');
    const remarkInputs = document.querySelectorAll('.remarks-input');

    allInputs.forEach(input => {
        input.checked = false;
    });

    remarkInputs.forEach(input => {
        input.value = '';
    });

    updateSummary();
}

// Make functions global
window.updateSummary = updateSummary;
window.markAllPresent = markAllPresent;
window.markAllAbsent = markAllAbsent;
window.clearAll = clearAll;

document.addEventListener('DOMContentLoaded', () => {
    initializeAttendanceModule();
});
