
// upload_results.js
// Result upload logic for teachers portal with upsert functionality and Excel import

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

        // 2. Fetch Teacher's Classes
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
            showToast('Please log in as a teacher to view this page.', 'warning');
            window.location.href = '/login';
            return null;
        }

        // Verify this user is actually a teacher
        const { data: teacherData, error: teacherError } = await supabase
            .from('Teachers')
            .select('*')
            .eq('teacher_id', user.id)
            .single();

        if (teacherError || !teacherData) {
            console.error('User is not authorized as a teacher:', teacherError);
            showToast('You are not authorized as a teacher.', 'error');
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

        return data.map(item => item.Subjects);

    } catch (err) {
        console.error('Unexpected error fetching class subjects:', err);
        return [];
    }
}

// --- UI Population ---

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

// --- Event Listeners ---

function setupEventListeners() {
    const classSelect = document.getElementById('classSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const excelInput = document.getElementById('excelUpload');
    const resultsForm = document.getElementById('resultsForm');

    // Class Change -> Fetch Subjects & Clear Table
    if (classSelect) {
        classSelect.addEventListener('change', async (e) => {
            const classId = e.target.value;
            updateStudentTable([]); // Clear table

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
            const subjectId = e.target.value;
            const classId = classSelect.value;

            if (classId && subjectId) {
                console.log(classId)
                await fetchStudentsInClass(classId);
            } else {
                updateStudentTable([]);
            }
        });
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

// --- Core Logic ---

async function fetchStudentsInClass(classId) {
    try {
        console.log("Fetching students for class ID:", classId); // Debugging line

        const { data: students, error } = await supabase
            .from('Students')
            .select('student_id, full_name') // Only select what you need
            .eq('class_id', classId) // Remove parseInt() if your class_id is a UUID
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Supabase Error:', error.message);
            throw error;
        }

        console.log("Students found:", students);
        currentClassStudents = students || [];
        updateStudentTable(currentClassStudents);

    } catch (error) {
        updateStudentTable([]);
        showToast("Error loading students: " + error.message, "error");
    }
}

function updateStudentTable(students) {
    const tableBody = document.getElementById('studentTableBody');
    if (!tableBody) return;

    if (students.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">
                    No students found or selected.
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

// --- Excel Import Logic ---

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (currentClassStudents.length === 0) {
        showToast('Please fetch students (select Class & Subject) first before importing scores.', 'warning');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Assume first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        // Expected columns: ID, Name, Score
        // We will try to map loosely
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Basic validation: Check if we have at least some data
        if (json.length < 2) {
            showToast('File appears to be empty or missing headers.', 'warning');
            return;
        }

        // Identify columns (simple heuristic or fixed index)
        // Let's assume: 
        // Column 0: ID
        // Column 1: Name
        // Column 2: Score

        let matchCount = 0;

        // Skip header row (index 0)
        for (let i = 1; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;

            const excelId = row[0]; // ID
            const excelScore = row[2]; // Score

            // Find input for this student
            // We use loose comparison for ID in case of string/number diffs
            const scoreInput = document.querySelector(`.score-input[data-student-id="${excelId}"]`);

            if (scoreInput) {
                scoreInput.value = excelScore;
                matchCount++;
            }
        }

        showToast(`Imported scores for ${matchCount} students.`, 'success');
        event.target.value = ''; // Reset file input
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

        // Validation
        if (!classId || !subjectId || !term || !academicSession || !assessmentType || !maxScore) {
            showToast('Please fill in all required fields.', 'warning');
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

                // Validate against max score
                if (score > maxScore) {
                    input.style.borderColor = 'red';
                    // We could alert here, or just continue and let backend/validation fail.
                    // Let's alert briefly? Or just cap it?
                    // Ideally we should stop.
                }

                scores.push({
                    student_id: studentId,
                    subject_id: subjectId,
                    class_id: classId, // Often redundant if normalized, but good for safety
                    term: term,
                    academic_session: academicSession,
                    assessment_type: assessmentType,
                    score: score,
                    max_score: maxScore,
                    comment: comment,
                    teacher_id: currentTeacherId
                });
            }
        });

        if (scores.length === 0) {
            showToast('No scores entered.', 'warning');
            return;
        }

        if (await window.showConfirm(`Submit ${scores.length} result${scores.length !== 1 ? 's' : ''}?`, 'Save Results')) {
            // Upsert Logic
            const { data, error } = await supabase
                .from('Grades')
                .upsert(scores, {
                    onConflict: 'student_id,subject_id,term,academic_session,assessment_type',
                    ignoreDuplicates: false
                })
                .select();

            if (error) throw error;

            showToast('Results saved successfully!', 'success');
            // Optional: clear inputs?
            // document.getElementById('resultsForm').reset(); 
            // We probably want to keep them visible for confirmation, maybe just clear file input
        }

    } catch (error) {
        console.error('Error saving results:', error);
        showToast('Failed to save results. Check console for details.', 'error');
    }
}

// --- Grading Settings Logic ---

function loadGradingSettings() {
    const defaultMaxScore = localStorage.getItem('grade_settings_max_score');
    const gradeScale = localStorage.getItem('grade_settings_scale') || 'waec';
    const passMark = localStorage.getItem('grade_settings_pass_mark');

    // Populate Modal Fields
    const maxScoreInput = document.getElementById('settingsMaxScore');
    const gradeScaleSelect = document.getElementById('settingsGradeScale');
    const passMarkInput = document.getElementById('settingsPassMark');

    if (maxScoreInput) maxScoreInput.value = defaultMaxScore || '';
    if (gradeScaleSelect) gradeScaleSelect.value = gradeScale;
    if (passMarkInput) passMarkInput.value = passMark || '';

    // Apply to Main Form
    applyGradingSettings();
}

function applyGradingSettings() {
    const defaultMaxScore = localStorage.getItem('grade_settings_max_score');

    // Auto-fill Max Score on main form if not already set (or if we want to enforce default)
    // For now, let's only set it if the input is empty or if we want to act as a "preset"
    const mainMaxScoreInput = document.getElementById('maxScoreInput');
    if (mainMaxScoreInput && defaultMaxScore) {
        mainMaxScoreInput.value = defaultMaxScore;
    }
}

function saveGradingSettings() {
    const maxScore = document.getElementById('settingsMaxScore').value;
    const gradeScale = document.getElementById('settingsGradeScale').value;
    const passMark = document.getElementById('settingsPassMark').value;

    localStorage.setItem('grade_settings_max_score', maxScore);
    localStorage.setItem('grade_settings_scale', gradeScale);
    localStorage.setItem('grade_settings_pass_mark', passMark);

    showToast('Grading configuration saved!', 'success');
    window.toggleSettingsModal(); // Close modal
    applyGradingSettings(); // Refresh UI
}


// Hook into initialization
const originalInitialize = window.initializeUploadResults || initializeUploadResults;

// We need to override or hook into the event listeners.
// Since initializeUploadResults is defined in this module and exported/used, 
// strictly speaking, we are inside the module.
// We can just call setupSettingsEventListeners from setupEventListeners or init.

// Let's modify setupEventListeners to include settings listeners
// But since I am appending code, I can't easily modify the middle of the file without replacing it.
// Instead, I will append a new setup block and call it.

function setupSettingsEventListeners() {
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveGradingSettings);
    }

    // settingsBtn listener is technically handled by onclick="toggleSettingsModal()" in HTML 
    // but better to have it here if we removed onclick. 
    // The HTML has onclick="toggleSettingsModal()", which is global. 
    // Since this is a module, window.toggleSettingsModal was defined in the HTML script tag.
    // So that part is fine.

    // Load settings on startup
    loadGradingSettings();
}

// Initialize settings listeners when DOM is ready (or immediately if already ready)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSettingsEventListeners);
} else {
    setupSettingsEventListeners();
}
