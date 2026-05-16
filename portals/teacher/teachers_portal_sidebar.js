// teachers_portal_sidebar.js — ES Module
// Injects the sidebar HTML with dynamic school branding.

import { supabase } from '../../core/config.js';
import { waitForUser, cached } from '../../core/perf.js';

(async function () {
    function teacherPrefix() {
        return '/teacher/';
    }

    function sharedPrefix() {
        return '/student/';
    }

    // OPTIMIZED: uses window.currentUser (no extra auth round-trip)
    //            caches branding in sessionStorage for instant subsequent loads
    async function getSchoolBranding() {
        const user = await waitForUser();
        if (!user?.user_metadata?.school_id) {
            return { school_name: 'TeachSmart', school_logo_url: null };
        }
        const schoolId = user.user_metadata.school_id;

        return cached(`branding_${schoolId}`, async () => {
            const { data: school, error } = await supabase
                .from('Schools')
                .select('school_name, school_logo_url')
                .eq('school_id', schoolId)
                .single();
            if (error) throw error;
            return school || { school_name: 'TeachSmart', school_logo_url: null };
        });
    }

    // SVG icon helpers (unchanged)
    const homeIcon   = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9,22 9,12 15,12 15,22"></polyline></svg>`;
    const usersIcon  = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
    const bookIcon   = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>`;
    const chartIcon  = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
    const uploadIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>`;
    const noteIcon   = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
    const linkIcon   = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    const aiIcon     = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>`;

    function buildSidebar(t, sh, branding = { school_name: 'TeachSmart', school_logo_url: null }) {
        return `
            <div class="logo">
                <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
                    ${branding.school_logo_url
                        ? `<img src="${branding.school_logo_url}" alt="School Logo" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">`
                        : `<i class="fa-solid fa-graduation-cap" style="font-size: 24px; color: #667eea;"></i>`}
                    <span style="font-weight: 600; color: #1e293b; font-size: 16px;">${branding.school_name}</span>
                </div>
            </div>
            <ul class="sidebar-menu">
                <li><a href="${t}teachersPortal" class="nav-item">${homeIcon} Dashboard</a></li>
                <li><a href="${t}listOfStudents" class="nav-item">${usersIcon} Students</a></li>
                <li><a href="${t}curriculum" class="nav-item">${bookIcon} Scheme of Work</a></li>
                <li><a href="${t}attendance" class="nav-item">${chartIcon} Attendance</a></li>
                <li><a href="${t}upload_results" class="nav-item">${uploadIcon} Upload Results</a></li>
                <li><a href="${t}upload_notes" class="nav-item">${noteIcon} Upload Notes</a></li>
                <li><a href="${t}ai_assistant" class="nav-item">${aiIcon} AI Assistant</a></li>
                <li><a href="${sh}manage_notes" class="nav-item">${linkIcon} Manage Notes</a></li>
            </ul>
            <div class="user-section">
                <button class="logout-btn" id="sidebarLogoutBtn">Logout</button>
            </div>`;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const sidebarEl = document.querySelector('[data-sideBar]');
        if (!sidebarEl) return;

        const t  = teacherPrefix();
        const sh = sharedPrefix();

        // PARALLEL: branding fetch runs while DOM is being parsed
        const branding = await getSchoolBranding();
        sidebarEl.innerHTML = buildSidebar(t, sh, branding);

        // Active link highlighting
        const currentPath = window.location.pathname;
        sidebarEl.querySelectorAll('.nav-item').forEach(link => {
            const href     = link.getAttribute('href') || '';
            const filename = href.split('/').pop();
            if (filename && filename !== '#' && currentPath.endsWith(filename)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Logout
        const logoutBtn = document.getElementById('sidebarLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.href = '/login';
            });
        }
    });
})();
