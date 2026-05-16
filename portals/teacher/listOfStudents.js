// listOfStudents.js — Fetches and displays all students for the logged-in teacher.
// Attendance percentages come from the real Attendance table.

import { supabase } from '../../core/config.js';
import { checkTeacherLogin } from '../../portals/teacher/teacherUtils.js';
import { waitForUser, debounce } from '/core/perf.js';

// Fetch both form classes and subject classes for the teacher
async function fetchTeacherClasses(teacherId) {
    try {
        const [formClassesRes, subjectClassesRes] = await Promise.all([
            // 1. Classes where teacher is the form teacher
            supabase
                .from('Classes')
                .select('class_id, class_name, section')
                .eq('teacher_id', teacherId),
            // 2. Classes where teacher is a subject teacher
            supabase
                .from('Class_Subjects')
                .select(`
                    class_id,
                    Classes!inner(class_name, section)
                `)
                .eq('teacher_id', teacherId)
        ]);

        if (formClassesRes.error) console.error('Error fetching form classes:', formClassesRes.error);
        if (subjectClassesRes.error) console.error('Error fetching subject classes:', subjectClassesRes.error);

        const uniqueClasses = [];
        const seen = new Set();
        
        (formClassesRes.data || []).forEach(record => {
            if (!seen.has(record.class_id)) {
                seen.add(record.class_id);
                uniqueClasses.push({
                    class_id: record.class_id,
                    class_name: record.class_name,
                    section: record.section
                });
            }
        });

        (subjectClassesRes.data || []).forEach(record => {
            if (!seen.has(record.class_id)) {
                seen.add(record.class_id);
                uniqueClasses.push({
                    class_id: record.class_id,
                    class_name: record.Classes?.class_name,
                    section: record.Classes?.section
                });
            }
        });
        
        return uniqueClasses;
    } catch (err) {
        console.error('Unexpected error fetching teacher classes:', err);
        return [];
    }
}

// Fetch teacher's assigned subjects via Class_Subjects
async function fetchTeacherSubjects(teacherId) {
    try {
        const { data, error } = await supabase
            .from('Class_Subjects')
            .select(`
                subject_id,
                Subjects!inner(subject_name)
            `)
            .eq('teacher_id', teacherId);

        if (error) {
            console.error('Error fetching teacher subjects:', error);
            return [];
        }
        
        // Deduplicate subjects
        const uniqueSubjects = [];
        const seen = new Set();
        (data || []).forEach(record => {
            if (!seen.has(record.subject_id)) {
                seen.add(record.subject_id);
                uniqueSubjects.push({
                    subject_id: record.subject_id,
                    subject_name: record.Subjects?.subject_name
                });
            }
        });
        
        return uniqueSubjects;
    } catch (err) {
        console.error('Unexpected error fetching teacher subjects:', err);
        return [];
    }
}

// Fetch all students from teacher's classes (with inner-joined class info and subjects)
async function fetchAllStudentsFromTeacherClasses(classes) {
    try {
        if (!classes || classes.length === 0) {
            return [];
        }

        // Get current user's school_id from metadata
        const user = await waitForUser();
        const userSchoolId = user?.user_metadata?.school_id;
        
        if (!userSchoolId) {
            console.error('User missing school_id in metadata');
            return [];
        }

        const classIds = classes.map(cls => cls.class_id);

        const { data, error } = await supabase
            .from('Students')
            .select(`
                student_id,
                full_name,
                date_of_birth,
                gender,
                admission_date,
                profile_picture,
                class_id,
                Classes!inner(
                    class_name, 
                    section,
                    Class_Subjects(subject_id)
                ),
                student_subject(subject_id)
            `)
            .in('class_id', classIds)
            .eq('school_id', userSchoolId)         // CRITICAL: Filter by current school
            .eq('enrollment_status', 'active')     // Only show active students in teacher's list
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

// Calculate age from date of birth
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

// Get initials for avatar
function getInitials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
}

/**
 * Calculate real attendance percentage for a student from the Attendance table.
 * Returns the percentage (0–100) or 'N/A' if no records exist.
 */
async function getAttendancePercentage(studentId) {
    try {
        const { data, error } = await supabase
            .from('Attendance')
            .select('attendance_status')
            .eq('student_id', studentId);

        if (error || !data || data.length === 0) return 'N/A';

        const total = data.length;
        const presentCount = data.filter(r =>
            r.attendance_status && r.attendance_status.toLowerCase() === 'present'
        ).length;

        return Math.round((presentCount / total) * 100);
    } catch (err) {
        console.error('Error fetching attendance for student', studentId, err);
        return 'N/A';
    }
}

// Render students in the table
async function renderStudents(students) {
    const tbody = document.querySelector('.tp-table tbody');
    if (!tbody) {
        console.error('Students table tbody not found');
        return;
    }

    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="display: flex; justify-content: center; padding: 2rem; color: #6b7280;">
                    No students found matching these filters.
                </td>
            </tr>
        `;
        return;
    }

    for (const student of students) {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);
        const attendancePercent = await getAttendancePercentage(student.student_id);
        const attendanceDisplay = attendancePercent === 'N/A' ? 'N/A' : `${attendancePercent}%`;
        const barWidth = attendancePercent === 'N/A' ? 0 : attendancePercent;

        const row = `
            <tr>
                <td data-label="Name">
                    <div class="student-name">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-info">
                            <p>${student.full_name || 'Unknown'}</p>
                        </div>
                    </div>
                </td>
                <td data-label="Age">${age}</td>
                <td data-label="Class">
                    <span class="class-badge">${student.Classes.class_name} <span class="highlight">${student.Classes.section}</span></span>
                </td>
                <td data-label="Performance">
                    <div class="performance-container">
                        <div class="performance-bar">
                            <div class="performance-fill" style="width: ${barWidth}%;"></div>
                        </div>
                        <span class="performance-text">${attendanceDisplay}</span>
                    </div>
                </td>
                <td data-label="Action">
                    <button class='view-btn' data-type='student' data-id='${student.student_id}'>View</button>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    }
}

