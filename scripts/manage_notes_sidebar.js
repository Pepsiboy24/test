import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://dzotwozhcxzkxtunmqth.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function initializeSidebar() {
    const sidebarContainer = document.querySelector('[data-sideBar]');
    if (!sidebarContainer) return;

    // 1. Get User Session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        console.warn('Sidebar: Unauthorized. Redirecting to login...');
        window.location.href = '/login.html';
        return;
    }

    // 2. Resolve the User Role
    //    School_Admin → matched by email (no user_id column)
    //    Teachers     → matched by teacher_id = auth user.id
    let userRole = null;

    const [adminCheck, teacherCheck] = await Promise.all([
        supabaseClient.from('School_Admin').select('admin_id').eq('email', user.email).maybeSingle(),
        supabaseClient.from('Teachers').select('teacher_id').eq('teacher_id', user.id).maybeSingle()
    ]);

    if (adminCheck.data) {
        userRole = 'school_admin';
    } else if (teacherCheck.data) {
        userRole = 'teacher';
    }

    // 3. Permission Check
    if (!userRole) {
        console.error('Sidebar: Role not recognized.');
        sidebarContainer.innerHTML = `<div style="padding:16px;color:#ef4444;font-size:14px;">Access Denied</div>`;
        return;
    }

    // 4. Apply body theme class
    document.body.classList.remove('admin-theme', 'teacher-theme');
    document.body.classList.add(userRole === 'school_admin' ? 'admin-theme' : 'teacher-theme');

    // 5. For the teacher theme: swap the layout wrapper classes so the
    //    teacher portal CSS (.main-content, no .container) applies correctly.
    if (userRole === 'teacher') {
        const container = document.querySelector('.container');
        const main = document.querySelector('.main');

        // Remove admin-specific wrapper — teacher portal body is already flex
        if (container && main) {
            // Lift .main out of .container, swap class to .main-content
            main.classList.remove('main');
            main.classList.add('main-content');
            container.replaceWith(main); // remove the .container wrapper
        }

        // Add tp-shared.css dynamically
        const tpSharedLink = document.createElement('link');
        tpSharedLink.rel = 'stylesheet';
        tpSharedLink.href = '../../styles/teachersPortalStyles/tp-shared.css';
        document.head.appendChild(tpSharedLink);

        // Inject the mobile top bar and overlay so it matches other teacher pages
        document.body.insertAdjacentHTML('afterbegin', `
            <div class="mobile-top-bar" id="mobileTopBar">
                <span class="brand">TeachSmart</span>
                <button class="hamburger-btn" id="hamburgerBtn" aria-label="Toggle sidebar">
                    <span></span><span></span><span></span>
                </button>
            </div>
            <div class="sidebar-overlay" id="sidebarOverlay"></div>
        `);

        // Transform the admin .header into the teacher .page-header
        const oldHeader = document.querySelector('.header');
        if (oldHeader) {
            oldHeader.className = 'page-header';
            
            // Keep the title and subtitle elements so manage_notes.js can update them
            const pTitle = document.getElementById('pageTitle');
            const pSubtitle = document.getElementById('pageSubtitle');
            
            if (pTitle && pSubtitle) {
                // Clear the old header HTML (removes the mobile-menu-btn and flex wrappers)
                oldHeader.innerHTML = '';
                // Strip existing classes that might conflict with page-header styles
                pTitle.className = '';
                pSubtitle.className = '';
                oldHeader.appendChild(pTitle);
                oldHeader.appendChild(pSubtitle);
            }
        }

        // Attach event listeners for the newly injected hamburger and overlay
        setTimeout(() => {
            const btn = document.getElementById('hamburgerBtn');
            const sidebar = document.querySelector('[data-sideBar]');
            const overlay = document.getElementById('sidebarOverlay');
            
            const open = () => { sidebar.classList.add('active'); overlay.classList.add('active'); };
            const close = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };
            
            if (btn) btn.addEventListener('click', () => sidebar.classList.contains('active') ? close() : open());
            if (overlay) overlay.addEventListener('click', close);
        }, 0);
    }

    // 6. Active link helper
    const currentPath = window.location.pathname;
    function isActive(path) {
        return currentPath.endsWith(path.split('/').pop());
    }

    if (userRole === 'school_admin') {
        // ── ADMIN sidebar — matches school_admin_sidebar.js exactly ──────────
        const links = [
            { title: 'Dashboard', icon: 'fa-table-columns', path: '/html/schoolAdmin/schoolAdminDashboard.html' },
            { title: 'Classes', icon: 'fa-chalkboard-user', path: '/html/schoolAdmin/classes.html' },
            { title: 'Students', icon: 'fa-user-graduate', path: '/html/schoolAdmin/students.html' },
            { title: 'Teachers', icon: 'fa-chalkboard-teacher', path: '/html/schoolAdmin/teachers.html' },
            { title: 'School Admins', icon: 'fa-user-tie', path: '/html/schoolAdmin/schooladmins.html' },
            { title: 'Academic Manager', icon: 'fa-book-open', path: '/html/schoolAdmin/academic_manager.html' },
            { title: 'Schedule', icon: 'fa-calendar', path: '/html/schoolAdmin/schedule.html' },
            { title: 'Time Table', icon: 'fa-clock', path: '/html/schoolAdmin/timeTable.html' },
            { title: 'Manage Notes', icon: 'fa-file-lines', path: '/html/shared/manage_notes.html' }
        ];

        sidebarContainer.innerHTML = `
            <div class="logo">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                    <span>EduHubAdmin</span>
                </div>
                <div class="icon mobile-menu-btn" data-sideBarClose><i class="fa fa-times"></i></div>
            </div>
            <nav style="display: flex; flex-direction: column; flex: 1;">
                ${links.map(link => `
                <a href="${link.path}" class="nav-item${isActive(link.path) ? ' active' : ''}">
                    <i class="fa-solid ${link.icon} nav-icon"></i>
                    <span>${link.title}</span>
                </a>`).join('')}
                
                <a href="#" id="manageNotesLogoutBtn" class="nav-item" style="margin-top: auto; border-top: 1px solid var(--border); border-radius: 0; padding-top: 16px;">
                    <i class="fa-solid fa-sign-out-alt nav-icon"></i>
                    Logout
                </a>
            </nav>
        `;

        const closeBtn = sidebarContainer.querySelector('[data-sideBarClose]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebarContainer.classList.remove('show', 'open', 'active');
            });
        }

    } else {
        // ── TEACHER sidebar — matches teachers_portal_sidebar.js exactly ─────
        // Uses SVG icons to match the original teacher portal exactly
        const homeIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9,22 9,12 15,12 15,22"></polyline></svg>`;
        const usersIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
        const bookIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>`;
        const chartIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
        const uploadIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>`;
        const noteIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
        const linkIcon = `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;

        const links = [
            { title: 'Dashboard', icon: homeIcon, path: '/html/teachersPortal/teachersPortal.html' },
            { title: 'Students', icon: usersIcon, path: '/html/teachersPortal/listOfStudents.html' },
            { title: 'Scheme of Work', icon: bookIcon, path: '/html/teachersPortal/curriculum.html' },
            { title: 'Attendance', icon: chartIcon, path: '/html/teachersPortal/attendance.html' },
            { title: 'Upload Results', icon: uploadIcon, path: '/html/teachersPortal/upload_results.html' },
            { title: 'Upload Notes', icon: uploadIcon, path: '/html/teachersPortal/upload_notes.html' },
            { title: 'AI Assistant', icon: noteIcon, path: '/html/teachersPortal/ai_assistant.html' },
            { title: 'Manage Notes', icon: noteIcon, path: '/html/shared/manage_notes.html' }
        ];

        sidebarContainer.innerHTML = `
            <div class="logo">TeachSmart</div>
            <ul class="sidebar-menu">
                ${links.map(link => `
                <li>
                    <a href="${link.path}" class="nav-item${isActive(link.path) ? ' active' : ''}">
                        ${link.icon} ${link.title}
                    </a>
                </li>`).join('')}
            </ul>
            <div class="user-section">
                <button class="logout-btn" id="manageNotesLogoutBtn">Logout</button>
            </div>
        `;
    }

    // Attach click listener for the logout button (shared for both admins and teachers)
    const logoutBtn = document.getElementById('manageNotesLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await supabaseClient.auth.signOut();
            } catch (error) {
                console.error("Logout Error:", error);
            }
            window.location.href = '/index.html';
        });
    }
}

// Auto-init when this module is imported
initializeSidebar();
