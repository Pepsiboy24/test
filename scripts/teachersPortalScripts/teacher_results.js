// teacher_results.js
// Result upload logic for the Teachers Portal
// Fetches only classes/subjects assigned to the currently logged-in teacher.

import { supabase } from '../config.js';

// Global variables
let currentClassStudents = [];
let currentTeacherId = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeUploadResults();
});

async function initializeUploadResults() {
    try {
        // 1. Verify Teacher Login
        currentTeacherId = await checkTeacherLogin();
        if (!currentTeacherId) return;

        // 2. Fetch Teacher's Classes (only classes assigned to this teacher)
        const classes = await fetchTeacherClasses(currentTeacherId);
        populateClassDropdown(classes);

        // 3. Setup Event Listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error initializing upload results:', error);
    }
}

// --- Auth & Initial Data Fetching ---

async function checkTeacherLogin() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.error('No user logged in:', error);
            alert('Please log in as a teacher to view this page.');
            window.location.href = '/login';
            return null;
        }

        // Verify this user is actually a teacher
        const { data: teacherData, error: teacherError } = await supabase
            .from('Teachers')
            .select('teacher_id')
            .eq('teacher_id', user.id)
            .single();

        if (teacherError || !teacherData) {
            console.error('User is not authorized as a teacher:', teacherError);
            alert('You are not authorized as a teacher.');
            await supabase.auth.signOut();
            window.location.href = '/login';
            return null;
        }

        return user.id;
    } catch (err) {
        console.error('Error checking teacher login:', err);
        return null;
    }
}

// Fetches only classes where the teacher_id matches the logged-in teacher
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
        return [];
    }
}

// Fetches only subjects for the selected class that THIS teacher teaches
async function fetchClassSubjects(classId) {
    try {
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
            .eq('teacher_id', currentTeacherId);

        if (error) {
            console.error('Error fetching class subjects:', error);
            return [];
        }

        return data.map(item => item.Subjects).filter(Boolean);

    } catch (err) {
        console.error('Unexpected error fetching class subjects:', err);
        return [];
    }
}

// Fetches all students enrolled in a given class
async function fetchStudentsInClass(classId) {
    try {
        const { data: students, error } = await supabase
            .from('Students')
            .select('student_id, full_name')
            .eq('class_id', classId)
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Supabase Error:', error.message);
            throw error;
        }

        currentClassStudents = students || [];
        updateStudentTable(currentClassStudents);

    } catch (error) {
        updateStudentTable([]);
        alert("Error loading students: " + error.message);
    }
}

// --- UI Population ---

function populateClassDropdown(classes) {
    const classSelect = document.getElementById('classSelect');
    if (!classSelect) return;

    classSelect.innerHTML = '<option value="">Select Class</option>';
    if (classes.length === 0) {
        classSelect.innerHTML = '<option value="">No classes assigned to you</option>';
        return;
    }
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.class_id;
        option.textContent = `${cls.class_name} ${cls.section || ''}`.trim();
        classSelect.appendChild(option);
    });
}

function populateSubjectDropdown(subjects) {
    const subjectSelect = document.getElementById('subjectSelect');
    if (!subjectSelect) return;

    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    if (subjects.length === 0) {
        subjectSelect.innerHTML = '<option value="">No subjects found for this class</option>';
        return;
    }
    subjects.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub.subject_id;
        option.textContent = sub.subject_name;
        subjectSelect.appendChild(option);
    });
}

