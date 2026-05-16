import { supabase } from '../config.js';

let currentTeacherId = null;

// Check if teacher is logged in (reusing pattern from other scripts)
async function checkTeacherLogin() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

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

// Handle File Upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const classId = document.getElementById('classSelect').value;
    const subjectId = document.getElementById('subjectSelect').value;

    if (!classId || !subjectId) {
        alert('Please select a Class and Subject first.');
        event.target.value = ''; // Reset input
        return;
    }

    try {
        const rows = await readXlsxFile(file);

        // Expected format: [Header Row, Data Rows...]
        // Header: Week, Topic, Description (optional)

        // Simple validation of header
        const header = rows[0].map(h => h.toLowerCase());
        const weekIdx = header.findIndex(h => h.includes('week'));
        const topicIdx = header.findIndex(h => h.includes('topic'));
        const subTopicIdx = header.findIndex(h => h.includes('sub_topic') || h.includes('subtopic'));

        if (weekIdx === -1 || topicIdx === -1) {
            alert('Invalid Excel format. Please ensure headers "Week" and "Topic" exist.');
            return;
        }

        const curriculumData = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length === 0) continue;

            const week = row[weekIdx];
            const topic = row[topicIdx];
            const sub_topic = subTopicIdx !== -1 ? row[subTopicIdx] : '';

            if (week && topic) {
                curriculumData.push({
                    class_id: parseInt(classId),
                    subject_id: subjectId,
                    teacher_id: currentTeacherId,
                    week: week.toString(),
                    topic: topic.toString(),
                    sub_topic: sub_topic ? sub_topic.toString() : '',
                    status: 'Pending',
                    progress: 0
                });
            }
        }

        if (curriculumData.length === 0) {
            alert('No valid data found in the file.');
            return;
        }

        const { error } = await supabase
            .from('Curriculum')
            .insert(curriculumData);

        if (error) throw error;

        alert(`Successfully imported ${curriculumData.length} topics!`);

        // Refresh table
        const data = await fetchCurriculum(classId, subjectId);
        renderCurriculumTable(data);

    } catch (err) {
        console.error('Error uploading file:', err);
        alert('Failed to upload file. Please ensure it is a valid Excel file.');
    } finally {
        event.target.value = ''; // Reset input
    }
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

        classSelect.addEventListener('change', async (e) => {
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
        });
    }

    // Handle Subject Change
    if (subjectSelect) {
        subjectSelect.addEventListener('change', async (e) => {
            const subjectId = e.target.value;
            const classId = classSelect.value;

            if (classId && subjectId) {
                const data = await fetchCurriculum(classId, subjectId);
                renderCurriculumTable(data);
            } else {
                renderCurriculumTable([]);
            }
        });
    }

    // Handle File Upload Button
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', handleFileUpload);
    }
});
