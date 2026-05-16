/**
 * studentProfileAchivement.js
 */

import { supabase } from '../../core/config.js';
import { showSkeleton, hideSkeleton } from '../../assets/js-shared/ui-engine.js';
import { waitForUser } from '/core/perf.js';

const SKELETONS = [
  { skel: 'upcomingClassesSkeleton', content: 'upcomingClassesGrid' },
  { skel: 'subjectsSkeleton',        content: 'subjectsGrid' },
  { skel: 'activitySkeleton',        content: 'activityFeed' },
];

const SUBJECT_ICONS = {
  math: 'fa-calculator', english: 'fa-book-open', science: 'fa-flask',
  chemistry: 'fa-flask', physics: 'fa-atom', biology: 'fa-dna',
  history: 'fa-landmark', geography: 'fa-mountain', ict: 'fa-laptop-code',
  art: 'fa-palette', music: 'fa-music', civics: 'fa-balance-scale', default: 'fa-book',
};

function getSubjectIcon(name = '') {
  const lower = name.toLowerCase();
  const key = Object.keys(SUBJECT_ICONS).find(k => lower.includes(k));
  return SUBJECT_ICONS[key] || SUBJECT_ICONS.default;
}

// ✅ FIX 1: Hide BOTH the hardcoded HTML skeleton wrappers AND the injected skeletons
function forceHideAllSkeletons() {
  SKELETONS.forEach(({ skel, content }) => {
    // Hide the hardcoded HTML skeleton div (e.g. subjectsSkeleton)
    const skelEl = document.getElementById(skel);
    if (skelEl) skelEl.style.display = 'none';

    // Show and clear the real content container
    const contentEl = document.getElementById(content);
    if (contentEl) {
      contentEl.style.display = '';
      contentEl.classList.remove('skeleton-loading');
    }
  });
}

function updateSubtitle(text) {
  const el = document.getElementById('newNotesMsg');
  if (el) el.textContent = text;
}

function timeAgo(dateString) {
  if (!dateString) return 'Recently';
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateString).toLocaleDateString();
}

let failSafeTimer = null;
function startFailSafe() {
  failSafeTimer = setTimeout(() => {
    forceHideAllSkeletons();
    updateSubtitle("Some data couldn't load. Try refreshing.");
  }, 6000);
}
function clearFailSafe() {
  if (failSafeTimer) clearTimeout(failSafeTimer);
}

// ─── Entry Point ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  startFailSafe();

  // Hide content containers immediately; show skeleton wrappers
  ['subjectsGrid', 'activityFeed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  try {
    const student = await initStudentSession();
    if (!student) {
      forceHideAllSkeletons();
      return;
    }

    await Promise.all([
      fetchStudentStats(student),
      fetchTodaySchedule(student.student_id, student.class_id),
      fetchMySubjects(student.class_id)
        .then(subjects => fetchLiveActivity(subjects))
        .catch(() => fetchLiveActivity([])),
    ]);
  } catch (outerErr) {
    console.error('[Dashboard] Crash:', outerErr);
  } finally {
    forceHideAllSkeletons();
    clearFailSafe();
  }
});

