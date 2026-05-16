// School Admin Form Handling
import { submitSchoolAdmin } from './schooladminsFormDB.js';

document.addEventListener('DOMContentLoaded', function () {
    const adminForm = document.getElementById('adminForm');
    const submitBtn = document.getElementById('submitBtn');
    const backToEditBtn = document.getElementById('backToEditBtn');

    // Helper to toggle visibility
    function showSection(id) {
        document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
        document.getElementById(id).style.display = 'block';
    }

    // Back to edit button
    if (backToEditBtn) {
        backToEditBtn.addEventListener('click', () => {
            showSection('step1');
            submitBtn.parentElement.style.display = 'block';
        });
    }

    // Form submission
    if (adminForm) {
        adminForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const fullNameInput = document.getElementById('fullName');
            const emailInput = document.getElementById('email');

            if (!fullNameInput.value.trim() || !emailInput.value.trim()) {
                showToast("Please fill in all required fields.", "warning");
                return;
            }

            // Lock button
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Registering...';
            submitBtn.disabled = true;

            // Collect form data
            const formData = new FormData(adminForm);
            const adminData = {
                full_name: formData.get('fullName'),
                email: formData.get('email'),
                phone_number: formData.get('phone'),
                role: formData.get('role'),
                created_at: new Date().toISOString()
            };

            try {
                // Submit to database
                const result = await submitSchoolAdmin(adminData);

                if (result.success) {
                    // Show success
                    showSection('successStep');
                    submitBtn.parentElement.style.display = 'none';
                } else {
                    // Show error
                    showSection('errorStep');
                    document.getElementById('errorMessage').textContent = result.error;
                    submitBtn.parentElement.style.display = 'none';
                }
            } catch (error) {
                console.error('Form submission error:', error);

                showSection('errorStep');
                document.getElementById('errorMessage').textContent = 'An unexpected error occurred. Please try again.';
                submitBtn.parentElement.style.display = 'none';
            } finally {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});
