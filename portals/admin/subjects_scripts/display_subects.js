document.addEventListener('DOMContentLoaded', async function () {
    const tbody = document.querySelector('.students-table tbody');

    try {
        // Fetch subjects with their class and teacher assignments
        const { data: classSubjects, error } = await window.supabase
            .from('Class_Subjects')
            .select(`
                    class_id,
                    subject_id,
                    teacher_id,
                    Classes(class_name, section),
                    Subjects(subject_name, is_core),
                    Teachers(first_name, last_name)
                `);

        if (error) {
            console.error('Error fetching subjects:', error);
            showToast('Failed to load subjects. Please try again.', 'error');
            return;
        }

        // Clear existing rows
        tbody.innerHTML = '';

        // Generate rows for each subject assignment
        classSubjects.forEach((assignment, index) => {
            const subject = assignment.Subjects;
            const classInfo = assignment.Classes;
            const teacher = assignment.Teachers;

            const subjectName = subject.subject_name;
            const isCore = subject.is_core;
            const type = isCore ? 'Core' : 'Elective';
            const avatarText = subjectName.substring(0, 2).toUpperCase();
            const subjectId = `#SUB${String(index + 1).padStart(3, '0')}`;
            const teacherName = teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Not Assigned';
            const className = classInfo ? `${classInfo.class_name} ${classInfo.section}` : 'Not Assigned';

            const row = document.createElement('tr');
            row.className = 'student-row';
            row.innerHTML = `
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${avatarText}</div>
                        <div class="student-details">
                            <h4>${subjectName}</h4>
                            <p>ID: ${subjectId}</p>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="class-badge">${type}</div>
                </td>
                <td>
                    <div class="teacher-info">
                        <span class="teacher-name">${teacherName}</span>
                    </div>
                </td>
                <td>
                    <div class="class-badge">${className}</div>
                </td>
                <td>
                    <button class='view-btn' data-type='subject' data-id='${assignment.subject_id}'>View</button>
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (err) {
        console.error('Unexpected error:', err);
        showToast('An unexpected error occurred while loading subjects.', 'error');
    }
});

// Make refresh function available globally
window.refreshSubjectsTable = function () {
    const tbody = document.querySelector('.students-table tbody');
    if (tbody) {
        // Trigger the DOMContentLoaded event logic again
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
    }
};