// ─── Session ───────────────────────────────────────────────────────────────
async function initStudentSession() {
  try {
    const user = await waitForUser();
    if (!user) return null;

    const { data: student, error: studentError } = await supabase
      .from('Students')
      .select(`*, Classes(class_name), Parent_Student_Links(Parents(*))`)
      .eq('student_id', user.id)
      .single();

    if (studentError || !student) {
      console.error('[Dashboard] Student lookup failed:', studentError?.message);
      return null;
    }

    const nameEl = document.getElementById('studentName');
    if (nameEl) nameEl.textContent = student.full_name?.split(' ')[0] || 'Student';

    updateSubtitle(`Welcome to ${student.Classes?.class_name || 'your dashboard'}`);

    return student;
  } catch (err) {
    console.error('[Dashboard] Session error:', err);
    return null;
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────
async function fetchStudentStats(student) {
  try {
    const pointsEl = document.getElementById('pointsValue');
    if (pointsEl) pointsEl.textContent = (student.total_points || 0).toLocaleString();

    if (!student.class_id) return;

    const { data: classmates } = await supabase
      .from('Students')
      .select('student_id, total_points')
      .eq('class_id', student.class_id)
      .order('total_points', { ascending: false });

    if (classmates) {
      const rankIdx = classmates.findIndex(s => s.student_id === student.student_id);
      const rank = rankIdx >= 0 ? rankIdx + 1 : null;
      if (rank) {
        const suffix = n => (['th','st','nd','rd'][(n%10<4 && (n<11||n>13)) ? n%10 : 0] || 'th');
        const rankEl = document.getElementById('rankValue');
        if (rankEl) rankEl.textContent = `${rank}${suffix(rank)}`;
      }
    }
  } catch (err) { console.error('Stats error:', err); }
}

// ─── Schedule ──────────────────────────────────────────────────────────────
async function fetchTodaySchedule(studentId, classId) {
  try {
    if (!classId) {
      renderTodayClasses([], 'upcomingClassesGrid', 'Today');
      return;
    }
    const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const { data: entries } = await supabase
      .from('timetable_entries')
      .select('start_time, duration_minutes, Subjects(subject_name)')
      .eq('class_id', classId)
      .eq('day_of_week', today)
      .order('start_time', { ascending: true });

    // ✅ FIX 2: Populate the "Today" stat card
    const todayEl = document.getElementById('todayClasses');
    if (todayEl) todayEl.textContent = (entries || []).length;

    renderTodayClasses(entries || [], 'upcomingClassesGrid', today);
  } catch (err) {
    console.error('Schedule error:', err);
  } finally {
    // Hide the hardcoded skeleton for this section too
    const skel = document.getElementById('upcomingClassesSkeleton');
    if (skel) skel.style.display = 'none';
  }
}

function renderTodayClasses(entries, containerId, dayName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = `<p class="empty-msg">No classes scheduled for ${dayName}.</p>`;
    return;
  }
  container.innerHTML = entries.map(entry => {
    const name = entry.Subjects?.subject_name || 'Unknown';
    const [h, m] = entry.start_time.split(':');
    const d = new Date(); d.setHours(+h, +m);
    return `
      <div class="class-card">
        <div class="class-header">
          <div class="class-icon"><i class="fas ${getSubjectIcon(name)}"></i></div>
          <div class="class-info"><h4>${name}</h4><p>${entry.duration_minutes} min</p></div>
        </div>
        <div class="class-time">${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
      </div>`;
  }).join('');
}

// ─── Subjects ──────────────────────────────────────────────────────────────
async function fetchMySubjects(classId) {
  try {
    if (!classId) return [];

    const { data, error } = await supabase
      .from('Class_Subjects')
      .select('Subjects(subject_id, subject_name)')
      .eq('class_id', classId);

    if (error) console.error('Subjects query error:', error);

    const subjects = (data || []).map(item => item.Subjects).filter(Boolean);

    // ✅ FIX 3: Populate the "Subjects" stat card
    const subjectsEl = document.getElementById('subjectsCount');
    if (subjectsEl) subjectsEl.textContent = subjects.length;

    // ✅ FIX 4: Hide skeleton wrapper, show real grid, then render
    const skelEl = document.getElementById('subjectsSkeleton');
    if (skelEl) skelEl.style.display = 'none';

    const gridEl = document.getElementById('subjectsGrid');
    if (gridEl) gridEl.style.display = '';

    renderSubjectsGrid(subjects, 'subjectsGrid');
    return subjects;
  } catch (err) {
    console.error('Subjects error:', err);
    return [];
  }
}

function renderSubjectsGrid(subjects, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!subjects.length) {
    container.innerHTML = `<p class="empty-msg">No subjects enrolled.</p>`;
    return;
  }
  container.innerHTML = subjects.map((s, i) => `
    <a href="./studyMaterials.html?subject=${encodeURIComponent(s.subject_name)}"
       class="subject-card" data-color="${i % 8}">
      <div class="subject-icon"><i class="fas ${getSubjectIcon(s.subject_name)}"></i></div>
      <span class="subject-name">${s.subject_name}</span>
    </a>`).join('');
}

// ─── Activity Feed ─────────────────────────────────────────────────────────
async function fetchLiveActivity(subjects) {
  // ✅ FIX 5: Always hide skeleton wrapper first
  const skelEl = document.getElementById('activitySkeleton');
  if (skelEl) skelEl.style.display = 'none';

  const feedEl = document.getElementById('activityFeed');
  if (feedEl) feedEl.style.display = '';

  try {
    if (!subjects.length) {
      if (feedEl) feedEl.innerHTML = `<p class="activity-empty"><i class="fas fa-inbox"></i>No subjects enrolled yet.</p>`;
      return;
    }

    const names = subjects.map(s => s.subject_name);
    const { data: materials, error } = await supabase
      .from('study_materials')
      .select('*')
      .in('subject', names)
      .order('uploaded_at', { ascending: false })
      .limit(5);

    if (error) console.error('[Activity] Query error:', error);

    if (!feedEl) return;

    if (!materials?.length) {
      feedEl.innerHTML = `<p class="activity-empty"><i class="fas fa-inbox"></i>No recent materials.</p>`;
      return;
    }

    feedEl.innerHTML = materials.map(m => `
      <div class="activity-item">
        <div class="activity-dot" style="background:var(--primary)">
          <i class="fas ${getSubjectIcon(m.subject)}"></i>
        </div>
        <div class="activity-body">
          <div class="activity-title">${m.title}</div>
          <div class="activity-meta">
            <span class="activity-subject-tag">${m.subject}</span>
            <span>${timeAgo(m.uploaded_at)}</span>
          </div>
        </div>
      </div>`).join('');
  } catch (err) {
    console.error('Activity error:', err);
    if (feedEl) feedEl.innerHTML = `<p class="activity-empty"><i class="fas fa-exclamation-circle"></i>Couldn't load updates.</p>`;
  }
}