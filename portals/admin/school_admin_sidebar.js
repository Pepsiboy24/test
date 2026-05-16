// school_admin_sidebar.js
import { supabase } from '../../core/config.js';
import { hasFeatureAccess, getCurrentUserTier } from '../../core/tierAccess.js';

(async function () {
    // Path detection logic - kept exactly as original
    function adminPrefix() {
        return '/admin/'; 
    }

    function sharedPrefix() {
        return '/student/'; 
    }

    // SPEED FIX: Fetch school branding using Shared State + Cache
    async function getSchoolBranding() {
        try {
            // 1. Use the shared user from authGuard (No more Auth Lock collisions)
            const user = window.currentUser || (await new Promise(res => {
                window.addEventListener('auth-ready', (e) => res(e.detail), { once: true });
            }));

            if (!user || !user.user_metadata?.school_id) {
                return { school_name: 'EduHubAdmin', school_logo_url: null };
            }

            const schoolId = user.user_metadata.school_id;

            // 2. CHECK CACHE FIRST (Sidebar becomes instant after first load)
            const cacheKey = `branding_${schoolId}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);
            
            const { data: school, error } = await supabase
                .from('Schools')
                .select('school_name, school_logo_url')
                .eq('school_id', schoolId)
                .single();

            if (error) throw error;
            
            const result = school || { school_name: 'EduHubAdmin', school_logo_url: null };
            
            // Save to Cache
            sessionStorage.setItem(cacheKey, JSON.stringify(result));
            return result;
            
        } catch (error) {
            console.error('Error fetching school branding:', error);
            return { school_name: 'EduHubAdmin', school_logo_url: null };
        }
    }

    // STRUCTURE RESTORED: Matches your original CSS classes exactly
    function renderSidebar(branding, a, sh) {
        return `
            <div class="logo">
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${branding.school_logo_url ? 
                        `<img src="${branding.school_logo_url}" alt="School Logo" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">` :
                        `<div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>`
                    }
                    <span style="font-weight: 600; color: #1e293b;">${branding.school_name}</span>
                </div>
                <div class="icon mobile-menu-btn" data-sideBarClose><i class="fa fa-times"></i></div>
            </div>
            
            <nav style="display: flex; flex-direction: column; flex: 1;">
                <a href="${a}schoolAdminDashboard" class="nav-item">
                    <i class="fa-solid fa-table-columns nav-icon"></i>
                    Dashboard
                </a>
                <a href="${a}classes" class="nav-item">
                    <i class="fa-solid fa-chalkboard-user nav-icon"></i>
                    <span>Classes</span>
                </a>
                <a href="${a}students" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-user-graduate nav-icon"></i>
                    Students
                </a>
                <a href="${a}teachers" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-chalkboard-teacher nav-icon"></i>
                    Teachers
                </a>
                <a href="${a}schooladmins" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-user-tie nav-icon"></i>
                    School Admins
                </a>
                <a href="${a}academic_manager" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-book-open nav-icon"></i>
                    <span>Academic Manager</span>
                </a>
                <a href="${a}schedule" class="nav-item" data-tier="1">
                    <i class="fa-regular fa-calendar nav-icon"></i>
                    Schedule
                </a>
                <a href="${a}timeTable" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-clock nav-icon"></i>
                    Time Table
                </a>
                <a href="${a}settings" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-cog nav-icon"></i>
                    School Settings
                </a>
                <a href="${a}payments_config" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-credit-card nav-icon"></i>
                    Payment Config
                </a>
                <a href="${sh}manage_notes" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-file-lines nav-icon"></i>
                    Manage Notes
                </a>
                <a href="${a}parents" class="nav-item" data-tier="3">
                    <i class="fa-solid fa-users nav-icon"></i>
                    Parents
                </a>
                
                <a href="#" id="schoolAdminLogoutBtn" class="nav-item logout-link-style" style="margin-top: auto; border-top: 1px solid var(--border); border-radius: 0; padding-top: 16px;">
                    <i class="fa-solid fa-sign-out-alt nav-icon"></i>
                    Logout
                </a>
            </nav>`;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const sidebarElement = document.querySelector('[data-sideBar]');
        if (!sidebarElement) return;

        const a = adminPrefix();
        const sh = sharedPrefix();

        // 1. Fetch school branding data (Optimized)
        const branding = await getSchoolBranding();
        
        // 2. Build sidebar
        sidebarElement.innerHTML = renderSidebar(branding, a, sh);

        // 3. Tier-based filtering (Restored Logic)
        const userTier = await getCurrentUserTier();
        if (userTier) {
            sidebarElement.querySelectorAll('.nav-item[data-tier]').forEach(item => {
                const requiredTier = parseInt(item.getAttribute('data-tier'));
                if (Number(userTier) < Number(requiredTier)) {
                    item.style.display = 'none';
                }
            });
        }

        // 4. Active link highlighting (Restored Logic)
        const currentPath = window.location.pathname;
        const parentOverride = document.body.getAttribute('data-parent-link');

        sidebarElement.querySelectorAll('.nav-item').forEach(link => {
            const linkHref = link.getAttribute('href') || '';
            const filename = linkHref.split('/').pop();
            const cleanParent = parentOverride ? parentOverride.split('/').pop() : null;

            const isDirectMatch = filename && filename !== '#' && currentPath.endsWith(filename);
            const isParentMatch = cleanParent && filename === cleanParent;

            if (isDirectMatch || isParentMatch) {
                link.classList.add('active');
            }
        });

        // 5. Mobile Event Listeners (Restored Logic)
        const closeBtn = sidebarElement.querySelector('[data-sideBarClose]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebarElement.classList.remove('show', 'open', 'active');
            });
        }

        const openBtn = document.querySelector('[data-sideBarOpen]');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                sidebarElement.classList.add('show', 'open', 'active');
            });
        }

        // 6. Logout (Restored Logic)
        const logoutBtn = sidebarElement.querySelector('#schoolAdminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = "/login";
            });
        }
    });

})();