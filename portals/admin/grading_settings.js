import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

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
let currentSchoolId = null; // FIX #51/#57: track school_id in module state

// Default Structure
const DEFAULT_STRUCTURE = [
    { name: '1st CA', score: 20 },
    { name: '2nd CA', score: 20 },
    { name: 'Exam', score: 60 }
];

// FIX #51/#57: Helper — resolve the logged-in admin's school_id once per page load
async function getCurrentSchoolId() {
    if (currentSchoolId) return currentSchoolId; // cached

    const user = await waitForUser();
    if (error || !user?.user_metadata?.school_id) {
        console.error('grading_settings: cannot determine school_id', error);
        return null;
    }
    currentSchoolId = user.user_metadata.school_id;
    return currentSchoolId;
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Resolve school_id before anything else
    const schoolId = await getCurrentSchoolId();
    if (!schoolId) {
        sessionSelect.innerHTML = '<option value="">Authentication error</option>';
        return;
    }

    // 2. Load Sessions
    await loadSessions();

    // 3. Set Up Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    sessionSelect.addEventListener('change', (e) => {
        currentSession = e.target.value;
        if (currentSession) loadGradingStructure();
    });

    termSelect.addEventListener('change', (e) => {
        currentTerm = e.target.value;
        if (currentSession) loadGradingStructure();
    });

    addAssessmentBtn.addEventListener('click', () => {
        addAssessmentRow('', 0);
        updateStateFromDOM();
    });

    saveConfigBtn.addEventListener('click', saveConfiguration);
}

// --- Core Functions ---

async function loadSessions() {
    try {
        const schoolId = await getCurrentSchoolId();
        if (!schoolId) throw new Error('No school_id available');

        // FIX #51: filter academic_events by school_id
        const { data, error } = await supabase
            .from('academic_events')
            .select('academic_session')
            .eq('school_id', schoolId); // was missing — exposed all schools' sessions

        if (error) throw error;

        const uniqueSessions = [...new Set(data.map(item => item.academic_session).filter(Boolean))].sort().reverse();

        sessionSelect.innerHTML = '';

        if (uniqueSessions.length === 0) {
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
            currentSession = uniqueSessions[0];
        }

        currentTerm = termSelect.value;
        loadGradingStructure();

    } catch (err) {
        console.error('Error loading sessions:', err);
        sessionSelect.innerHTML = '<option value="">Error loading sessions</option>';
    }
}

async function loadGradingStructure() {
    if (!currentSession || !currentTerm) return;

    assessmentListIds.innerHTML = '<div style="text-align:center; padding: 20px;">Loading structure...</div>';
    saveConfigBtn.disabled = true;

    try {
        const schoolId = await getCurrentSchoolId();
        if (!schoolId) throw new Error('No school_id available');

        // FIX #51: filter Grading_Structure by school_id
        const { data, error } = await supabase
            .from('Grading_Structure')
            .select('*')
            .eq('school_id', schoolId)            // was missing — all schools shared one config
            .eq('academic_session', currentSession)
            .eq('term', currentTerm)
            .order('created_at', { ascending: true });

        if (error) throw error;

        assessmentListIds.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(item => addAssessmentRow(item.assessment_name, item.max_score));
        } else {
            DEFAULT_STRUCTURE.forEach(item => addAssessmentRow(item.name, item.score));
        }

        updateStateFromDOM();

    } catch (err) {
        console.error('Error loading structure:', err);
        assessmentListIds.innerHTML = '<div style="color:red; text-align:center;">Error loading grading structure.</div>';
    }
}

function addAssessmentRow(name = '', score = 0) {
    const row = document.createElement('div');
    row.className = 'assessment-row';

    const nameGroup = document.createElement('div');
    nameGroup.innerHTML = `
        <label>Assessment Name</label>
        <input type="text" class="assessment-name form-control" value="${name}" placeholder="e.g. Mid-term">
    `;

    const scoreGroup = document.createElement('div');
    scoreGroup.innerHTML = `
        <label>Max Score</label>
        <input type="number" class="assessment-score form-control" value="${score}" placeholder="0">
    `;

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

    row.querySelector('.assessment-name').addEventListener('input', updateStateFromDOM);
    row.querySelector('.assessment-score').addEventListener('input', updateStateFromDOM);
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

    totalScoreDisplay.textContent = total;

    if (total === 100) {
        totalScoreDisplay.classList.remove('invalid');
        totalScoreDisplay.classList.add('valid');
        validationMessage.textContent = "Configuration is valid. Total score is 100.";
        validationMessage.className = "validation-message success";
        saveConfigBtn.disabled = false;

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
        const user = await waitForUser();
        if (!user) {
            showToast("You must be logged in to save configuration.", "error");
            throw new Error("Unauthorized");
        }

        const schoolId = await getCurrentSchoolId();
        if (!schoolId) {
            showToast("Cannot save: school identity could not be verified.", "error");
            throw new Error("No school_id");
        }

        // FIX #51: scope delete to this school only
        const { error: deleteError } = await supabase
            .from('Grading_Structure')
            .delete()
            .eq('school_id', schoolId)            // was missing — deleted ALL schools' configs
            .eq('academic_session', currentSession)
            .eq('term', currentTerm);

        if (deleteError) throw deleteError;

        // FIX #57: include school_id in every inserted row
        const payload = assessments.map(a => ({
            school_id: schoolId,                  // was missing from payload entirely
            assessment_name: a.name,
            max_score: a.score,
            term: currentTerm,
            academic_session: currentSession
        }));

        const { error: insertError } = await supabase
            .from('Grading_Structure')
            .insert(payload);

        if (insertError) throw insertError;

        showToast("Grading Structure saved successfully!", "success");

    } catch (err) {
        console.error("Save failed:", err);
        showToast("Failed to save grading structure. Check console for details.", "error");
    } finally {
        saveConfigBtn.disabled = false;
        saveConfigBtn.innerHTML = '<i class="fa fa-save"></i> Save Configuration';
        updateStateFromDOM();
    }
}
