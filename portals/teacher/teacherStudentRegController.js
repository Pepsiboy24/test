/**
 * teacherStudentRegController.js
 * Optimized for Multi-tenant SaaS with robust Existing-User handling.
 */

import { supabase } from '../../core/config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { waitForUser } from '/core/perf.js';

// Dedicated auth client for background signups — keeps teacher session alive.
const authClient = createClient(
    'https://dzotwozhcxzkxtunmqth.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
);

// ─── Registration logic ──────────────────────────────────────────────────────

async function registerNewStudent(fullName, email, password, dateOfBirth, admissionDate, profilePicUrl, classId, gender, parentInfo = null) {
    try {
        // 1. IDENTITY GUARD: Fetch Teacher's metadata
        const teacherUser = await waitForUser();
        if (authUserErr || !teacherUser) return { success: false, error: 'Teacher authentication required' };

        const schoolId = teacherUser.user_metadata?.school_id;
        if (!schoolId) return { success: false, error: 'Teacher school association not found.' };

        const studentEmail = email || `${fullName.toLowerCase().replace(/\s+/g, '.')}@ischool.com`;
        const studentPassword = password || '123456';

        // 2. STUDENT AUTH: Tag with school_id to satisfy RLS
        const { data: studentAuth, error: authError } = await authClient.auth.signUp({
            email: studentEmail,
            password: studentPassword,
            options: {
                data: {
                    user_type: 'student',
                    school_id: schoolId
                }
            }
        });
        if (authError) throw authError;

        // 3. STUDENT PROFILE: Insert into public.Students
        const { error: studentInsertError } = await supabase
            .from('Students')
            .insert([{
                student_id: studentAuth.user.id,
                full_name: fullName,
                date_of_birth: dateOfBirth,
                gender: gender,
                admission_date: admissionDate,
                profile_picture: profilePicUrl,
                class_id: classId,
                school_id: schoolId,
                enrollment_status: 'active'
            }]);
        if (studentInsertError) throw studentInsertError;

        // 4. PARENT WORKFLOW
        if (parentInfo) {
            let finalParentId = parentInfo.linkedParentId;

            if (!finalParentId) {
                // Attempt to create Parent Auth account
                const { data: parentAuth, error: pAuthError } = await authClient.auth.signUp({
                    email: parentInfo.parentEmail,
                    password: '123456',
                    options: {
                        data: {
                            user_type: 'parent',
                            school_id: schoolId
                        }
                    }
                });

                if (pAuthError) {
                    // CONFLICT RESOLUTION: Handle Siblings (422 Error)
                    if (pAuthError.status === 422 || pAuthError.message?.includes('already registered')) {
                        // Use .maybeSingle() to prevent 406 errors on empty results
                        const { data: existingParent, error: fetchErr } = await supabase
                            .from('Parents')
                            .select('parent_id')
                            .eq('email', parentInfo.parentEmail)
                            .maybeSingle();

                        if (fetchErr) throw new Error(`Database fetch failed: ${fetchErr.message}`);

                        if (existingParent) {
                            finalParentId = existingParent.parent_id;
                        } else {
                            throw new Error('This parent email is registered in Auth but has no database profile.');
                        }
                    } else throw pAuthError;
                } else {
                    // Auth Signup Success: Create Parent Record
                    const { data: newParent, error: pInsertError } = await supabase
                        .from('Parents')
                        .insert([{
                            user_id: parentAuth.user.id,
                            full_name: parentInfo.parentFullName,
                            email: parentInfo.parentEmail,
                            phone_number: parentInfo.parentPhone,
                            address: parentInfo.parentAddress || null,
                            school_id: schoolId
                        }])
                        .select('parent_id').single();
                    if (pInsertError) throw pInsertError;
                    finalParentId = newParent.parent_id;
                }
            }

            // Link Parent to Student
            const { error: linkError } = await supabase
                .from('Parent_Student_Links')
                .insert([{
                    parent_id: finalParentId,
                    student_id: studentAuth.user.id,
                    relationship: parentInfo.relationship || 'Guardian'
                }]);
            if (linkError) console.warn('Link failed (student still created):', linkError.message);
        }

        return { success: true };
    } catch (err) {
        console.error('Registration Failure:', err.message);
        return { success: false, error: err.message };
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function showErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? '' : 'none';
}
function clearErr(id) { showErr(id, ''); }

// ─── Step management ─────────────────────────────────────────────────────────

let currentStep = 1;
const TOTAL_STEPS = 3;

function goToStep(n) {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const stepEl = document.getElementById(`step${i}`);
        const indEl = document.getElementById(`indicator${i}`);
        if (stepEl) stepEl.classList.toggle('active', i === n);
        if (indEl) indEl.classList.toggle('active', i === n);
    }
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = `${Math.round((n / TOTAL_STEPS) * 100)}%`;

    const prev = document.getElementById('prevBtn');
    const next = document.getElementById('nextBtn');
    const submit = document.getElementById('submitBtn');

    if (prev) prev.style.display = n > 1 ? '' : 'none';
    if (next) next.style.display = n < TOTAL_STEPS ? '' : 'none';
    if (submit) submit.style.display = n === TOTAL_STEPS ? '' : 'none';
    currentStep = n;
    if (n === TOTAL_STEPS) populateReview();
}

