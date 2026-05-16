/**
 * auth_guard_student.js (STRICT VERSION)
 * ─────────────────────────────────────────────────────────────────────────────
 * Behavior: 
 * 1. Hides page immediately.
 * 2. Checks if user is logged in.
 * 3. Checks if user exists in 'Students' table.
 * 4. If NOT a student, redirects to login (no "smart" redirects to other portals).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './config.js';

// ── EARLY EXIT ───────────────────────────────────────────────────────────────
// Hide the page immediately to prevent "flicker" while we check credentials.
document.documentElement.style.visibility = 'hidden';

(async function studentAuthGuard() {
    try {
        // ── STEP 1: Session Check ─────────────────────────────────────────────
        const { data: { user }, error: sessionError } = await supabase.auth.getUser();

        if (sessionError || !user) {
            console.warn('[Auth Guard] No active session found.');
            redirectTo('/login');
            return;
        }

        // ── STEP 2: Identity Verification (Students table) ───────────────────
        const { data: studentRecord, error: studentError } = await supabase
            .from('Students')
            .select('student_id')
            .eq('student_id', user.id)
            .maybeSingle();

        if (studentError) {
            console.error('Auth Guard: DB Query Error:', studentError.message);
        }

        if (studentRecord) {
            // ✅ SUCCESS: Confirmed student.
            console.log('[Auth Guard] Access granted: Student verified.');
            document.documentElement.style.visibility = 'visible';
            return;
        }

        // ── STEP 3: The Strict Kick ──────────────────────────────────────────
        // If we are here, the user is logged in but IS NOT a student.
        // We do NOT check for Admin or Teacher roles here. We just deny access.
        console.warn('[Auth Guard] Access Denied: User is not in Students table.');

        // OPTIONAL: Clear the session so they don't auto-login again
        // await supabase.auth.signOut(); 

        redirectTo('/login');

    } catch (err) {
        console.error('[Auth Guard] Critical Failure:', err);
        redirectTo('/login');
    }
})();

/**
 * Redirect helper 
 * @param {string} path 
 */
function redirectTo(path) {
    window.location.replace(path);
}