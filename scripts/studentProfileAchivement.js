/**
 * studentProfileAchivement.js — Decoupled, Fail-Safe Edition
 *
 * Architecture:
 *  ┌─ initStudentSession()  ← HANDSHAKE: nothing runs without a valid student
 *  │
 *  ├─ fetchStudentStats()   ──┐
 *  ├─ fetchTodaySchedule()  ──┤ all run in parallel via Promise.all
 *  └─ fetchMySubjects()  ────┘
 *       └── .then(ids) → fetchLiveActivity(ids)   ← chained, not nested
 *
 *  FAIL-SAFE: A 5-second timeout force-hides all skeletons regardless of
 *  whether any fetch succeeded, so the user always gets an empty state
 *  instead of an infinite shimmer.
 */

import { supabase } from '../../scripts/config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const SKELETONS = [
  { skel: 'upcomingClassesSkeleton', content: 'upcomingClassesGrid' },
  { skel: 'subjectsSkeleton', content: 'subjectsGrid' },
  { skel: 'activitySkeleton', content: 'activityFeed' },
];

const SUBJECT_ICONS = {
  math: 'fa-calculator',
  english: 'fa-book-open',
  science: 'fa-flask',
  chemistry: 'fa-flask',
  physics: 'fa-atom',
  biology: 'fa-dna',
  history: 'fa-landmark',
  geography: 'fa-mountain',
  ict: 'fa-laptop-code',
  art: 'fa-palette',
  music: 'fa-music',
  civics: 'fa-balance-scale',
  default: 'fa-book',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getSubjectIcon(name = '') {
  const lower = name.toLowerCase();
  const key = Object.keys(SUBJECT_ICONS).find(k => lower.includes(k));
  return SUBJECT_ICONS[key] || SUBJECT_ICONS.default;
}

/** Hides a skeleton and reveals its content element. */
function hideSkeleton(skelId, contentId) {
  const skel = document.getElementById(skelId);
  const cont = document.getElementById(contentId);
  if (skel) skel.style.display = 'none';
  if (cont) cont.style.display = '';
}

/** Force-hides ALL skeleton loaders — used by the fail-safe timer. */
function forceHideAllSkeletons() {
  SKELETONS.forEach(({ skel, content }) => hideSkeleton(skel, content));
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
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// ① FAIL-SAFE — set up before any async work
// ─────────────────────────────────────────────────────────────────────────────
let failSafeTimer = null;

function startFailSafe() {
  failSafeTimer = setTimeout(() => {
    console.warn('[Dashboard] Fail-safe triggered — forcing skeletons to hide.');
    forceHideAllSkeletons();
    updateSubtitle("Some data couldn't load. Please refresh.");
  }, 5000);
}

function clearFailSafe() {
  if (failSafeTimer) {
    clearTimeout(failSafeTimer);
    failSafeTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  startFailSafe();  // ← insurance policy before any await

  try {
    // HANDSHAKE — everything depends on student identity
    const student = await initStudentSession();

    if (!student) {
      // Auth guard should have caught this, but just in case
      updateSubtitle("Couldn't load your profile.");
      forceHideAllSkeletons();
      clearFailSafe();
      return;
    }

    // ── PARALLEL TRACKS ──────────────────────────────────────────────────
    // Stats & Schedule run independently.
    // Subjects run independently; when they resolve, Activity is chained off
    // them (because it needs the subject ID list). These three promises
    // don't block each other at all.
    await Promise.all([
      fetchStudentStats(student),
      fetchTodaySchedule(student.student_id, student.class_id),
      // Pass class_id — subjects now come from the class assignment, not per-student enrollment
      fetchMySubjects(student.class_id)
        // Chain activity feed off subjects, but NEVER let a subjects
        // failure prevent the activity feed from hiding its skeleton.
        .then(subjects => fetchLiveActivity(subjects))
        .catch(() => fetchLiveActivity([])),
    ]);

  } catch (outerErr) {
    // Last resort: something completely unexpected blew up
    console.error('[Dashboard] Outer crash:', outerErr);
    forceHideAllSkeletons();
    updateSubtitle("An error occurred. Please refresh.");
  } finally {
    clearFailSafe();  // cancel the 5s timer — we're done (however we got here)
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ② SESSION — the handshake; all data is keyed on student_id = user.id
// ─────────────────────────────────────────────────────────────────────────────
async function initStudentSession() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    // Flat query only — no joins; an unregistered FK silently returns a 400
    const { data: student, error: studentError } = await supabase
      .from('Students')
      .select('student_id, class_id, full_name, total_points')
      .eq('student_id', user.id)
      .single();

    if (studentError || !student) {
      console.error('[Dashboard] Student lookup failed:', studentError?.message);
      return null;
    }

    // Update header with first name & initial
    const firstName = student.full_name?.split(' ')[0] || 'Student';
    const nameEl = document.getElementById('studentName');
    if (nameEl) nameEl.textContent = firstName;

    const initEl = document.getElementById('profileInitial');
    if (initEl && student.full_name) initEl.textContent = student.full_name[0].toUpperCase();

    updateSubtitle('Loading your notes…');

    // Non-blocking class name fetch — failure is silent
    if (student.class_id) {
      supabase
        .from('Classes')
        .select('class_name')
        .eq('class_id', student.class_id)   // ← correct PK column
        .maybeSingle()
        .then(({ data: cls }) => {
          if (cls?.class_name) {
            const el = document.getElementById('newNotesMsg');
            // Only update if still showing the placeholder
            if (el && el.textContent === 'Loading your notes…') {
              el.textContent = `${cls.class_name} · Loading your notes…`;
            }
          }
        })
        .catch(() => { });
    }

    return student;
  } catch (err) {
    console.error('[Dashboard] Session init error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ③ STATS — Points & Class Rank
// ─────────────────────────────────────────────────────────────────────────────
async function fetchStudentStats(student) {
  try {
    const pointsEl = document.getElementById('pointsValue');
    if (pointsEl) pointsEl.textContent = (student.total_points || 0).toLocaleString();

    if (!student.class_id) return;

    const { data: classmates, error } = await supabase
      .from('Students')
      .select('student_id, total_points')
      .eq('class_id', student.class_id)
      .order('total_points', { ascending: false });

    if (error || !classmates) return;

    const rankIdx = classmates.findIndex(s => s.student_id === student.student_id);
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;

    if (rank) {
      const suffix = n => (['th', 'st', 'nd', 'rd'][(n % 10 < 4 && (n < 11 || n > 13)) ? n % 10 : 0] || 'th');
      const rankEl = document.getElementById('rankValue');
      if (rankEl) rankEl.textContent = `${rank}${suffix(rank)}`;
    }
  } catch (err) {
    console.error('[Dashboard] Stats error:', err);
    // Non-critical — no skeleton to hide here
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ④ TODAY'S SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTodaySchedule(studentId, classId) {
  try {
    if (!classId) {
      renderTodayClasses([], 'upcomingClassesGrid');
      return;
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const { data: entries, error } = await supabase
      .from('timetable_entries')
      .select('start_time, duration_minutes, Subjects(subject_name)')
      .eq('class_id', classId)
      .eq('day_of_week', today)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('[Dashboard] Schedule query error:', error.message);
      renderTodayClasses([], 'upcomingClassesGrid', today);
      return;
    }

    renderTodayClasses(entries || [], 'upcomingClassesGrid', today);

    const todayEl = document.getElementById('todayClasses');
    if (todayEl) todayEl.textContent = (entries || []).length;
  } catch (err) {
    console.error('[Dashboard] Schedule error:', err);
    renderTodayClasses([], 'upcomingClassesGrid');
  } finally {
    hideSkeleton('upcomingClassesSkeleton', 'upcomingClassesGrid');
  }
}

function renderTodayClasses(entries, containerId, dayName = 'today') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `
        <p style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">
            <i class="fas fa-coffee" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.4;"></i>
            No classes scheduled for ${dayName}.
        </p>`;
    return;
  }

  const palette = [
    { bg: '#e0f2fe', color: '#0284c7' },
    { bg: '#dcfce7', color: '#16a34a' },
    { bg: '#f3e8ff', color: '#9333ea' },
    { bg: '#fef9c3', color: '#ca8a04' },
    { bg: '#fce7f3', color: '#db2777' },
  ];

  container.innerHTML = entries.map((entry, i) => {
    const name = entry.Subjects?.subject_name || 'Unknown Subject';
    const c = palette[i % palette.length];
    const icon = getSubjectIcon(name);
    const [h, m] = entry.start_time.split(':');
    const d = new Date(); d.setHours(+h, +m);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return `
        <div class="class-card">
            <div class="class-header">
                <div class="class-icon" style="background:${c.bg};color:${c.color};">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="class-info">
                    <h4>${name}</h4>
                    <p>${entry.duration_minutes} min</p>
                </div>
            </div>
            <div class="class-time">${time}</div>
        </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ MY SUBJECTS — Class_Subjects → Subjects (class-level, not per-student)
//
//    Logic: class_id → Class_Subjects → subject_ids → Subjects
//
//    This means: assign a student to "Grade 10-A" and ALL Grade 10-A subjects
//    appear automatically. No per-student enrollment rows needed.
//
//    Returns the resolved subject ID array so fetchLiveActivity can chain off it.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchMySubjects(classId) {
  try {
    if (!classId) {
      console.warn('[Dashboard] No class_id — student may not be assigned to a class yet.');
      renderSubjectsGrid([], 'subjectsGrid');
      return [];
    }

    // STEP 1: Get subject_ids for this class (flat — no FK join)
    const { data: classSubjectsData, error: csError } = await supabase
      .from('Class_Subjects')
      .select('subject_id')
      .eq('class_id', classId);

    if (csError) {
      console.error('[Dashboard] Class_Subjects query error:', csError.message);
      renderSubjectsGrid([], 'subjectsGrid');
      return [];
    }

    const subjectIds = (classSubjectsData || []).map(r => r.subject_id).filter(Boolean);

    if (!subjectIds.length) {
      renderSubjectsGrid([], 'subjectsGrid');
      return [];
    }

    // STEP 2: Fetch subject details by ID
    const { data: subjectsData, error: subjError } = await supabase
      .from('Subjects')
      .select('subject_id, subject_name')
      .in('subject_id', subjectIds);

    if (subjError) {
      console.error('[Dashboard] Subjects fetch error:', subjError.message);
      renderSubjectsGrid([], 'subjectsGrid');
      return [];
    }

    const subjects = subjectsData || [];
    renderSubjectsGrid(subjects, 'subjectsGrid');

    const countEl = document.getElementById('subjectsCount');
    if (countEl) countEl.textContent = subjects.length;

    return subjects; // Return full objects so activity feed can use subject_name
  } catch (err) {
    console.error('[Dashboard] Subjects error:', err);
    renderSubjectsGrid([], 'subjectsGrid');
    return [];
  } finally {
    hideSkeleton('subjectsSkeleton', 'subjectsGrid');
  }
}

function renderSubjectsGrid(subjects, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `
        <p style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">
            <i class="fas fa-layer-group" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.4;"></i>
            No subjects enrolled yet.
        </p>`;
    return;
  }

  container.innerHTML = subjects.map((s, i) => `
        <a href="./studyMaterials.html?subject=${encodeURIComponent(s.subject_name)}"
           class="subject-card" data-color="${i % 8}" title="View ${s.subject_name} materials">
            <div class="subject-icon"><i class="fas ${getSubjectIcon(s.subject_name)}"></i></div>
            <span class="subject-name">${s.subject_name}</span>
        </a>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ LIVE ACTIVITY FEED
//    Aligned with Study Materials page: queries study_materials and applies the 
//    "Catch-All" negative filter so everything not a Past Paper counts.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLiveActivity(subjects) {
  try {
    if (!subjects || !subjects.length) {
      renderActivityFeed([]);
      updateSubtitle("Here's what's happening today.");
      return;
    }

    const subjectNames = subjects.map(s => s.subject_name).filter(Boolean);

    // Simple flat query from study_materials
    const { data: materials, error } = await supabase
      .from('study_materials')
      .select('*')
      .in('subject', subjectNames)
      .order('uploaded_at', { ascending: false })
      .limit(10); // Fetch a bit more so we can filter

    if (error) {
      console.error('[Dashboard] Activity feed query error:', error.message);
      renderActivityFeed([]);
      updateSubtitle("Here's what's happening today.");
      return;
    }

    // Exact same calculation logic: exclude past papers!
    const validNotes = (materials || []).filter(m => !(m.type && m.type.toLowerCase().includes('paper')));

    // Pass the top 5 valid notes to the feed
    renderActivityFeed(validNotes.slice(0, 5));

    // Count new notes in the last 7 days for the personalised greeting
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentMaterials } = await supabase
      .from('study_materials')
      .select('type')
      .in('subject', subjectNames)
      .gte('uploaded_at', sevenDaysAgo);

    const recentValidNotes = (recentMaterials || []).filter(m => !(m.type && m.type.toLowerCase().includes('paper')));
    const newCount = recentValidNotes.length;

    if (newCount && newCount > 0) {
      updateSubtitle(`You have ${newCount} new note${newCount !== 1 ? 's' : ''} to review this week.`);
    } else {
      updateSubtitle("Here's what's happening today.");
    }
  } catch (err) {
    console.error('[Dashboard] Activity feed error:', err);
    renderActivityFeed([], []);
    updateSubtitle("Here's what's happening today.");
  } finally {
    hideSkeleton('activitySkeleton', 'activityFeed');
  }
}

function renderActivityFeed(notes) {
  const container = document.getElementById('activityFeed');
  if (!container) return;

  if (!notes.length) {
    container.innerHTML = `
        <div class="activity-empty">
            <i class="fas fa-inbox"></i>
            No recent uploads in your subjects yet.
        </div>`;
    return;
  }

  const dotColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];

  container.innerHTML = notes.map((note, i) => {
    // Title fallback chain — covers all plausible column names
    const title = note.title || note.topic || note.note_title || note.name
      || (note.content ? note.content.substring(0, 60) : null)
      || 'Untitled Note';
    const dotColor = dotColors[i % dotColors.length];
    const when = timeAgo(note.created_at || note.uploaded_at);

    // Subject name: if Lesson_Notes has a subject_name column use it; otherwise show ID
    const subjectName = note.subject_name || note.Subjects?.subject_name || `Subject`;

    return `
        <div class="activity-item">
            <div class="activity-dot" style="background:${dotColor};">
                <i class="fas ${getSubjectIcon(subjectName)}"></i>
            </div>
            <div class="activity-body">
                <div class="activity-title" title="${title}">${title}</div>
                <div class="activity-meta">
                    <span class="activity-subject-tag">${subjectName}</span>
                    <span>${when}</span>
                </div>
            </div>
        </div>`;
  }).join('');
}
