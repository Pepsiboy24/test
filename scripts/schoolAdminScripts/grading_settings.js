import { supabase } from '../config.js';

// DOM Elements
const sessionSelect = document.getElementById('academicSession');
const termSelect = document.getElementById('term');
const assessmentListIds = document.getElementById('assessmentList');
const addAssessmentBtn = document.getElementById('addAssessmentBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const totalScoreDisplay = document.getElementById('totalScore');
const validationMessage = document.getElementById('validationMessage');

// State
let assessments = [];
let currentSession = '';
let currentTerm = '';

// Default Structure
const DEFAULT_STRUCTURE = [
    { name: '1st CA', score: 20 },
    { name: '2nd CA', score: 20 },
    { name: 'Exam', score: 60 }
];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Sessions
    await loadSessions();

    // 2. Set Up Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Session/Term Change: Reload structure
    sessionSelect.addEventListener('change', (e) => {
        currentSession = e.target.value;
        if (currentSession) loadGradingStructure();
    });

    termSelect.addEventListener('change', (e) => {
        currentTerm = e.target.value;
        if (currentSession) loadGradingStructure();
    });

    // Add Assessment
    addAssessmentBtn.addEventListener('click', () => {
        addAssessmentRow('', 0);
        updateStateFromDOM();
    });

    // Save
    saveConfigBtn.addEventListener('click', saveConfiguration);
}

// --- core Functions ---

async function loadSessions() {
    try {
        const { data, error } = await supabase
            .from('academic_events')
            .select('academic_session');

        if (error) throw error;

        // Extract unique sessions
        const uniqueSessions = [...new Set(data.map(item => item.academic_session).filter(Boolean))].sort().reverse();

        sessionSelect.innerHTML = '';

        if (uniqueSessions.length === 0) {
            // Fallback if no sessions exist
            const fallbackSession = new Date().getFullYear() + "/" + (new Date().getFullYear() + 1);
            const opt = document.createElement('option');
            opt.value = fallbackSession;
            opt.textContent = fallbackSession + " (Default)";
            sessionSelect.appendChild(opt);
            currentSession = fallbackSession;
        } else {
            uniqueSessions.forEach(session => {
                const opt = document.createElement('option');
                opt.value = session;
                opt.textContent = session;
                sessionSelect.appendChild(opt);
            });
            currentSession = uniqueSessions[0]; // Default to most recent
        }

        // Initialize Term
        currentTerm = termSelect.value;

        // Load initial structure
        loadGradingStructure();

    } catch (err) {
        console.error('Error loading sessions:', err);
        sessionSelect.innerHTML = '<option value="">Error loading sessions</option>';
    }
}

async function loadGradingStructure() {
    if (!currentSession || !currentTerm) return;

    // Show loading state?
    assessmentListIds.innerHTML = '<div style="text-align:center; padding: 20px;">Loading structure...</div>';
    saveConfigBtn.disabled = true;

    try {
        const { data, error } = await supabase
            .from('Grading_Structure')
            .select('*')
            .eq('academic_session', currentSession)
            .eq('term', currentTerm)
            .order('created_at', { ascending: true });

        if (error) throw error;

        assessmentListIds.innerHTML = ''; // Clear loading

        if (data && data.length > 0) {
            // Use fetched data
            data.forEach(item => {
                addAssessmentRow(item.assessment_name, item.max_score);
            });
        } else {
            // Use defaults
            DEFAULT_STRUCTURE.forEach(item => {
                addAssessmentRow(item.name, item.score);
            });
        }

        updateStateFromDOM(); // Run validation

    } catch (err) {
        console.error('Error loading structure:', err);
        assessmentListIds.innerHTML = '<div style="color:red; text-align:center;">Error loading grading structure.</div>';
    }
}

