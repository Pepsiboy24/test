import { supabase } from '../../core/config.js';

// Global guard to prevent multiple simultaneous initialization attempts
let isInitialLoading = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (isInitialLoading) return;
  isInitialLoading = true;

  try {
    // 1. Use getSession for faster, non-blocking auth retrieval
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      console.error("Auth session not found. Redirecting to login...");
      window.location.href = "/login";
      return;
    }

    const user = session.user;

    // 2. Start the logic with the verified user object
    await initChildDashboard(user);

  } catch (err) {
    console.error("Initialization error:", err.message);
  } finally {
    isInitialLoading = false;
  }
});

async function initChildDashboard(user) {
  if (!user?.user_metadata?.school_id) {
    console.warn('Strict Guard: No school_id found. Execution blocked.');
    return;
  }

  // Get active child ID from global switcher state
  let activeId = localStorage.getItem('active_child_id') || localStorage.getItem('student_id');
  
  if (!activeId) {
      // Fallback: Fetch first child just to be entirely safe if sidebar hasn't finished
      const { data: parentRecord } = await supabase.from('Parents').select('parent_id').eq('user_id', user.id).single();
      if (parentRecord) {
          const { data: links } = await supabase.from('Parent_Student_Links').select('Students(student_id)').eq('parent_id', parentRecord.parent_id).limit(1);
          if (links && links.length > 0) activeId = links[0].Students.student_id;
      }
  }

  if (activeId) {
      localStorage.setItem('active_child_id', activeId);
      localStorage.setItem('student_id', activeId);
      await fetchChildGrades(activeId);
  }
}

async function fetchChildGrades(childId) {
  // Reset table to loading state
  const tbody = document.getElementById('subjectGradesTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading grades...</td></tr>';

  fetchAttendance(childId);

  const { data: grades, error } = await supabase
    .from('Grades')
    .select(`
            score,
            term,
            Subjects (subject_name)
        `)
    .eq('student_id', childId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching grades:', error);
    return;
  }

  renderGradesTable(grades);
  calculateStats(grades);
}

async function fetchAttendance(childId) {
  const { data: attendance, error } = await supabase
    .from('Attendance')
    .select('attendance_status')
    .eq('student_id', childId);

  if (error) {
    console.error('Error fetching attendance:', error);
    return;
  }

  let present = 0;
  let absent = 0;

  if (attendance) {
    present = attendance.filter(a => a.attendance_status === 'Present').length;
    absent = attendance.filter(a => a.attendance_status === 'Absent').length;
  }

  const daysPresentEl = document.getElementById('daysPresent');
  const daysAbsentEl = document.getElementById('daysAbsent');

  if (daysPresentEl) daysPresentEl.textContent = present;
  if (daysAbsentEl) daysAbsentEl.textContent = absent;
}

function renderGradesTable(grades) {
  const tbody = document.getElementById('subjectGradesTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!grades || grades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No grades recorded yet.</td></tr>';
    return;
  }

  grades.forEach(g => {
    const tr = document.createElement('tr');
    let letter = 'F';
    let badgeClass = 'grade-f';
    const score = g.score;

    if (score >= 70) { letter = 'A'; badgeClass = 'grade-a'; }
    else if (score >= 60) { letter = 'B'; badgeClass = 'grade-b'; }
    else if (score >= 50) { letter = 'C'; badgeClass = 'grade-c'; }
    else if (score >= 45) { letter = 'D'; badgeClass = 'grade-d'; }

    tr.innerHTML = `
            <td class="subject-name">${g.Subjects?.subject_name || 'Subject'}</td>
            <td>${g.term || '-'}</td>
            <td><strong>${score}/100</strong></td>
            <td><span class="grade-badge ${badgeClass}">${letter}</span></td>
            <td><span class="remarks">${g.remarks || '-'}</span></td>
        `;
    tbody.appendChild(tr);
  });
}

function calculateStats(grades) {
  const avgEl = document.getElementById('averageGrade');
  if (!grades || grades.length === 0) {
    if (avgEl) avgEl.textContent = '-';
    return;
  }

  const total = grades.reduce((sum, g) => sum + g.score, 0);
  const avg = total / grades.length;

  if (avgEl) avgEl.textContent = `${avg.toFixed(1)}%`;

  const posEl = document.getElementById('classPosition');
  if (posEl) posEl.textContent = 'Calculated EOT';
}