// Show empty-state message if teacher has no classes
function showNoClassesState() {
    const tbody = document.querySelector('.tp-table tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="display: flex; justify-content: center; padding: 2rem; color: #6b7280;">
                    No classes assigned yet. Contact Admin.
                </td>
            </tr>
        `;
    }
}

// Populate Class Filter Dropdown
function populateClassFilter(classes) {
    const classFilter = document.getElementById('classFilter');
    if (!classFilter) return;
    classFilter.innerHTML = '<option value="all">All Classes</option>';
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.class_id;
        option.textContent = `${cls.class_name} ${cls.section || ''}`.trim();
        classFilter.appendChild(option);
    });
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

        // Deduplicate and flatten subjects
        const uniqueSubjects = [];
        const seen = new Set();
        (data || []).forEach(item => {
            const subject = item.Subjects;
            if (subject && !seen.has(subject.subject_id)) {
                seen.add(subject.subject_id);
                uniqueSubjects.push({
                    subject_id: subject.subject_id,
                    subject_name: subject.subject_name
                });
            }
        });
        
        return uniqueSubjects;
    } catch (err) {
        console.error('Unexpected error fetching class subjects:', err);
        return [];
    }
}

// Populate Subject Filter Dropdown
function populateSubjectFilter(subjects) {
    const subjectFilter = document.getElementById('subjectFilter');
    if (!subjectFilter) return;
    subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
    subjects.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub.subject_id;
        option.textContent = sub.subject_name;
        subjectFilter.appendChild(option);
    });
}

// Main function
window.loadAllTeacherStudents = async function loadAllTeacherStudents() {
    console.log('Loading all students for teacher...');

    const authResult = await checkTeacherLogin();
    if (!authResult) return;

    const { teacherId } = authResult;
    window.currentTeacherId = teacherId; // Store for later use

    const classes = await fetchTeacherClasses(teacherId);
    populateClassFilter(classes);

    // Initially load all subjects if no class is selected (or default to all)
    const subjects = await fetchTeacherSubjects(teacherId);
    populateSubjectFilter(subjects);

    if (classes.length === 0) {
        showNoClassesState();
        return;
    }

    const students = await fetchAllStudentsFromTeacherClasses(classes);

    window.allTeacherStudents = students;

    console.log(`Fetched ${students.length} students from teacher's classes`);
    await renderStudents(students);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllTeacherStudents();

    // Search and Filter functionality elements
    const searchInput = document.getElementById('searchInput');
    const classFilter = document.getElementById('classFilter');
    const subjectFilter = document.getElementById('subjectFilter');

    // Debounce function to limit rapid firing
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // Unified Filter Engine
    async function applyFilters() {
        const query = (searchInput?.value || '').toLowerCase().trim();
        const classId = classFilter?.value || 'all';
        const subjectId = subjectFilter?.value || 'all';

        const allStudents = window.allTeacherStudents || [];
        
        const filtered = allStudents.filter(student => {
            // 1. Text Search rule
            const fullName = student.full_name?.toLowerCase() || "";
            const className = student.Classes?.class_name?.toLowerCase() || "";
            const section = student.Classes?.section?.toLowerCase() || "";
            const matchesSearch = !query || fullName.includes(query) || className.includes(query) || section.includes(query);

            // 2. Class Rule
            const matchesClass = (classId === 'all') || (student.class_id.toString() === classId);

            // 3. Subject Rule
            let matchesSubject = true;
            if (subjectId !== 'all') {
                const directSubject = student.student_subject?.some(ss => ss.subject_id === subjectId);
                const classSubject = student.Classes?.Class_Subjects?.some(cs => cs.subject_id === subjectId);
                matchesSubject = !!(directSubject || classSubject);
            }

            return matchesSearch && matchesClass && matchesSubject;
        });
        
        await renderStudents(filtered);
    }

    // Event Listeners with debounce for text input
    if (searchInput) searchInput.addEventListener('input', debounce( debounce(applyFilters, 300), 300));
    
    if (classFilter) {
        classFilter.addEventListener('change', async (e) => {
            const classId = e.target.value;
            const teacherId = window.currentTeacherId;
            
            if (classId === 'all') {
                // If "All Classes" is selected, load all subjects for the teacher
                const subjects = await fetchTeacherSubjects(teacherId);
                populateSubjectFilter(subjects);
            } else {
                // Load subjects specifically for the selected class
                const subjects = await fetchClassSubjects(classId, teacherId);
                populateSubjectFilter(subjects);
            }
            
            applyFilters();
        });
    }
    
    if (subjectFilter) subjectFilter.addEventListener('change', applyFilters);
});
