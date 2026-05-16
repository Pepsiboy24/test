import { supabase } from '../../core/config.js';
import { openUploadModal } from '../../assets/js-shared/upload_modal_ui.js';
import { waitForUser, debounce } from '/core/perf.js';

let currentTeacherId = null;

// Check if teacher is logged in (reusing pattern from other scripts)
async function checkTeacherLogin() {
    try {
        const user = await waitForUser();

        if (!user) {
            console.error('No user logged in');
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
            .from('Subject_Allocations')
            .select(`
                class_id,
                Classes (
                    class_id,
                    class_name,
                    section
                )
            `)
            .eq('teacher_id', teacherId);

        if (error) {
            console.error('Error fetching teacher classes:', error);
            return [];
        }

        if (!data || data.length === 0) return [];

        const uniqueClasses = new Map();
        data.forEach(item => {
            if (item.Classes) {
                uniqueClasses.set(item.Classes.class_id, item.Classes);
            }
        });

        return Array.from(uniqueClasses.values());
    } catch (err) {
        console.error('Unexpected error fetching teacher classes:', err);
        return [];
    }
}

// Fetch subjects for a specific class that this teacher teaches
async function fetchClassSubjects(classId, teacherId) {
    try {
        const { data, error } = await supabase
            .from('Subject_Allocations')
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
        return data.map(item => item.Subjects).filter(Boolean);

    } catch (err) {
        console.error('Unexpected error fetching class subjects:', err);
        return [];
    }
}

// Fetch Curriculum Data
async function fetchCurriculum(classId, subjectId) {
    try {
        const { data, error } = await supabase
            .from('Curriculum')
            .select('*')
            .eq('class_id', classId)
            .eq('subject_id', subjectId)
            .order('week', { ascending: true }); // Assuming 'week' can be sorted numerically or alphabetically

        if (error) {
            console.error('Error fetching curriculum:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching curriculum:', err);
        return [];
    }
}

// Render Curriculum Table
function renderCurriculumTable(curriculumData) {
    const tbody = document.getElementById('curriculumTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (curriculumData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No scheme of work found for this subject. Upload one to get started.</td></tr>';
        updateCompletionCount(0, 0);
        return;
    }

    let completedCount = 0;

    curriculumData.forEach(item => {
        const isCompleted = item.status === 'Completed';
        if (isCompleted) completedCount++;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Topic">
                <div class="topic-name">${item.topic}</div>
                <div class="topic-desc">${item.sub_topic || ''}</div>
            </td>
            <td data-label="Week">${item.week}</td>
            <td data-label="Status">
                <span class="status ${isCompleted ? 'completed' : 'pending'}">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        ${isCompleted
                ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>'
                : '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>'
            }
                    </svg>
                    ${item.status}
                </span>
            </td>
            <td data-label="Progress">
                <div style="display: flex; align-items: center;">
                    <div class="progress-bar" style="width: 200px;">
                        <div class="progress-fill" style="width: ${item.progress || 0}%;"></div>
                    </div>
                    <span class="progress-text">${item.progress || 0}%</span>
                </div>
            </td>
            <td data-label="Action">
                <button class="action-btn" data-id="${item.id}" data-status="${item.status}">
                    ${isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
            </td>
        `;

        // Add event listener for the button
        const btn = row.querySelector('.action-btn');
        btn.addEventListener('click', () => toggleTopicStatus(item.id, item.status));

        tbody.appendChild(row);
    });

    updateCompletionCount(completedCount, curriculumData.length);
}

// Update Completion Status
function updateCompletionCount(completed, total) {
    const text = document.querySelector('.completion-text');
    if (text) {
        text.textContent = `${completed} of ${total} topics completed`;
    }
}

// Toggle Topic Status (Optimistic Update -> DB Update)
async function toggleTopicStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    const newProgress = newStatus === 'Completed' ? 100 : 0;

    try {
        const { error } = await supabase
            .from('Curriculum')
            .update({ status: newStatus, progress: newProgress })
            .eq('id', id);

        if (error) throw error;

        // Reload data
        const classId = document.getElementById('classSelect').value;
        const subjectId = document.getElementById('subjectSelect').value;
        if (classId && subjectId) {
            const data = await fetchCurriculum(classId, subjectId);
            renderCurriculumTable(data);
        }

    } catch (err) {
        console.error('Error updating status:', err);
        alert('Failed to update status');
    }
}

// Download Template
function downloadCurriculumTemplate() {
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded.');
        return;
    }
    const ws = XLSX.utils.aoa_to_sheet([
        ['Week', 'Topic', 'Sub Topic'],
        ['1', 'Introduction to Algebra', 'Basic definitions and concepts'],
        ['2', 'Linear Equations', 'Solving one-step equations']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scheme of Work');
    XLSX.writeFile(wb, 'scheme_of_work_template.xlsx');
}

// Open Upload Modal
function openCurriculumUploadModal(classId, subjectId) {
    if (typeof readXlsxFile === 'undefined') {
        alert('Excel library not loaded. Refresh and try again.');
        return;
    }

    openUploadModal({
        title: 'Upload Scheme of Work',
        icon: 'fa-book-open',
        accept: '.xlsx,.xls',
        templateFn: downloadCurriculumTemplate,
        hintHtml: `
            <strong style="color:#93c5fd;">Required:</strong>
            <code style="color:#a5f3fc;">Week</code>,
            <code style="color:#a5f3fc;">Topic</code>
            &nbsp;·&nbsp;
            <strong style="color:#93c5fd;">Optional:</strong>
            <code style="color:#a5f3fc;">Sub Topic</code>
        `,
        confirmLabel: 'Upload Scheme',
        onFile: async (file, helpers) => {
            try {
                const rows = await readXlsxFile(file);
                if (!rows || rows.length < 2) {
                    alert('File is empty or missing data.');
                    helpers.setUploadEnabled(false);
                    return;
                }

                const header = rows[0].map(h => (h || '').toString().toLowerCase());
                const weekIdx = header.findIndex(h => h.includes('week'));
                const topicIdx = header.findIndex(h => h.includes('topic'));
                const subTopicIdx = header.findIndex(h => h.includes('sub_topic') || h.includes('subtopic'));

                if (weekIdx === -1 || topicIdx === -1) {
                    alert('Invalid Excel format. Please ensure headers "Week" and "Topic" exist.');
                    helpers.setUploadEnabled(false);
                    return;
                }

                const previewRows = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.length === 0) continue;

                    const week = row[weekIdx];
                    const topic = row[topicIdx];

                    if (week && topic) {
                        previewRows.push({
                            Week: week.toString(),
                            Topic: topic.toString(),
                            SubTopic: subTopicIdx !== -1 && row[subTopicIdx] ? row[subTopicIdx].toString() : '',
                            __errors: []
                        });
                    }
                }

                helpers._rows = previewRows;
                helpers._classId = classId;
                helpers._subjectId = subjectId;

                helpers.showPreview(previewRows, [
                    { key: 'Week', label: 'Week' },
                    { key: 'Topic', label: 'Topic' },
                    { key: 'SubTopic', label: 'Sub Topic' }
                ]);

                if (previewRows.length === 0) {
                    alert('No valid topics found in the file.');
                }
                helpers.setUploadEnabled(previewRows.length > 0);

            } catch (err) {
                console.error('Error parsing file:', err);
                alert('Failed to parse Excel file.');
                helpers.setUploadEnabled(false);
            }
        },
        onConfirm: async (file, helpers) => {
            try {
                // 1. Get school_id from teacher's session
                const user = await waitForUser();
                const schoolId = user?.user_metadata?.school_id;

                if (!schoolId) throw new Error("School identity not found. Please re-login.");

                const curriculumData = helpers._rows.map(r => ({
                    class_id: parseInt(helpers._classId),
                    subject_id: helpers._subjectId,
                    teacher_id: currentTeacherId,
                    school_id: schoolId, // <--- CRITICAL: Add this line
                    week: r.Week,
                    topic: r.Topic,
                    sub_topic: r.SubTopic,
                    status: 'Pending',
                    progress: 0
                }));

                helpers.startProgress(curriculumData.length);

                const { error } = await supabase
                    .from('Curriculum')
                    .insert(curriculumData);

                if (error) throw error;

                helpers.finishProgress(`<div style="color:#86efac;margin-top:8px;">Successfully imported ${curriculumData.length} topics!</div>`);
                helpers.showFooterDone();

                // Refresh table
                const data = await fetchCurriculum(helpers._classId, helpers._subjectId);
                renderCurriculumTable(data);

            } catch (err) {
                console.error('Error uploading file:', err);
                helpers.finishProgress(`<div style="color:#fca5a5;margin-top:8px;">Upload failed: ${err.message || 'Unknown error'}</div>`);
                helpers.showFooterDone();
            }
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Sidebar toggle (moved from inline)
    window.toggleSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    };

    const teacherId = await checkTeacherLogin();
    if (!teacherId) return;

    const classes = await fetchTeacherClasses(teacherId);

    const classSelect = document.getElementById('classSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('curriculumUpload');

    // Populate Class Dropdown
    if (classSelect) {
        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.class_id;
            option.textContent = `${cls.class_name} ${cls.section}`;
            classSelect.appendChild(option);
        });

        classSelect.addEventListener('change', debounce(async (e) => {
            const classId = e.target.value;
            // Clear table
            renderCurriculumTable([]);

            // Clear Subjects
            subjectSelect.innerHTML = '<option value="">Select Subject</option>';

            if (classId) {
                const subjects = await fetchClassSubjects(classId, teacherId);
                subjects.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub.subject_id;
                    option.textContent = sub.subject_name;
                    subjectSelect.appendChild(option);
                });
            }
        }));
    }

    // Handle Subject Change
    if (subjectSelect) {
        subjectSelect.addEventListener('change', debounce(async (e) => {
            const subjectId = e.target.value;
            const classId = classSelect.value;

            if (classId && subjectId) {
                const data = await fetchCurriculum(classId, subjectId);
                renderCurriculumTable(data);
            } else {
                renderCurriculumTable([]);
            }
        }));
    }

    // Handle File Upload Button
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            const classId = classSelect.value;
            const subjectId = subjectSelect.value;
            if (!classId || !subjectId) {
                alert('Please select a Class and Subject first.');
                return;
            }
            openCurriculumUploadModal(classId, subjectId);
        });
    }
});
