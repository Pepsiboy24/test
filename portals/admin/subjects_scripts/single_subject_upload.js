document.addEventListener('DOMContentLoaded', function () {
import { waitForUser } from '/core/perf.js';
    const subjectForm = document.getElementById('subjectForm');
    const popup = document.getElementById('registrationPopup');
    
    // Initialize subject allocation manager
    const allocationManager = new SubjectAllocationManager();
    
    // Initialize when page loads
    initializeSubjectForm();

    async function initializeSubjectForm() {
        try {
            const user = await waitForUser();
            if (!user?.user_metadata?.school_id) {
                console.warn('Strict Guard: No school_id found. Execution blocked.');
                return;
            }

            await allocationManager.initialize();
            
            // Setup form submission
            subjectForm.addEventListener('submit', handleSubjectSubmit);
            
            console.log('Subject form initialized');
        } catch (error) {
            console.error('Failed to initialize subject form:', error);
            showToast('Failed to initialize subject form', 'error');
        }
    }

    async function handleSubjectSubmit(e) {
        e.preventDefault();
        
        const formData = {
            subjectName: document.getElementById('subjectName').value.trim(),
            subjectCode: document.getElementById('subjectCode')?.value?.trim() || '',
            subjectType: document.querySelector('input[name="subjectType"]:checked')?.value
        };

        // Validate form
        if (!formData.subjectName) {
            showToast('Please enter subject name', 'error');
            return;
        }

        if (!formData.subjectType) {
            showToast('Please select subject type', 'error');
            return;
        }

        // Show loading state
        const submitBtn = subjectForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        try {
            // Add subject using allocation manager
            const result = await allocationManager.addSubject(formData);
            
            if (result.success) {
                showToast(result.message, 'success');
                subjectForm.reset();
                closePopup();
                
                // Refresh subjects display if function exists
                if (typeof window.refreshSubjectsDisplay === 'function') {
                    window.refreshSubjectsDisplay();
                }
            } else {
                showToast(result.error, 'error');
            }
        } catch (error) {
            console.error('Error submitting subject:', error);
            showToast('Failed to add subject. Please try again.', 'error');
        } finally {
            // Restore button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    // Close popup function
    function closePopup() {
        const popup = document.getElementById('registrationPopup');
        if (popup) {
            popup.style.display = 'none';
        }
    }
});
