// upload_results.js
// Result upload logic for teachers portal with upsert functionality and Excel import

import { supabase } from '../../core/config.js';
import { checkTeacherLogin } from '../../portals/teacher/teacherUtils.js';
import { openUploadModal } from '../../assets/js-shared/upload_modal_ui.js';
import { waitForUser, debounce, lazyScript } from '/core/perf.js';

// ─── State ────────────────────────────────────────────────────────────────────
let currentClassStudents = [];
let currentTeacherId = null;
let currentSchoolId = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeUploadResults();
});

async function initializeUploadResults() {
    try {
        // 1. Verify Teacher Login
        const authResult = await checkTeacherLogin();
        if (!authResult) return;
        currentTeacherId = authResult.teacherId;

        // 2. Fetch school_id from metadata (Crucial for RLS)
        const user = await waitForUser();
        currentSchoolId = user?.user_metadata?.school_id;

        if (!currentSchoolId) {
            alert("Critical Error: School identity not found. Please re-login.");
            return;
        }

        // 3. Fetch Initial Data
        const classes = await fetchTeacherClasses(currentTeacherId);
        populateClassDropdown(classes);
        fetchAcademicSessions(); // Load years and terms dynamically
        setupEventListeners();
        applyGradingSettings();

    } catch (error) {
        console.error('Error initializing upload results:', error);
    }
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchTeacherClasses(teacherId) {
    const { data, error } = await supabase
        .from('Classes')
        .select('class_id, class_name, section')
        .eq('teacher_id', teacherId);

    return error ? [] : (data || []);
}

async function fetchClassSubjects(classId) {
    const { data, error } = await supabase
        .from('Subject_Allocations')
        .select(`subject_id, Subjects (subject_name)`)
        .eq('class_id', classId)
        .eq('teacher_id', currentTeacherId);

    return error ? [] : data.map(item => ({
        subject_id: item.subject_id,
        subject_name: item.Subjects?.subject_name
    }));
}

async function fetchAcademicSessions() {
    const { data, error } = await supabase
        .from('Academic_Sessions')
        .select('*')
        .eq('school_id', currentSchoolId)
        .order('created_at', { ascending: false });

    if (!error && data) {
        const sessionSelect = document.getElementById('academicSessionSelect');
        const termSelect = document.getElementById('termSelect');

        const uniqueYears = [...new Set(data.map(s => s.academic_year))];
        sessionSelect.innerHTML = uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('');

        const current = data.find(s => s.is_current);
        if (current) {
            sessionSelect.value = current.academic_year;
            termSelect.value = current.term;
        }
    }
}

async function fetchStudentsInClass(classId) {
    // Lazy-load XLSX only when needed (saves ~1MB on initial page load)
    await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
    const { data: students, error } = await supabase
        .from('Students')
        .select('student_id, full_name')
        .eq('class_id', classId)
        .eq('school_id', currentSchoolId)
        .eq('enrollment_status', 'active')
        .order('full_name', { ascending: true });

    currentClassStudents = students || [];
    updateStudentTable(currentClassStudents);
}

// ─── UI Rendering ─────────────────────────────────────────────────────────────

function updateStudentTable(students) {
    const tableBody = document.getElementById('studentTableBody');
    if (!tableBody) return;

    if (students.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">No students found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = students.map(student => `
        <tr data-student-id="${student.student_id}">
            <td>${student.full_name}</td>
            <td><small>${student.student_id}</small></td>
            <td><input type="number" class="score-input" data-student-id="${student.student_id}" step="0.1" placeholder="0.0"></td>
            <td><input type="text" class="comment-input" data-student-id="${student.student_id}" placeholder="Optional"></td>
        </tr>
    `).join('');
}

// ─── Excel Template & Import ──────────────────────────────────────────────────

function downloadResultsTemplate() {
    if (currentClassStudents.length === 0) {
        alert('Please select a Class and Subject first.');
        return;
    }

    const session = document.getElementById('academicSessionSelect')?.value || "N/A";
    const term = document.getElementById('termSelect')?.value || "N/A";
    const subjectSelect = document.getElementById('subjectSelect');
    const subjectName = subjectSelect.options[subjectSelect.selectedIndex]?.text || "Subject";

    // Headers: Full Name, Score, Comment, System_ID
    const rows = [
        ['OFFICIAL RESULTS TEMPLATE'],
        [`Subject: ${subjectName}`, `Session: ${session}`, `Term: ${term}`],
        [''], // Spacer
        ['Full Name', 'Score', 'Comment', 'System_ID']
    ];

    currentClassStudents.forEach(student => {
        rows.push([student.full_name, '', '', student.student_id]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Hide the D column (System_ID) so teachers don't touch it
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 30 }, { hidden: true }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `${subjectName}_Results_Template.xlsx`);
}
function openResultsUploadModal() {
    if (currentClassStudents.length === 0) {
        alert('Please fetch students first (select Class & Subject) before importing scores.');
        return;
    }

    openUploadModal({
        title: 'Import Results',
        icon: 'fa-upload',
        accept: '.xlsx,.xls',

        // ─── ADDED THESE TWO PROPERTIES ───
        templateFn: () => downloadResultsTemplate(),
        hintHtml: `
            <div style="font-size: 13px; line-height: 1.6;">
                <p>1. <strong>Download</strong> the pre-filled template for this class.</p>
                <p>2. Enter scores in the <strong>Score</strong> column.</p>
                <p>3. <strong>Upload</strong> the file to auto-fill the results table.</p>
            </div>
        `,

        onFile: async (file, helpers) => {
            try {
                const rows = await readXlsxFile(file);
                if (!rows || rows.length < 2) return helpers.showError('File is empty.');

                // 1. Get the Max Score from the main UI to compare against
                const maxScore = parseFloat(document.getElementById('maxScoreInput').value) || 100;

                let headerRowIndex = rows.findIndex(row =>
                    row.some(cell => cell?.toString().toLowerCase().includes('system_id'))
                );

                if (headerRowIndex === -1) {
                    helpers.showError('Invalid template format. Please use the downloaded file.');
                    return;
                }

                const headers = rows[headerRowIndex].map(h => h?.toString().toLowerCase().trim());
                const idIdx = headers.indexOf('system_id');
                const scoreIdx = headers.indexOf('score');
                const nameIdx = headers.indexOf('full name');
                const commentIdx = headers.indexOf('comment');

                const previewData = [];
                let hasError = false; // Safety switch

                for (let i = headerRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row[idIdx]) continue;

                    const rawScore = row[scoreIdx];
                    const parsedScore = parseFloat(rawScore);
                    let rowError = null;

                    // 2. THE CHECK: Validate score against maxScore
                    if (!isNaN(parsedScore) && parsedScore > maxScore) {
                        rowError = `Exceeds max (${maxScore})`;
                        hasError = true;
                    }

                    previewData.push({
                        id: row[idIdx].toString().trim(),
                        name: row[nameIdx] || 'Unknown Student',
                        score: rawScore, // Keep raw value for display
                        comment: commentIdx !== -1 ? row[commentIdx] : '',
                        error: rowError // Pass the error to the preview helper
                    });
                }

                // 3. Show preview table
                // Note: If your UI helper supports it, you can add 'error' to the columns
                helpers.showPreview(previewData, [
                    { key: 'name', label: 'Student' },
                    { key: 'score', label: 'Score' }
                ]);

                helpers._processedRows = previewData;

                // 4. BLOCK UPLOAD if there are errors
                if (hasError) {
                    helpers.showError(`Some scores exceed the maximum allowed (${maxScore}). Please fix your Excel file.`);
                    helpers.setUploadEnabled(false);
                } else {
                    helpers.setUploadEnabled(previewData.length > 0);
                }

            } catch (err) {
                helpers.showError('Error parsing Excel file.');
            }
        },
        onConfirm: async (file, helpers) => {
            let matchCount = 0;

            helpers._processedRows.forEach(row => {
                const scoreInput = document.querySelector(`.score-input[data-student-id="${row.id}"]`);
                const commentInput = document.querySelector(`.comment-input[data-student-id="${row.id}"]`);

                if (scoreInput) {
                    scoreInput.value = row.score || '';
                    matchCount++;
                }
                if (commentInput) {
                    commentInput.value = row.comment || '';
                }
            });

            helpers.close();

            if (matchCount > 0) {
                alert(`Successfully matched and filled scores for ${matchCount} students. Don't forget to click "Save Results"!`);
            } else {
                alert("Match Failed: The student IDs in the file don't match the current class.");
            }
        }
    });
}
// ─── Save Results (The "Invisible" School ID injection) ────────────────────────

