// school_admin_sidebar.js
// Uses runtime path detection so links are correct from BOTH:
//   html/schoolAdmin/anyPage.html  → prefix = "./"
//   html/shared/anyPage.html       → prefix = "../schoolAdmin/"

(function () {
    // Compute the relative path from the current page to the schoolAdmin folder
    function adminPrefix() {
        const path = window.location.pathname;
        if (path.includes('/html/shared/')) return '../schoolAdmin/';
        return './';          // default: already in schoolAdmin
    }

    // Compute path to the shared folder from the current page
    function sharedPrefix() {
        const path = window.location.pathname;
        if (path.includes('/html/shared/')) return './';
        return '../shared/';  // from schoolAdmin → go up one, into shared
    }

    function buildSidebar() {
        const a = adminPrefix();
        const sh = sharedPrefix();

        return `
            <div class="logo">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                    <span>EduHubAdmin</span>
                </div>
                <div class="icon mobile-menu-btn" data-sideBarClose><i class="fa fa-times"></i></div>
            </div>
            <nav style="display: flex; flex-direction: column; flex: 1;">
                <a href="${a}schoolAdminDashboard.html" class="nav-item">
                    <i class="fa-solid fa-table-columns nav-icon"></i>
                    Dashboard
                </a>
                <a href="${a}classes.html" class="nav-item">
                    <i class="fa-solid fa-chalkboard-user nav-icon"></i>
                    <span>Classes</span>
                </a>
                <a href="${a}students.html" class="nav-item">
                    <i class="fa-solid fa-user-graduate nav-icon"></i>
                    Students
                </a>
                <a href="${a}teachers.html" class="nav-item">
                    <i class="fa-solid fa-chalkboard-teacher nav-icon"></i>
                    Teachers
                </a>
                <a href="${a}schooladmins.html" class="nav-item">
                    <i class="fa-solid fa-user-tie nav-icon"></i>
                    School Admins
                </a>
                <a href="${a}academic_manager.html" class="nav-item">
                    <i class="fa-solid fa-book-open nav-icon"></i>
                    <span>Academic Manager</span>
                </a>
                <a href="${a}schedule.html" class="nav-item">
                    <i class="fa-regular fa-calendar nav-icon"></i>
                    Schedule
                </a>
                <a href="${a}timeTable.html" class="nav-item">
                    <i class="fa-solid fa-clock nav-icon"></i>
                    Time Table
                </a>
                <a href="${a}settings.html" class="nav-item">
                    <i class="fa-solid fa-cog nav-icon"></i>
                    School Settings
                </a>
                <a href="${a}payments_config.html" class="nav-item">
                    <i class="fa-solid fa-credit-card nav-icon"></i>
                    Payment Config
                </a>
                <a href="${sh}manage_notes.html" class="nav-item">
                    <i class="fa-solid fa-file-lines nav-icon"></i>
                    Manage Notes
                </a>
                
                <a href="#" id="schoolAdminLogoutBtn" class="nav-item" style="margin-top: auto; border-top: 1px solid var(--border); border-radius: 0; padding-top: 16px;">
                    <i class="fa-solid fa-sign-out-alt nav-icon"></i>
                    Logout
                </a>
            </nav>`;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const sidebarElement = document.querySelector('[data-sideBar]');
        if (!sidebarElement) return;

        sidebarElement.innerHTML = buildSidebar();

        // Active link highlighting
        const currentPath = window.location.pathname;
        const parentOverride = document.body.getAttribute('data-parent-link');

        sidebarElement.querySelectorAll('.nav-item').forEach(link => {
            const linkHref = link.getAttribute('href') || '';
            // Match by filename at end of path
            const filename = linkHref.split('/').pop();
            const cleanParent = parentOverride ? parentOverride.split('/').pop() : null;

            const isDirectMatch = filename && filename !== '#' && currentPath.endsWith(filename);
            const isParentMatch = cleanParent && filename === cleanParent;

            if (isDirectMatch || isParentMatch) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Mobile close button
        const closeBtn = sidebarElement.querySelector('[data-sideBarClose]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebarElement.classList.remove('show', 'open', 'active');
            });
        }

        // Logout functionality
        const logoutBtn = sidebarElement.querySelector('#schoolAdminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    // Dynamically import config.js to get the initialized supabase client 
                    // (paths are relative to the HTML file: html/schoolAdmin/page.html -> ../../scripts/config.js)
                    const { supabase } = await import('../../scripts/config.js');
                    await supabase.auth.signOut();
                } catch (error) {
                    console.error("Logout Error:", error);
                }
                window.location.href = '/login';
            });
        }
    });
})();
