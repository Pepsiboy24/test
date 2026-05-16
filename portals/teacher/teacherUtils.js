// teacherUtils.js — Shared utilities for all Teacher Portal pages
// Import this wherever teacher auth or formatting helpers are needed.

import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

/**
 * Verify that the currently logged-in user is a teacher.
 * Redirects to index.html on failure.
 * @returns {{ teacherId: string, teacherData: object } | null}
 */
export async function checkTeacherLogin() {
    try {
        const user = await waitForUser();

        if (!user) {
            console.error('No user logged in');
            alert('Please log in as a teacher to view this page.');
            window.location.href = '/login';
            return null;
        }

        const { data: teacherData, error: teacherError } = await supabase
            .from('Teachers')
            .select('teacher_id, first_name, last_name, email')
            .eq('teacher_id', user.id)
            .single();

        if (teacherError || !teacherData) {
            console.error('User is not authorised as a teacher:', teacherError);
            alert('You are not authorised as a teacher. Please log in with teacher credentials.');
            await supabase.auth.signOut();
            window.location.href = '/login';
            return null;
        }

        return { teacherId: user.id, teacherData };
    } catch (err) {
        console.error('Error checking teacher login:', err);
        alert('An error occurred while verifying your login. Please try logging in again.');
        window.location.href = '/login';
        return null;
    }
}

/**
 * Get abbreviated initials from first and last name.
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string}
 */
export function getTeacherInitials(firstName, lastName) {
    const f = (firstName || '').charAt(0).toUpperCase();
    const l = (lastName || '').charAt(0).toUpperCase();
    return (f + l) || '??';
}

/**
 * Start a live clock that updates a DOM element every second.
 * @param {string} elementId - ID of the element to update.
 */
export function startLiveClock(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    function tick() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        };
        el.textContent = now.toLocaleDateString('en-GB', options);
    }

    tick();
    setInterval(tick, 1000);
}
