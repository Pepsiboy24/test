// curriculum_tracker.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allTeachers = [];
let teacherSubjects = new Map();
let curriculumData = new Map();

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        await fetchTeachers();
        renderTeacherCards();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to load curriculum tracker. Please refresh the page.');
    }
}

async function fetchTeachers() {
    try {
        const { data: teachers, error } = await supabase
            .from('Teachers')
            .select('teacher_id, first_name, last_name, email, profile_picture')
            .order('first_name');

        if (error) throw error;
        
        allTeachers = teachers || [];
        
        // Fetch subjects for each teacher
        await fetchTeacherSubjects();
        
    } catch (error) {
        console.error('Error fetching teachers:', error);
        throw error;
    }
}

async function fetchTeacherSubjects() {
    try {
        // Fetch all class-subject assignments with teacher info
        const { data: assignments, error } = await supabase
            .from('Class_Subjects')
            .select(`
                teacher_id,
                subject_id,
                Subjects(subject_name, is_core)
            `);

        if (error) throw error;

        // Group subjects by teacher
        assignments.forEach(assignment => {
            if (!teacherSubjects.has(assignment.teacher_id)) {
                teacherSubjects.set(assignment.teacher_id, []);
            }
            teacherSubjects.get(assignment.teacher_id).push(assignment);
        });

        // Fetch curriculum data for each subject
        await fetchCurriculumData();

    } catch (error) {
        console.error('Error fetching teacher subjects:', error);
        throw error;
    }
}

async function fetchCurriculumData() {
    try {
        // Fetch real curriculum data from the Curriculum table
        const { data: curriculumItems, error } = await supabase
            .from('Curriculum')
            .select('*');

        if (error) {
            console.error('Error fetching curriculum data:', error);
            return;
        }

        console.log('📚 Curriculum data retrieved:', curriculumItems);
        
        // Clear existing curriculum data
        curriculumData.clear();
        
        // Group curriculum data by subject_id
        curriculumItems.forEach(item => {
            if (!curriculumData.has(item.subject_id)) {
                curriculumData.set(item.subject_id, []);
            }
            
            // Transform data to match expected format
            const transformedItem = {
                week: parseInt(item.week) || item.week, // Handle both string and number week values
                topic: item.topic_name,
                completed: item.status === 'Completed'
            };
            
            curriculumData.get(item.subject_id).push(transformedItem);
        });

        console.log('🗂️ Curriculum data grouped by subject:', Array.from(curriculumData.entries()));
        console.log('📈 Total subjects with curriculum:', curriculumData.size);

    } catch (error) {
        console.error('Error fetching curriculum data:', error);
        // Continue without curriculum data
    }
}

