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

        // Login successful, redirect to dashboard
        window.location.href = 'schoolAdmin/schoolAdminDashboard.html';

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
