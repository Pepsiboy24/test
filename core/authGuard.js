import { supabase } from './config.js';
import { hasFeatureAccess, getCurrentUserTier, TIERS } from './tierAccess.js';

(async function authGuard() {
    try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) {
            redirectToLogin();
            return;
        }

        // --- SHARED STATE FIX ---
        window.currentUser = user; 
        window.dispatchEvent(new CustomEvent('auth-ready', { detail: user }));
        // ------------------------

        const userMetadata = user.user_metadata || {};
        const schoolId = userMetadata.school_id;
        const userType = userMetadata.user_type; 
        const currentPath = window.location.pathname;

        if (!schoolId) {
            redirectToOnboarding();
            return;
        }

        const userTier = await getCurrentUserTier();
        if (userTier === null) {
            await supabase.auth.signOut();
            redirectToLogin();
            return;
        }

        // Shared folder bypass
        if (currentPath.includes('/portals/shared/')) return;

        // Role-based access
        if (currentPath.includes('/portals/admin/') && userType !== 'admin' && userType !== 'school_admin') {
            showAccessDeniedModal('Unauthorized: Admin access required.', '/login');
            return;
        }

        if (currentPath.includes('/portals/teacher/') && userType !== 'teacher') {
            showAccessDeniedModal('Access Denied: Teachers only.', '/login');
            return;
        }

    } catch (err) {
        console.error('Unexpected Auth Guard Error:', err);
        redirectToLogin();
    }
})();

function redirectToLogin() {
    if (document.body) document.body.style.display = 'none';
    window.location.href = '/login';
}

function redirectToOnboarding() {
    if (document.body) document.body.style.display = 'none';
    window.location.href = '/onboarding';
}

function showAccessDeniedModal(message, redirectUrl) {
    const render = () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); z-index: 999999; display: flex; align-items: center; justify-content: center;';
        overlay.innerHTML = `<div style="background: #1e293b; padding: 32px; border-radius: 16px; text-align: center; color: white;">
            <h2 style="color: #ef4444;">Access Denied</h2>
            <p>${message}</p>
        </div>`;
        document.body.appendChild(overlay);
        setTimeout(() => window.location.href = redirectUrl, 2500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
    else render();
}

async function checkRouteAccess(path, userTier) {
    const routeTierMap = {
        '/portals/student': TIERS.STUDENT_ENGAGEMENT,
        '/portals/admin': TIERS.ADMIN_CORE,
        '/portals/teacher': TIERS.ADMIN_CORE,
    };
    for (const [route, requiredTier] of Object.entries(routeTierMap)) {
        if (path.startsWith(route)) return userTier >= requiredTier;
    }
    return true;
}