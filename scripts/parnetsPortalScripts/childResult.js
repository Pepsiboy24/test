import { supabase } from '../config.js';

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

    // 2. Start the switcher logic with the verified user object
    await initializeChildSwitcher(user);

  } catch (err) {
    console.error("Initialization error:", err.message);
  } finally {
    isInitialLoading = false;
  }
});

async function initializeChildSwitcher(user) {
  // 1. Find the Parent Record associated with the Auth UID
  const { data: parentRecord, error: parentError } = await supabase
    .from('Parents')
    .select('parent_id, full_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (parentError || !parentRecord) {
    console.error("Parent profile not found in database.");
    return;
  }

  // Update Sidebar UI with Parent Info
  const parentNameEl = document.querySelector('.user-details h4');
  const avatarEl = document.querySelector('.user-avatar');
  if (parentNameEl) parentNameEl.textContent = parentRecord.full_name;
  if (avatarEl && parentRecord.full_name) {
    avatarEl.textContent = parentRecord.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // 2. Fetch ALL linked children with their Class and Section details
  const { data: links, error: linkError } = await supabase
    .from('Parent_Student_Links')
    .select(`
            relationship,
            Students (
                student_id, 
                full_name,
                Classes (class_name, section)
            )
        `)
    .eq('parent_id', parentRecord.parent_id);

  const selector = document.getElementById('childSelector');
  if (linkError || !links || links.length === 0) {
    if (selector) selector.innerHTML = '<option disabled>No children linked</option>';
    return;
  }

  // 3. Populate the Dropdown with Name and Class info
  selector.innerHTML = '';
  links.forEach((link, index) => {
    const student = link.Students;
    const className = student.Classes
      ? `${student.Classes.class_name} ${student.Classes.section}`
      : 'Unassigned Class';

    const option = document.createElement('option');
    option.value = student.student_id;
    option.textContent = `${student.full_name} (${className})`;

    if (index === 0) option.selected = true;
    selector.appendChild(option);
  });

  // 4. Handle Switching Event
  selector.addEventListener('change', async (e) => {
    const selectedId = e.target.value;
    await updateDashboardForChild(selectedId, links);
  });

  // Initial Dashboard Load for the first child in the list
  await updateDashboardForChild(selector.value, links);
}

async function updateDashboardForChild(childId, links) {
  // Update relationship text (e.g., "Father of Alex")
  const selectedLink = links.find(l => l.Students.student_id === childId);
  const childNameEl = document.querySelector('.user-details p');
  if (childNameEl && selectedLink) {
    childNameEl.textContent = `${selectedLink.relationship} of ${selectedLink.Students.full_name}`;
  }

  // Trigger the data fetching functions for the specific child
  await fetchChildGrades(childId);
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