// ─── Data Loading ────────────────────────────────────────────────────────────

async function loadTeacherClasses() {
    const classSelect = document.getElementById('class');
    if (!classSelect) return;
    try {
        const user = await waitForUser();
        if (!user) return;

        const [formRes, subjectRes] = await Promise.all([
            supabase.from('Classes').select('class_id, class_name, section').eq('teacher_id', user.id),
            supabase.from('Class_Subjects').select('class_id, Classes(class_id, class_name, section)').eq('teacher_id', user.id),
        ]);

        const seen = new Set();
        const classes = [];
        (formRes.data || []).forEach(c => { if (!seen.has(c.class_id)) { seen.add(c.class_id); classes.push(c); } });
        (subjectRes.data || []).forEach(r => {
            const c = r.Classes;
            if (c && !seen.has(c.class_id)) { seen.add(c.class_id); classes.push(c); }
        });

        classSelect.innerHTML = '<option value="">Select a class</option>';
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.class_id;
            opt.textContent = `${c.class_name} ${c.section || ''}`.trim();
            classSelect.appendChild(opt);
        });
    } catch (e) { console.error('Error loading classes:', e); }
}

async function searchParentByPhone() {
    const phone = val('parentSearchPhone');
    const msgEl = document.getElementById('parentSearchMessage');
    if (!phone) return;

    msgEl.textContent = 'Searching...';
    // maybeSingle() prevents 406 errors on empty results
    const { data, error } = await supabase
        .from('Parents')
        .select('parent_id, full_name, email, phone_number')
        .eq('phone_number', phone)
        .maybeSingle();

    if (error || !data) {
        msgEl.innerHTML = '<span style="color:#dc2626;">No parent found — please fill form below.</span>';
        document.getElementById('linkedParentId').value = '';
        return;
    }

    document.getElementById('linkedParentId').value = data.parent_id;
    document.getElementById('parentFullName').value = data.full_name;
    document.getElementById('parentEmail').value = data.email || '';
    document.getElementById('parentPhone').value = data.phone_number || '';
    msgEl.innerHTML = `<span style="color:#16a34a;">✓ Parent found: <strong>${data.full_name}</strong>.</span>`;
}

function populateReview() {
    const classSelect = document.getElementById('class');
    const classText = classSelect?.options[classSelect.selectedIndex]?.text || '';
    document.getElementById('reviewName').textContent = val('fullName');
    document.getElementById('reviewClass').textContent = classText;
}

// ─── Initialization ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadTeacherClasses();
    document.getElementById('nextBtn')?.addEventListener('click', () => {
        const stepEl = document.getElementById(`step${currentStep}`);
        if (!stepEl) return;

        const requiredElements = stepEl.querySelectorAll('input[required], select[required]');
        let isValid = true;

        for (const el of requiredElements) {
            if (!el.checkValidity()) {
                el.reportValidity();
                isValid = false;
                break;
            }
        }

        if (isValid) {
            goToStep(currentStep + 1);
        }
    });
    document.getElementById('prevBtn')?.addEventListener('click', () => goToStep(currentStep - 1));
    document.getElementById('searchParentBtn')?.addEventListener('click', searchParentByPhone);
    document.getElementById('registrationForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = 'Registering...';

        const parentInfo = val('linkedParentId')
            ? { linkedParentId: val('linkedParentId') }
            : {
                parentFullName: val('parentFullName'),
                parentEmail: val('parentEmail'),
                parentPhone: val('parentPhone'),
                parentAddress: val('parentAddress'),
                relationship: val('relationship'),
            };

        const res = await registerNewStudent(
            val('fullName'), val('email'), null, val('dateOfBirth'), val('admissionDate'), null, val('class'),
            document.querySelector('input[name="gender"]:checked')?.value, parentInfo
        );

        btn.disabled = false;
        btn.textContent = 'Submit Registration';

        if (res.success) {
            document.getElementById('registrationForm').style.display = 'none';
            document.getElementById('successStep').style.display = 'block';
        } else {
            alert('Error: ' + res.error);
        }
    });
    goToStep(1);
});