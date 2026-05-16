import { supabase } from "../../config.js";

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
            // 1. Clear previous form data (except session)
            if (addEventForm) {
                const sessionSelect = document.getElementById('academicSession');
                const previousSession = sessionSelect.value;
                addEventForm.reset();

                // 2. Fetch Sessions and Populate Dropdown dynamically
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

                // 3. Session Linking: Auto-select the current session if available from the UI
                const monthYearSpan = document.getElementById('monthYear');
                if (monthYearSpan && monthYearSpan.dataset.sessionName) {
                    sessionSelect.value = monthYearSpan.dataset.sessionName;
                } else if (previousSession) {
                    // Fallback to what was previously selected
                    sessionSelect.value = previousSession;
                }
            }
            // 4. Show the modal
            modal.classList.add('show');
        });
    }

    // Close logic
    const closeModal = () => modal && modal.classList.remove('show');

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Close when clicking outside modal content
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // --- Smart Data Handling (Auto-Duration) ---
    const calculateDuration = () => {
        if (startDateInput.value && endDateInput.value) {
            const start = new Date(startDateInput.value);
            const end = new Date(endDateInput.value);

            // Calculate time difference
            const timeDiff = end.getTime() - start.getTime();

            // If end is before start, don't calculate or show negative
            if (timeDiff >= 0) {
                // Convert to days (ms / (1000ms * 60s * 60m * 24h))
                const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end days

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

            // Validate required fields
            if (!session || !term || !activity || !startStr) {
                showToast("Please fill in all required fields (Session, Term, Activity, Start Date).", "warning");
                return;
            }

            // Date Validation: Prevent submission if endDate is earlier than startDate
            if (endStr) {
                const startDate = new Date(startStr);
                const endDate = new Date(endStr);
                if (endDate < startDate) {
                    showToast("The End Date cannot be earlier than the Start Date.", "warning");
                    return;
                }
            }

            try {
                if (submitBtn) {
                    submitBtn.textContent = "Saving...";
                    submitBtn.disabled = true;
                }

                // INSERT the data into Supabase
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
                            remarks: remarks
                        }
                    ]);

                if (error) throw error;

                // Success Actions
                showToast("Event added successfully!", "success");

                closeModal();

                // Refresh the Table View in calendar_display.js
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
