import { supabase } from "../../../core/config.js";
import { waitForUser } from '/core/perf.js';

document.addEventListener('DOMContentLoaded', () => {
    const addEventForm = document.getElementById('addEventForm');
    const modal = document.getElementById('addEventModal');
    const addEventBtn = document.querySelector('.add-event-btn');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const durationInput = document.getElementById('duration');

    // --- Modal Interaction Logic ---
    if (addEventBtn && modal) {
        addEventBtn.addEventListener('click', async () => {
            if (addEventForm) {
                const sessionSelect = document.getElementById('academicSession');
                const previousSession = sessionSelect.value;
                addEventForm.reset();

                sessionSelect.innerHTML = '<option value="">Select Session</option>';
                const sessions = window.uniqueSessions || [];

                if (sessions.length > 0) {
                    sessions.forEach(s => {
                        const option = document.createElement('option');
                        option.value = s;
                        option.textContent = s;
                        sessionSelect.appendChild(option);
                    });
                } else {
                    sessionSelect.innerHTML = '<option value="">No Sessions Found (Create One First)</option>';
                }

                const monthYearSpan = document.getElementById('monthYear');
                if (monthYearSpan && monthYearSpan.dataset.sessionName) {
                    sessionSelect.value = monthYearSpan.dataset.sessionName;
                } else if (previousSession) {
                    sessionSelect.value = previousSession;
                }
            }
            modal.classList.add('show');
        });
    }

    const closeModal = () => modal && modal.classList.remove('show');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // --- Smart Data Handling (Auto-Duration) ---
    const calculateDuration = () => {
        if (startDateInput.value && endDateInput.value) {
            const start = new Date(startDateInput.value);
            const end = new Date(endDateInput.value);
            const timeDiff = end.getTime() - start.getTime();
            if (timeDiff >= 0) {
                const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
                durationInput.value = `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
            } else {
                durationInput.value = '';
            }
        }
    };

    if (startDateInput && endDateInput && durationInput) {
        startDateInput.addEventListener('change', calculateDuration);
        endDateInput.addEventListener('change', calculateDuration);
    }

    // --- Database Integration ---
    if (addEventForm) {
        addEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const session = document.getElementById('academicSession').value.trim();
            const term = document.getElementById('termPeriod').value;
            const activity = document.getElementById('activityEvent').value.trim();
            const startStr = document.getElementById('startDate').value;
            const endStr = document.getElementById('endDate').value;
            const duration = document.getElementById('duration').value.trim();
            const remarks = document.getElementById('remarks').value.trim();

            const submitBtn = addEventForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.textContent : 'Add Event';

            if (!session || !term || !activity || !startStr) {
                showToast("Please fill in all required fields.", "warning");
                return;
            }

            if (endStr && new Date(endStr) < new Date(startStr)) {
                showToast("The End Date cannot be earlier than the Start Date.", "warning");
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.textContent = "Saving...";
                    submitBtn.disabled = true;
                }

                // 1. Fetch current user and school_id
                const user = await waitForUser();
                if (userError || !user) throw new Error("Auth failed. Please log in.");

                const schoolId = user.user_metadata.school_id;
                if (!schoolId) throw new Error("School profile not found.");

                // 2. INSERT with school_id linkage
                const { error } = await supabase
                    .from('academic_events')
                    .insert([
                        {
                            academic_session: session,
                            term_period: term,
                            activity_event: activity,
                            start_date: startStr,
                            end_date: endStr || null,
                            duration: duration,
                            remarks: remarks,
                            school_id: schoolId // CRITICAL: Links the record for RLS
                        }
                    ]); // Remove count minimal so we can verify the insert succeeds or throws

                if (error) throw error;

                showToast("Event added successfully!", "success");
                closeModal();

                if (window.refreshAcademicTable) {
                    await window.refreshAcademicTable();
                }

            } catch (err) {
                console.error("Error adding event:", err);
                showToast("Failed to save event: " + err.message, "error");
            } finally {
                if (submitBtn) {
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                }
            }
        });
    }
});