function updateStudentTable(students) {
    const tableBody = document.getElementById('studentTableBody');
    if (!tableBody) return;

    if (students.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 30px; color: #64748b;">
                    No students found or please select a Class and Subject.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = students.map(student => `
        <tr data-student-id="${student.student_id}">
            <td data-label="Name">${student.full_name}</td>
            <td data-label="ID">${student.student_id}</td>
            <td data-label="Score">
                <input type="number"
                       class="score-input"
                       data-student-id="${student.student_id}"
                       min="0"
                       step="0.1"
                       placeholder="Score">
            </td>
            <td data-label="Comment">
                <input type="text"
                       class="comment-input"
                       data-student-id="${student.student_id}"
                       placeholder="Optional comment">
            </td>
        </tr>
    `).join('');
}

// --- Event Listeners ---

function setupEventListeners() {
    const classSelect = document.getElementById('classSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const excelInput = document.getElementById('excelUpload');
    const resultsForm = document.getElementById('resultsForm');
    const importBtn = document.getElementById('importExcelBtn');

    // Class Change -> Fetch Subjects & Clear Table
    if (classSelect) {
        classSelect.addEventListener('change', async (e) => {
            const classId = e.target.value;
            updateStudentTable([]);

            if (classId) {
                const subjects = await fetchClassSubjects(classId);
                populateSubjectDropdown(subjects);
            } else {
                populateSubjectDropdown([]);
            }
        });
    }

    // Subject Change -> Fetch Students
    if (subjectSelect) {
        subjectSelect.addEventListener('change', async (e) => {
            const classId = classSelect ? classSelect.value : '';
            if (classId && e.target.value) {
                await fetchStudentsInClass(classId);
            } else {
                updateStudentTable([]);
            }
        });
    }

    // Trigger file input on button click
    if (importBtn && excelInput) {
        importBtn.addEventListener('click', () => excelInput.click());
    }

    // Excel Upload
    if (excelInput) {
        excelInput.addEventListener('change', handleExcelUpload);
    }

    // Form Submit
    if (resultsForm) {
        resultsForm.addEventListener('submit', handleSaveResults);
    }
}

// --- Excel Import Logic ---

function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (currentClassStudents.length === 0) {
        alert('Please select a Class & Subject to load students first before importing scores.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) {
            alert('File appears to be empty or missing headers.');
            return;
        }

        // Expected columns: [0] ID, [1] Name, [2] Score
        let matchCount = 0;
        for (let i = 1; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;

            const excelId = row[0];
            const excelScore = row[2];
            const scoreInput = document.querySelector(`.score-input[data-student-id="${excelId}"]`);

            if (scoreInput && excelScore !== undefined) {
                scoreInput.value = excelScore;
                matchCount++;
            }
        }

        alert(`Imported scores for ${matchCount} student(s).`);
        event.target.value = '';
    };

    reader.readAsArrayBuffer(file);
}

// --- Submit Logic ---

async function handleSaveResults(e) {
    e.preventDefault();

    try {
        const classId = document.getElementById('classSelect').value;
        const subjectId = document.getElementById('subjectSelect').value;
        const term = document.getElementById('termSelect').value;
        const academicSession = document.getElementById('academicSessionSelect').value;
        const assessmentType = document.getElementById('assessmentTypeSelect').value;
        const maxScore = parseFloat(document.getElementById('maxScoreInput').value);

        if (!classId || !subjectId || !term || !academicSession || !assessmentType || !maxScore) {
            alert('Please fill in all required fields before saving.');
            return;
        }

        const scores = [];
        const scoreInputs = document.querySelectorAll('.score-input');

        scoreInputs.forEach(input => {
            const val = input.value;
            if (val !== '') {
                const score = parseFloat(val);
                const studentId = input.dataset.studentId;
                const commentInput = document.querySelector(`.comment-input[data-student-id="${studentId}"]`);
                const comment = commentInput ? commentInput.value.trim() : '';

                if (score > maxScore) {
                    input.style.borderColor = 'red';
                }

                scores.push({
                    student_id: studentId,
                    subject_id: subjectId,
                    term: term,
                    academic_session: academicSession,
                    score: score,
                    max_score: maxScore,
                });
            }
        });

        if (scores.length === 0) {
            alert('No scores entered. Please fill in at least one score.');
            return;
        }

        if (confirm(`Are you sure you want to submit ${scores.length} result(s)?`)) {
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Saving...';
                submitBtn.disabled = true;
            }

            const { error } = await supabase
                .from('Grades')
                .upsert(scores, {
                    onConflict: 'student_id,subject_id,term,academic_session',
                    ignoreDuplicates: false
                });

            if (error) throw error;

            alert('Results saved successfully!');

            if (submitBtn) {
                submitBtn.textContent = 'Save Results';
                submitBtn.disabled = false;
            }
        }

    } catch (error) {
        console.error('Error saving results:', error);
        alert('Failed to save results: ' + error.message);
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Save Results';
            submitBtn.disabled = false;
        }
    }
}
