// teachersDashboard.js — Main dashboard logic for the Teachers Portal.
// All metrics are pulled from real database tables.

import { supabase } from '../config.js';
import { checkTeacherLogin, startLiveClock } from '../teacherUtils.js';

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

// Fetch total students count for teacher's classes
async function fetchTotalStudentsCount(classIds) {
    try {
        if (classIds.length === 0) return 0;

        const { count, error } = await supabase
            .from('Students')
            .select('*', { count: 'exact', head: true })
            .in('class_id', classIds);

        if (error) {
            console.error('Error fetching total students count:', error);
            return 0;
        }
        return count || 0;
    } catch (err) {
        console.error('Unexpected error fetching total students count:', err);
        return 0;
    }
}

// Fetch students from a specific class (limited to 5)
async function fetchStudentsFromClass(classId, limit = 5) {
    try {
        const { data, error } = await supabase
            .from('Students')
            .select('student_id, full_name, date_of_birth, class_id')
            .eq('class_id', classId)
            .limit(limit);

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

/**
 * Fetch average grade percentage across all of the teacher's classes.
 * Queries the Grades table and returns avg(score / max_score * 100).
 * Returns null if there are no grade records.
 */
async function fetchAverageGrade(classIds) {
    try {
        if (classIds.length === 0) return null;

        // Get all student_ids in the teacher's classes
        const { data: students, error: studentsError } = await supabase
            .from('Students')
            .select('student_id')
            .in('class_id', classIds);

        if (studentsError || !students || students.length === 0) return null;

        const studentIds = students.map(s => s.student_id);

        const { data: grades, error: gradesError } = await supabase
            .from('Grades')
            .select('score, max_score')
            .in('student_id', studentIds);

        if (gradesError || !grades || grades.length === 0) return null;

        const validGrades = grades.filter(g => g.max_score && g.max_score > 0);
        if (validGrades.length === 0) return null;

        const total = validGrades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0);
        return Math.round(total / validGrades.length);
    } catch (err) {
        console.error('Unexpected error fetching average grade:', err);
        return null;
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

// Show the no-classes empty state across the entire dashboard
function showNoClassesState() {
    const tbody = document.querySelector('.students-table tbody, .tp-table tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="display: flex; justify-content: center; padding: 2rem; color: #6b7280;">
                    No classes assigned yet. Contact Admin.
                </td>
            </tr>
        `;
    }

    const activeCoursesEl = document.getElementById('active_courses');
    if (activeCoursesEl) activeCoursesEl.textContent = '0';

    const totalStudentsEl = document.getElementById('total_students');
    if (totalStudentsEl) totalStudentsEl.textContent = '0';

    const avgPerformanceEl = document.getElementById('avg_performance');
    if (avgPerformanceEl) avgPerformanceEl.textContent = 'N/A';
}

// Render students in the table
function renderStudents(students, className, avgPerformance) {
    const tbody = document.querySelector('.students-table tbody, .tp-table tbody');
    if (!tbody) {
        console.error('Students table tbody not found');
        return;
    }

    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="display: flex; justify-content: center; padding: 2rem; color: #6b7280;">
                    No students found in your class.
                </td>
            </tr>
        `;
        return;
    }

    const performancePercent = avgPerformance !== null ? avgPerformance : 0;
    const performanceLabel = avgPerformance !== null ? `${avgPerformance}%` : 'N/A';

    students.forEach(student => {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);

        const row = `
            <tr>
                <td data-label="Name">
                    <div class="student-name">
                        <div class="student-avatar">${initials}</div>
                        <span>${student.full_name || 'Unknown'}</span>
                    </div>
                </td>
                <td data-label="Age">${age}</td>
                <td data-label="Class">${className || 'N/A'}</td>
                <td data-label="Performance">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="performance-bar">
                            <div class="performance-fill excellent" style="width: ${performancePercent}%;"></div>
                        </div>
                        <span class="performance-text">${performanceLabel}</span>
                    </div>
                </td>
                <td data-label="Action"><a href="./student_details.html?id=${student.student_id}" class="view-details">View Details</a></td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Main function to load the teacher dashboard
async function loadTeacherDashboard() {
    console.log('Loading teacher dashboard...');

    // Start the live clock
    startLiveClock('teacherGreetingDate');

    // Auth check
    const authResult = await checkTeacherLogin();
    if (!authResult) return;

    const { teacherId, teacherData } = authResult;

    // Personalise the greeting
    const greetingEl = document.getElementById('teacherGreetingName');
    if (greetingEl && teacherData) {
        greetingEl.textContent = `${teacherData.first_name || ''} ${teacherData.last_name || ''}`.trim() || 'Teacher';
    }

    // Fetch teacher's assigned classes
    const teacherClasses = await fetchTeacherClasses(teacherId);

    // Update Active Courses count
    const activeCoursesEl = document.getElementById('active_courses');
    if (activeCoursesEl) activeCoursesEl.textContent = teacherClasses.length;

    if (!teacherClasses || teacherClasses.length === 0) {
        showNoClassesState();
        return;
    }

    const classIds = teacherClasses.map(c => c.class_id);

    // Fetch total students count and average grade in parallel
    const [totalStudentsCount, avgGrade] = await Promise.all([
        fetchTotalStudentsCount(classIds),
        fetchAverageGrade(classIds)
    ]);

    // Update total students display
    const totalStudentsEl = document.getElementById('total_students');
    if (totalStudentsEl) totalStudentsEl.textContent = totalStudentsCount;

    // Update average performance display (if the element exists)
    const avgPerformanceEl = document.getElementById('avg_performance');
    if (avgPerformanceEl) avgPerformanceEl.textContent = avgGrade !== null ? `${avgGrade}%` : 'N/A';

    // Display students from first class
    const firstClass = teacherClasses[0];
    const students = await fetchStudentsFromClass(firstClass.class_id, 5);
    const classDisplayName = `${firstClass.class_name} ${firstClass.section}`;
    renderStudents(students, classDisplayName, avgGrade);
}

document.addEventListener('DOMContentLoaded', () => {
    loadTeacherDashboard();
});