function renderTeacherCards() {
    const container = document.getElementById('teachersContainer');
    
    if (allTeachers.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <i class="fa-solid fa-users" style="font-size: 48px; color: var(--text-gray); margin-bottom: 16px;"></i>
                <p>No teachers found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = allTeachers.map(teacher => createTeacherCard(teacher)).join('');
}

function createTeacherCard(teacher) {
    const subjects = teacherSubjects.get(teacher.teacher_id) || [];
    const totalSubjects = subjects.length;
    const initials = `${teacher.first_name?.[0] || ''}${teacher.last_name?.[0] || ''}`.toUpperCase();
    
    // Calculate overall progress across all subjects
    let overallProgress = 0;
    subjects.forEach(subject => {
        const progress = calculateSubjectProgress(subject.subject_id);
        overallProgress += progress;
    });
    overallProgress = totalSubjects > 0 ? Math.round(overallProgress / totalSubjects) : 0;

    return `
        <div class="teacher-card" onclick="openTeacherModal('${teacher.teacher_id}')">
            <div class="teacher-header">
                <div class="teacher-avatar">
                    ${teacher.profile_picture ? 
                        `<img src="${teacher.profile_picture}" alt="${teacher.first_name} ${teacher.last_name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` :
                        initials
                    }
                </div>
                <div class="teacher-info">
                    <h3>${teacher.first_name} ${teacher.last_name}</h3>
                    <p>${teacher.email || 'No email'}</p>
                </div>
            </div>
            <div class="teacher-stats">
                <div class="stat-item">
                    <div class="stat-value">${totalSubjects}</div>
                    <div class="stat-label">Subjects</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${overallProgress}%</div>
                    <div class="stat-label">Progress</div>
                </div>
            </div>
        </div>
    `;
}

function calculateSubjectProgress(subjectId) {
    const topics = curriculumData.get(subjectId) || [];
    if (topics.length === 0) {
        console.log(`📊 No topics found for subject ${subjectId}`);
        return 0;
    }
    
    const completedTopics = topics.filter(topic => topic.completed).length;
    const progress = Math.round((completedTopics / topics.length) * 100);
    
    console.log(`📊 Progress for subject ${subjectId}: ${completedTopics}/${topics.length} = ${progress}%`);
    
    return progress;
}

function openTeacherModal(teacherId) {
    const teacher = allTeachers.find(t => t.teacher_id === teacherId);
    if (!teacher) return;

    const subjects = teacherSubjects.get(teacherId) || [];
    
    document.getElementById('modalTeacherName').textContent = `${teacher.first_name} ${teacher.last_name}`;
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = subjects.length > 0 ? 
        subjects.map(subject => createSubjectAccordion(subject)).join('') :
        '<p style="text-align: center; color: var(--text-gray); padding: 40px;">No subjects assigned to this teacher.</p>';
    
    document.getElementById('teacherModal').style.display = 'flex';
}

function createSubjectAccordion(subject) {
    const progress = calculateSubjectProgress(subject.subject_id);
    const topics = curriculumData.get(subject.subject_id) || [];
    
    return `
        <div class="accordion">
            <div class="accordion-item">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div class="subject-title">
                        <i class="fa-solid fa-book"></i>
                        ${subject.Subjects?.subject_name || 'Unknown Subject'}
                        ${subject.Subjects?.is_core ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">Core</span>' : ''}
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-text">${progress}%</div>
                    </div>
                </div>
                <div class="accordion-body">
                    ${topics.length > 0 ? `
                        <ul class="topic-list">
                            ${topics.map(topic => createTopicItem(topic)).join('')}
                        </ul>
                    ` : '<p style="color: var(--text-gray); text-align: center; padding: 20px;">No curriculum topics available for this subject.</p>'}
                </div>
            </div>
        </div>
    `;
}

function createTopicItem(topic) {
    return `
        <li class="topic-item ${topic.completed ? 'completed' : 'pending'}">
            <div class="topic-name">
                <i class="fa-solid fa-${topic.completed ? 'check-circle' : 'circle'}" style="margin-right: 8px; color: ${topic.completed ? 'var(--success)' : 'var(--warning)'}"></i>
                Week ${topic.week}: ${topic.topic}
            </div>
            <span class="topic-status ${topic.completed ? 'status-completed' : 'status-pending'}">
                ${topic.completed ? 'Completed' : 'Pending'}
            </span>
        </li>
    `;
}

function toggleAccordion(header) {
    const body = header.nextElementSibling;
    const isActive = header.classList.contains('active');
    
    // Close all other accordions
    document.querySelectorAll('.accordion-header').forEach(h => {
        h.classList.remove('active');
        h.nextElementSibling.classList.remove('active');
    });
    
    // Toggle current accordion
    if (!isActive) {
        header.classList.add('active');
        body.classList.add('active');
    }
}

function closeModal() {
    document.getElementById('teacherModal').style.display = 'none';
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('teacherSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterTeachers(searchTerm);
        });
    }

    // Close modal on outside click
    const modal = document.getElementById('teacherModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function filterTeachers(searchTerm) {
    const filteredTeachers = allTeachers.filter(teacher => {
        const fullName = `${teacher.first_name} ${teacher.last_name}`.toLowerCase();
        const email = (teacher.email || '').toLowerCase();
        return fullName.includes(searchTerm) || email.includes(searchTerm);
    });

    const container = document.getElementById('teachersContainer');
    if (filteredTeachers.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <i class="fa-solid fa-search" style="font-size: 48px; color: var(--text-gray); margin-bottom: 16px;"></i>
                <p>No teachers found matching "${searchTerm}"</p>
            </div>
        `;
    } else {
        container.innerHTML = filteredTeachers.map(teacher => createTeacherCard(teacher)).join('');
    }
}

function showError(message) {
    const container = document.getElementById('teachersContainer');
    container.innerHTML = `
        <div class="loading">
            <i class="fa-solid fa-exclamation-triangle" style="font-size: 48px; color: var(--danger); margin-bottom: 16px;"></i>
            <p style="color: var(--danger);">${message}</p>
        </div>
    `;
}

// Make functions globally available
window.openTeacherModal = openTeacherModal;
window.closeModal = closeModal;
window.toggleAccordion = toggleAccordion;
