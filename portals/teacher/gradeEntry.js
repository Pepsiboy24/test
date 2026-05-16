import { supabase } from '../../core/config.js';
import { waitForUser, debounce } from '/core/perf.js';

let currentTeacherId = null;

// Check if teacher is logged in
async function checkTeacherLogin() {
    try {
        const user = await waitForUser();

        if (error || !user) {
            console.error('No user logged in:', error);
            alert('Please log in as a teacher to view this page.');
            window.location.href = '/login';
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
            alert('You are not authorized as a teacher. Please log in with teacher credentials.');
            await supabase.auth.signOut();
            window.location.href = '/login';
            return null;
        }

        currentTeacherId = user.id;
        return user.id;
    } catch (err) {
        console.error('Error checking teacher login:', err);
        alert('An error occurred while verifying your login. Please try logging in again.');
        window.location.href = '/login';
        return null;
    }
}

// Fetch teacher's assigned classes
async function fetchTeacherClasses(teacherId) {
    try {
        const { data, error } = await supabase
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('teacher_id', teacherId);

        if (error) {
            console.error('Error fetching teacher classes:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching teacher classes:', err);
        return [];
    }
}

// Fetch subjects for a specific class that this teacher teaches
async function fetchClassSubjects(classId, teacherId) {
    try {
        // Query Class_Subjects to find subjects for this class and teacher
        const { data, error } = await supabase
            .from('Class_Subjects')
            .select(`
                subject_id,
                Subjects (
                    subject_name,
                    subject_id
                )
            `)
            .eq('class_id', classId)
            .eq('teacher_id', teacherId);

        if (error) {
            console.error('Error fetching class subjects:', error);
            return [];
        }

        // Flatten the structure
        return data.map(item => item.Subjects);

    } catch (err) {
        console.error('Unexpected error fetching class subjects:', err);
        return [];
    }
}

// Fetch students in a class
async function fetchStudents(classId) {
    try {
        const { data, error } = await supabase
            .from('Students')
            .select('student_id, full_name, profile_picture')
            .eq('class_id', classId)
            .eq('enrollment_status', 'active')  // Only grade active students
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

// Fetch existing grades for a class and subject (optional context)
// Implementation depends on if we want to support editing existing grades
// For now, we will just allow entry.

// Populate Class Dropdown
function populateClassDropdown(classes) {
    const classSelect = document.getElementById('classSelect');
    if (!classSelect) return;

    classSelect.innerHTML = '<option value="">Select Class</option>';
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.class_id;
        option.textContent = `${cls.class_name} ${cls.section}`;
        classSelect.appendChild(option);
    });
}

// Populate Subject Dropdown
function populateSubjectDropdown(subjects) {
    const subjectSelect = document.getElementById('subjectSelect');
    if (!subjectSelect) return;

    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    subjects.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub.subject_id;
        option.textContent = sub.subject_name;
        subjectSelect.appendChild(option);
    });
}

// Render Student Grading Table
function renderGradingTable(students) {
    const tbody = document.querySelector('#gradesTable tbody');
    if (!tbody) {
        console.error('Grades table body not found');
        return;
    }

    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4">No students found in this class.</td></tr>';
        return;
    }

    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-3 border-b border-gray-100">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                        ${student.full_name.charAt(0)}
                    </div>
                    <span class="font-medium text-gray-700">${student.full_name}</span>
                </div>
            </td>
            <td class="p-3 border-b border-gray-100">
                <input type="number" 
                    class="score-input w-24 p-2 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-500" 
                    min="0" max="100" 
                    placeholder="0-100"
                    data-student-id="${student.student_id}">
            </td>
            <td class="p-3 border-b border-gray-100">
                <input type="text" 
                    class="remarks-input w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-500" 
                    placeholder="Optional remarks"
                    data-student-id="${student.student_id}">
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Save Grades
async function saveGrades() {
    const classId = document.getElementById('classSelect').value;
    const subjectId = document.getElementById('subjectSelect').value;
    const term = document.getElementById('termSelect')?.value || 'Term 1'; // Default or from UI

    if (!classId || !subjectId) {
        alert('Please select both a Class and a Subject.');
        return;
    }

    // Get current user's school_id for RLS compliance
    const user = await waitForUser();
    if (userError || !user || !user.user_metadata?.school_id) {
        alert('Authentication error. Please log in again.');
        return;
    }

    const schoolId = user.user_metadata.school_id;

    const inputs = document.querySelectorAll('.score-input');
    const gradesToSave = [];

    inputs.forEach(input => {
        const score = input.value;
        if (score !== '') { // Only save if a score is entered
            const studentId = input.getAttribute('data-student-id');
            const row = input.closest('tr');
            const remarks = row.querySelector('.remarks-input').value;

            gradesToSave.push({
                student_id: studentId,
                class_id: parseInt(classId),
                subject_id: subjectId,
                teacher_id: currentTeacherId,
                score: parseFloat(score),
                remarks: remarks,
                term: term,
                date_recorded: new Date().toISOString(),
                school_id: schoolId // CRITICAL: Add school_id for RLS compliance
            });
        }
    });

    if (gradesToSave.length === 0) {
        alert('No grades entered.');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('Grades')
            .upsert(gradesToSave); // upsert is better here

        if (error) {
            throw error;
        }

        alert('Grades saved successfully!');
        // Optional: Clear inputs or disable them
    } catch (err) {
        console.error('Error saving grades:', err);
        alert('Failed to save grades: ' + err.message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    const teacherId = await checkTeacherLogin();
    if (!teacherId) return;

    const classes = await fetchTeacherClasses(teacherId);
    populateClassDropdown(classes);

    const classSelect = document.getElementById('classSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const saveBtn = document.getElementById('saveGradesBtn');

    if (classSelect) {
        classSelect.addEventListener('change', debounce(async (e) => {
            const classId = e.target.value;
            // Clear students table
            document.querySelector('#gradesTable tbody').innerHTML = '';

            if (classId) {
                // Fetch Subjects
                const subjects = await fetchClassSubjects(classId, teacherId);
                populateSubjectDropdown(subjects);

                // Fetch Students
                const students = await fetchStudents(classId);
                renderGradingTable(students);
            } else {
                populateSubjectDropdown([]); // Clear subjects
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveGrades);
    }
});
