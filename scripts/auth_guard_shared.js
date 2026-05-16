import { supabase as supabaseClient } from './config.js';

export async function protectSharedPage() {
    // 1. Check if user is logged in at all
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = '/login.html';
        return null;
    }

    // 2. Identify who they are across your tables
    const [adminCheck, teacherCheck] = await Promise.all([
        supabaseClient.from('School_Admin').select('admin_id').eq('email', user.email).maybeSingle(),
        supabaseClient.from('Teachers').select('teacher_id').eq('teacher_id', user.id).maybeSingle()
    ]);

    const isAdmin = !!adminCheck.data;
    const isTeacher = !!teacherCheck.data;

    // 3. The "Bouncer" Logic
    if (!isAdmin && !isTeacher) {
        console.warn("Access Denied: User is neither Admin nor Teacher.");
        // If they are a student or parent trying to sneak in, send them to their dashboard
        window.location.href = '/html/student/dashboard.html';
        return null;
    }

    // Return the user and their role so the page can use it
    return {
        user,
        role: isAdmin ? 'school_admin' : 'teacher'
    };
}