async function handleSaveResults(e) {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;

    try {
        const classId = document.getElementById('classSelect').value;
        const subjectId = document.getElementById('subjectSelect').value;
        const term = document.getElementById('termSelect').value;
        const session = document.getElementById('academicSessionSelect').value;
        const type = document.getElementById('assessmentTypeSelect').value;
        const maxScore = parseFloat(document.getElementById('maxScoreInput').value);

        const scores = [];
        document.querySelectorAll('.score-input').forEach(input => {
            if (input.value !== '') {
                const sId = input.dataset.studentId;
                scores.push({
                    student_id: sId,
                    subject_id: subjectId,
                    class_id: classId,
                    term: term,
                    academic_session: session,
                    assessment_type: type,
                    score: parseFloat(input.value),
                    max_score: maxScore,
                    comment: document.querySelector(`.comment-input[data-student-id="${sId}"]`)?.value.trim() || '',
                    teacher_id: currentTeacherId,
                    school_id: currentSchoolId // CRITICAL: Required for RLS
                });
            }
        });

        if (scores.length === 0) throw new Error("No scores entered.");

        const { error } = await supabase.from('Grades').upsert(scores, {
            onConflict: 'student_id,subject_id,term,academic_session,assessment_type'
        });

        if (error) throw error;
        alert('Results successfully saved/updated!');

    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
}

// ─── Event Listeners & Helpers ────────────────────────────────────────────────

function setupEventListeners() {
    document.getElementById('classSelect').addEventListener('change', debounce(async (e) => {
        const subjects = await fetchClassSubjects(e.target.value);
        populateSubjectDropdown(subjects);
        updateStudentTable([]);
    }));

    document.getElementById('subjectSelect').addEventListener('change', (e) => {
        if (e.target.value) fetchStudentsInClass(document.getElementById('classSelect').value);
    });

    document.getElementById('importExcelBtn').addEventListener('click', openResultsUploadModal);
    document.getElementById('resultsForm').addEventListener('submit', handleSaveResults);
}

function populateClassDropdown(classes) {
    const el = document.getElementById('classSelect');
    el.innerHTML = '<option value="">Select Class</option>' +
        classes.map(c => `<option value="${c.class_id}">${c.class_name} ${c.section}</option>`).join('');
}

function populateSubjectDropdown(subjects) {
    const el = document.getElementById('subjectSelect');
    el.innerHTML = '<option value="">Select Subject</option>' +
        subjects.map(s => `<option value="${s.subject_id}">${s.subject_name}</option>`).join('');
}

function applyGradingSettings() {
    const max = localStorage.getItem('grade_settings_max_score');
    if (max) document.getElementById('maxScoreInput').value = max;
}