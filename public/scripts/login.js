import { supabase } from './config.js';

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) return;

    setLoading(true);
    hideError();

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Check if user has school_id metadata
        const user = data.user;
        const schoolId = user?.user_metadata?.school_id;
        const userType = user?.user_metadata?.user_type;

        if (!schoolId) {
            // User hasn't completed onboarding, redirect to onboarding
            console.log('User missing school_id metadata, redirecting to onboarding');
            window.location.href = '../landing_page/html/onboarding.html';
            return;
        }

        // Verify user has proper metadata for RLS
        if (!userType) {
            console.log('User missing user_type metadata, updating...');
            await supabase.auth.updateUser({
                data: { 
                    school_id: schoolId,
                    user_type: userType || 'school_admin'
                }
            });
        }

        // Login successful, redirect to appropriate dashboard
        console.log('User authenticated with school_id:', schoolId, 'Type:', userType);
        
        // Redirect based on user type
        if (userType === 'school_admin') {
            window.location.href = 'schoolAdmin/schoolAdminDashboard.html';
        } else if (userType === 'teacher') {
            window.location.href = 'teachersPortal/teachersDashboard.html';
        } else {
            // Default to admin dashboard
            window.location.href = 'schoolAdmin/schoolAdminDashboard.html';
        }

    } catch (err) {
        console.error('Login error:', err);
        showError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.innerHTML = isLoading ? '<i class="fa fa-spinner fa-spin"></i> Signing in...' : 'Sign In';
}

function showError(msg) {
    errorText.textContent = msg;
    errorMessage.style.display = 'flex';
}

function hideError() {
    errorMessage.style.display = 'none';
}