function addAssessmentRow(name = '', score = 0) {
    const row = document.createElement('div');
    row.className = 'assessment-row';

    // Name Input
    const nameGroup = document.createElement('div');
    nameGroup.innerHTML = `
        <label>Assessment Name</label>
        <input type="text" class="assessment-name form-control" value="${name}" placeholder="e.g. Mid-term">
    `;

    // Score Input
    const scoreGroup = document.createElement('div');
    scoreGroup.innerHTML = `
        <label>Max Score</label>
        <input type="number" class="assessment-score form-control" value="${score}" placeholder="0">
    `;

    // Remove Btn
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '<i class="fa fa-trash"></i>';
    removeBtn.title = "Remove Assessment";
    removeBtn.onclick = () => {
        row.remove();
        updateStateFromDOM();
    };

    row.appendChild(nameGroup);
    row.appendChild(scoreGroup);
    row.appendChild(removeBtn);

    assessmentListIds.appendChild(row);

    // Add input listeners for realtime validation
    const nameInput = row.querySelector('.assessment-name');
    const scoreInput = row.querySelector('.assessment-score');

    nameInput.addEventListener('input', updateStateFromDOM);
    scoreInput.addEventListener('input', updateStateFromDOM);
}

function updateStateFromDOM() {
    const rows = document.querySelectorAll('.assessment-row');
    assessments = [];
    let total = 0;

    rows.forEach(row => {
        const name = row.querySelector('.assessment-name').value.trim();
        const score = parseInt(row.querySelector('.assessment-score').value) || 0;

        assessments.push({ name, score });
        total += score;
    });

    // Update UI
    totalScoreDisplay.textContent = total;

    // Validation Logic
    if (total === 100) {
        totalScoreDisplay.classList.remove('invalid');
        totalScoreDisplay.classList.add('valid');
        validationMessage.textContent = "Configuration is valid. Total score is 100.";
        validationMessage.className = "validation-message success";
        saveConfigBtn.disabled = false;

        // Also check if names are empty
        const emptyNames = assessments.some(a => !a.name);
        if (emptyNames) {
            validationMessage.textContent = "Total is 100, but some assessment names are empty.";
            validationMessage.className = "validation-message error";
            saveConfigBtn.disabled = true;
        }
    } else {
        totalScoreDisplay.classList.remove('valid');
        totalScoreDisplay.classList.add('invalid');
        const diff = 100 - total;
        const msg = diff > 0 ? `You need ${diff} more points.` : `You are over by ${Math.abs(diff)} points.`;
        validationMessage.textContent = `Total must be exactly 100. ${msg}`;
        validationMessage.className = "validation-message error";
        saveConfigBtn.disabled = true;
    }
}

async function saveConfiguration() {
    if (!currentSession || !currentTerm) {
        showToast("Please select a valid Session and Term.", "warning");
        return;
    }

    saveConfigBtn.disabled = true;
    saveConfigBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';

    try {
        // 1. Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast("You must be logged in to save configuration.", "error");
            throw new Error("Unauthorized");
        }

        // 2. Delete Existing Records for this Session+Term
        const { error: deleteError } = await supabase
            .from('Grading_Structure')
            .delete()
            .eq('academic_session', currentSession)
            .eq('term', currentTerm);

        if (deleteError) throw deleteError;

        // 3. Insert New Records
        // Prepare payload
        const payload = assessments.map(a => ({
            assessment_name: a.name,
            max_score: a.score,
            term: currentTerm,
            academic_session: currentSession
            // id and created_at handled by DB defaults
        }));

        const { error: insertError } = await supabase
            .from('Grading_Structure')
            .insert(payload);

        if (insertError) throw insertError;

        // Success
        showToast("Grading Structure saved successfully!", "success");

    } catch (err) {
        console.error("Save failed:", err);
        showToast("Failed to save grading structure. Check console for details.", "error");
    } finally {
        saveConfigBtn.disabled = false;
        saveConfigBtn.innerHTML = '<i class="fa fa-save"></i> Save Configuration';

        // Re-validate to ensure clean state
        updateStateFromDOM();
    }
}
