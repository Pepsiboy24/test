// Supabase client removed for Aloc.ng mock integration

// --- API Configuration ---
const CONFIG = {
    xRapidapiKey: 'af493caabamshd4642b598aa9dedp1a6e53jsn0a63c5bf41dd', // Use your verified key
    xRapidapiHost: 'nigeria-past-questions2.p.rapidapi.com' // Ensure the '2' is there
};

// --- State Management ---
const testState = {
    examConfig: null, // Stores selected exam
    questions: [], // Loaded questions
    userAnswers: {}, // key: questionIndex, value: selectedOption 'A','B','C', or 'D'
    flaggedQuestions: new Set(),
    currentIndex: 0,
    timeRemaining: 0,
    timerInterval: null,
    isReviewMode: false
};

// --- DOM References ---
const lobbyView = document.getElementById('lobbyView');
const examView = document.getElementById('examView');
const resultsView = document.getElementById('resultsView');

// Modals
const instructionModal = document.getElementById('instructionModal');
const closeInstructionModal = document.getElementById('closeInstructionModal');
const cancelExamBtn = document.getElementById('cancelExamBtn');
const startExamConfirmedBtn = document.getElementById('startExamConfirmedBtn');

// HUD
const hudExamTitle = document.getElementById('hudExamTitle');
const hudProgressBar = document.getElementById('hudProgressBar');
const progressText = document.getElementById('progressText');
const hudTimer = document.getElementById('hudTimer');
const timerText = document.getElementById('timerText');
const submitExamBtn = document.getElementById('submitExamBtn');

// Workspace
const currentQNum = document.getElementById('currentQNum');
const totalQNum = document.getElementById('totalQNum');
const flagBtn = document.getElementById('flagBtn');
const passageContainer = document.getElementById('passageContainer');
const passageText = document.getElementById('passageText');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// Navigator
const navigatorGridSidebar = document.getElementById('navigatorGridSidebar');
const mobileNavToggleBtn = document.getElementById('mobileNavToggleBtn');
const closeMobileNav = document.getElementById('closeMobileNav');
const navigatorGrid = document.getElementById('navigatorGrid');

// Results
const resultsExamTitle = document.getElementById('resultsExamTitle');
const scoreCirclePath = document.getElementById('scoreCirclePath');
const scorePercentageText = document.getElementById('scorePercentageText');
const passFailStatus = document.getElementById('passFailStatus');
const resTotal = document.getElementById('resTotal');
const resCorrect = document.getElementById('resCorrect');
const resWrong = document.getElementById('resWrong');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
const reviewBtn = document.getElementById('reviewBtn');
const scoreCard = document.getElementById('scoreCard');
const correctionsList = document.getElementById('correctionsList');
const correctionsContent = document.getElementById('correctionsContent');
const resultsActionsBox = document.getElementById('resultsActionsBox');

// Prefixes for options mapping [0, 1, 2, 3] -> ['A', 'B', 'C', 'D']
const OPTION_PREFIXES = ['A', 'B', 'C', 'D'];

// --- Event Listeners Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Nav handling logic from here is removed to prevent double toggling
    // as it is already handled by student_sidebar.js

    // Initialize Lobby
    initLobbyTabs();

    closeInstructionModal.addEventListener('click', closeInstruction);
    cancelExamBtn.addEventListener('click', closeInstruction);

    // Start Event
    startExamConfirmedBtn.addEventListener('click', async () => {
        closeInstruction();
        await startExamination();
    });

    // Navigation and Workspace interactions
    prevBtn.addEventListener('click', () => navigateQuestion('prev'));
    nextBtn.addEventListener('click', () => navigateQuestion('next'));

    flagBtn.addEventListener('click', toggleFlagStatus);
    submitExamBtn.addEventListener('click', () => completeTest(false));

    // Mobile Nav Toggle
    mobileNavToggleBtn.addEventListener('click', () => navigatorGridSidebar.classList.add('open'));
    closeMobileNav.addEventListener('click', () => navigatorGridSidebar.classList.remove('open'));

    // Results interactions
    backToLobbyBtn.addEventListener('click', resetToLobby);
    reviewBtn.addEventListener('click', enterReviewMode);
});

// --- Phase A: Selection & Setup ---
const subjectsMap = [
    { name: "English", icon: "fa-book", key: "english" },
    { name: "Mathematics", icon: "fa-calculator", key: "mathematics" },
    { name: "Commerce", icon: "fa-briefcase", key: "commerce" },
    { name: "Accounting", icon: "fa-file-invoice-dollar", key: "accounting" },
    { name: "Biology", icon: "fa-dna", key: "biology" },
    { name: "Physics", icon: "fa-atom", key: "physics" },
    { name: "Chemistry", icon: "fa-flask", key: "chemistry" },
    { name: "English Lit", icon: "fa-book-reader", key: "englishlit" },
    { name: "Government", icon: "fa-landmark", key: "government" },
    { name: "CRK", icon: "fa-cross", key: "crk" },
    { name: "Geography", icon: "fa-globe-africa", key: "geography" },
    { name: "Economics", icon: "fa-chart-line", key: "economics" },
    { name: "IRK", icon: "fa-moon", key: "irk" },
    { name: "Civic Edu", icon: "fa-users", key: "civiledu" },
    { name: "Insurance", icon: "fa-shield-alt", key: "insurance" },
    { name: "Current Affairs", icon: "fa-newspaper", key: "currentaffairs" },
    { name: "History", icon: "fa-monument", key: "history" }
];

let activeExamType = 'utme'; // Default

function renderLobbySubjects() {
    const grid = document.getElementById('subjectGrid');
    const content = document.getElementById('subjectContent');
    if (!grid) return;
    
    try {
        // Hide skeleton and show content
        grid.style.display = 'none';
        content.style.display = 'grid';
        content.innerHTML = '';

        subjectsMap.forEach(sub => {
            const card = document.createElement('div');
            card.className = 'subject-card';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '12px';
            card.style.padding = '20px';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '12px';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.2s';
            card.style.background = 'var(--background-color)';
            card.innerHTML = `
            <i class="fas ${sub.icon}" style="font-size: 24px; color: var(--primary-color); width: 32px; text-align: center;"></i>
            <span style="font-weight: 600; font-size: 15px;">${sub.name}</span>
        `;
            card.addEventListener('click', () => {
                const timeLimit = activeExamType === 'utme' ? 3600 : 7200; // Mock time limits: JAMB 60m, WAEC 120m
                const title = `${activeExamType.toUpperCase()} ${sub.name}`;
                openInstructionModal(title, timeLimit, activeExamType, sub.key);
            });

            card.addEventListener('mouseover', () => {
                card.style.borderColor = 'var(--primary-color)';
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = 'var(--shadow-md)';
            });
            card.addEventListener('mouseout', () => {
                card.style.borderColor = 'var(--border-color)';
                card.style.transform = 'none';
                card.style.boxShadow = 'none';
            });
            content.appendChild(card);
        });
    } catch (error) {
        console.error('Error rendering lobby subjects:', error);
        // Hide skeleton and show error
        grid.style.display = 'none';
        content.style.display = 'grid';
        content.innerHTML = `<div style="padding: 40px; text-align: center; color: #ef4444;">Failed to load subjects.</div>`;
    }
}

function initLobbyTabs() {
    const tabs = document.querySelectorAll('.exam-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.color = 'var(--text-secondary)';
            });
            e.target.classList.add('active');
            e.target.style.background = 'var(--primary-color)';
            e.target.style.color = 'white';
            activeExamType = e.target.getAttribute('data-type');
        });
    });
    renderLobbySubjects();
}

function openInstructionModal(title, timeSecs, examType, subjectKey) {
    testState.examConfig = { title, timeSecs, examType, subjectKey };
    document.getElementById('modalExamTitle').textContent = `${title} Simulation`;
    document.getElementById('modalTotalQs').textContent = "20"; // Hardcoded for API limits
    document.getElementById('modalTimeLimit').textContent = `${timeSecs / 60} minutes`;
    instructionModal.style.display = 'block';
}

function closeInstruction() {
    instructionModal.style.display = 'none';
}

async function fetchQuestions(examType, subject) {
    const questionCount = 20;
    const url = `https://questions.aloc.com.ng/api/v2/q/${questionCount}?subject=${subject}`;

    try {
        console.log("Fetching questions from Aloc...");

        // 1. Await the fetch itself
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'AccessToken': 'ALOC-c7c91cf7e58a68d882ad',
                'Accept': 'application/json'
            }
        });

        // 2. Check the status on the Response object
        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }

        // 3. Await the JSON conversion
        const json = await response.json();
        console.log("API Data received:", json);

        // 4. Validate and Map
        if (!json.data || !Array.isArray(json.data)) {
            throw new Error("Data format from API is not an array");
        }

        return json.data.map(q => ({
            question: q.question,
            options: [q.option.a, q.option.b, q.option.c, q.option.d],
            answer: q.answer ? q.answer.toUpperCase() : 'A',
            section: q.section || '',
            solution: q.solution || ''
        }));

    } catch (error) {
        console.error("Critical Fetch Error:", error);
        // Return your fallbackData array here so the exam still starts
        return typeof fallbackData !== 'undefined' ? fallbackData : [];
    }
}

// Fisher-Yates array shuffle
function shuffleArray(array) {
    let curr = array.length, random;
    while (curr != 0) {
        random = Math.floor(Math.random() * curr);
        curr--;
        [array[curr], array[random]] = [array[random], array[curr]];
    }
    return array;
}

// --- Phase B: Start Examination ---
async function startExamination() {
    // Show a small console log to track progress
    console.log("Starting Exam Process...");

    let qs = await fetchQuestions(testState.examConfig.examType, testState.examConfig.subjectKey);

    // CRITICAL FIX: If no questions are found, don't leave the screen blank
    if (!qs || qs.length === 0) {
        alert("Failed to load questions. Please check your internet or try another subject.");
        resetToLobby();
        return;
    }

    testState.questions = shuffleArray([...qs]);
    testState.userAnswers = {};
    testState.flaggedQuestions = new Set();
    testState.currentIndex = 0;
    testState.timeRemaining = testState.examConfig.timeSecs;
    testState.isReviewMode = false;

    // View Transitions
    lobbyView.classList.remove('active');
    resultsView.classList.remove('active');
    examView.classList.add('active'); // Ensure your CSS actually makes .active visible

    hudExamTitle.textContent = testState.examConfig.title;
    totalQNum.textContent = testState.questions.length;

    // Reset the UI containers before loading
    renderNavigatorGrid();
    loadQuestionUI(0);
    startTimer();
}

function startTimer() {
    clearInterval(testState.timerInterval);
    updateTimerUI();

    testState.timerInterval = setInterval(() => {
        testState.timeRemaining--;
        updateTimerUI();

        if (testState.timeRemaining <= 0) {
            clearInterval(testState.timerInterval);
            completeTest(true); // Auto-submit
        }
    }, 1000);
}

function updateTimerUI() {
    const mins = Math.floor(testState.timeRemaining / 60);
    const secs = testState.timeRemaining % 60;
    timerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (!testState.isReviewMode) {
        if (testState.timeRemaining < 300) { // Pulse < 5 mins
            hudTimer.classList.add('pulse');
        } else {
            hudTimer.classList.remove('pulse');
        }
    } else {
        hudTimer.classList.remove('pulse');
        timerText.textContent = '--:--';
    }
}

// --- Question Workspace ---
function loadQuestionUI(index) {
    if (index < 0 || index >= testState.questions.length) return;

    testState.currentIndex = index;
    const q = testState.questions[index];

    currentQNum.textContent = index + 1;
    questionText.innerHTML = q.question; // Support basic tags if present

    // Aloc.ng Passage Handling
    if (q.section) {
        passageText.innerHTML = q.section;
        passageContainer.style.display = 'block';
    } else {
        passageContainer.style.display = 'none';
    }

    // Handle Navigation Buttons Status
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === testState.questions.length - 1;

    // Handle Flag Button Sync
    if (testState.flaggedQuestions.has(index)) {
        flagBtn.classList.add('is-flagged');
        flagBtn.innerHTML = '<i class="fas fa-flag"></i> Flagged';
    } else {
        flagBtn.classList.remove('is-flagged');
        flagBtn.innerHTML = '<i class="far fa-flag"></i> Flag';
    }

    // Render Options
    optionsContainer.innerHTML = '';
    q.options.forEach((optStr, i) => {
        const prefix = OPTION_PREFIXES[i];

        const label = document.createElement('label');
        label.className = 'option-label';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'q_option';
        radio.value = prefix;
        radio.className = 'option-radio';

        // Check if selected
        if (testState.userAnswers[index] === prefix) {
            radio.checked = true;
            label.classList.add('selected');
        }

        const prefixSpan = document.createElement('span');
        prefixSpan.className = 'option-prefix';
        prefixSpan.textContent = prefix + '.';

        const textSpan = document.createElement('span');
        textSpan.className = 'option-text';
        textSpan.textContent = optStr;

        label.appendChild(radio);
        label.appendChild(prefixSpan);
        label.appendChild(textSpan);

        // Listeners
        radio.addEventListener('change', () => {
            selectOption(index, prefix);
            // Update styling locally
            optionsContainer.querySelectorAll('.option-label').forEach(el => el.classList.remove('selected'));
            label.classList.add('selected');
        });

        optionsContainer.appendChild(label);
    });

    updateOverallProgress();
    updateNavigatorHighlight();
}

function selectOption(qIndex, answerPrefix) {
    if (testState.isReviewMode) return;
    testState.userAnswers[qIndex] = answerPrefix;
    updateNavigatorNode(qIndex);
    updateOverallProgress();
}

function navigateQuestion(dir) {
    if (dir === 'next') loadQuestionUI(testState.currentIndex + 1);
    if (dir === 'prev') loadQuestionUI(testState.currentIndex - 1);
}

function toggleFlagStatus() {
    if (testState.isReviewMode) return;
    const idx = testState.currentIndex;
    if (testState.flaggedQuestions.has(idx)) {
        testState.flaggedQuestions.delete(idx);
    } else {
        testState.flaggedQuestions.add(idx);
    }
    updateNavigatorNode(idx);
    loadQuestionUI(idx); // force update flag visually
}

// --- Navigator Grid ---
function renderNavigatorGrid() {
    navigatorGrid.innerHTML = '';
    for (let i = 0; i < testState.questions.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'nav-btn-item';
        btn.textContent = i + 1;
        btn.id = `nav-node-${i}`;

        btn.addEventListener('click', () => {
            loadQuestionUI(i);
            if (window.innerWidth <= 900) {
                navigatorGridSidebar.classList.remove('open');
            }
        });
        navigatorGrid.appendChild(btn);
    }
}

function updateNavigatorNode(index) {
    const btn = document.getElementById(`nav-node-${index}`);
    if (!btn) return;

    // Clear state classes
    btn.classList.remove('answered', 'flagged', 'review-correct', 'review-wrong');

    if (testState.isReviewMode) {
        const q = testState.questions[index];
        const userAns = testState.userAnswers[index];
        if (userAns === q.answer) {
            btn.classList.add('review-correct');
        } else {
            btn.classList.add('review-wrong');
        }
    } else {
        if (testState.flaggedQuestions.has(index)) {
            btn.classList.add('flagged');
        } else if (testState.userAnswers[index]) {
            btn.classList.add('answered');
        }
    }
}

function updateNavigatorHighlight() {
    // Highlight the active question
    document.querySelectorAll('.nav-btn-item').forEach(el => el.classList.remove('active-q'));
    const btn = document.getElementById(`nav-node-${testState.currentIndex}`);
    if (btn) btn.classList.add('active-q');
}

function updateOverallProgress() {
    const total = testState.questions.length;
    const answered = Object.keys(testState.userAnswers).length;
    const perc = total > 0 ? Math.round((answered / total) * 100) : 0;

    progressText.textContent = `${perc}%`;
    hudProgressBar.style.width = `${perc}%`;
}

// --- Phase C: Scoring & Conclusion ---
function completeTest(isAuto) {
    if (!isAuto && !confirm("Are you sure you want to submit your examination? You cannot reverse this action.")) {
        return;
    }

    clearInterval(testState.timerInterval);

    // Grade Test
    let correct = 0;
    testState.questions.forEach((q, i) => {
        if (testState.userAnswers[i] === q.answer) correct++;
    });

    const total = testState.questions.length;
    const percent = Math.round((correct / total) * 100);
    const pass = percent >= 50;

    // View Transitions
    examView.classList.remove('active');
    resultsView.classList.add('active');

    // Stats Population
    resultsExamTitle.textContent = testState.examConfig.title;
    resTotal.textContent = total;
    resCorrect.textContent = correct;
    resWrong.textContent = total - correct;

    passFailStatus.innerHTML = `Status: <span class="${pass ? 'pass' : 'fail'}">${pass ? 'Passed' : 'Failed'}</span>`;
    scorePercentageText.textContent = `${percent}%`;

    // SVG Circular Chart Animation stroke-dasharray "value, 100"
    // Use stroke color based on pass fail
    scoreCirclePath.style.stroke = pass ? 'var(--success-color)' : 'var(--danger-color)';
    setTimeout(() => {
        scoreCirclePath.setAttribute('stroke-dasharray', `${percent}, 100`);
    }, 100);
}

function resetToLobby() {
    resultsView.classList.remove('active');
    examView.classList.remove('active');
    lobbyView.classList.add('active');
    scoreCirclePath.setAttribute('stroke-dasharray', `0, 100`);

    // Reset view visibility
    scoreCard.style.display = 'block';
    resultsActionsBox.style.display = 'flex';
    correctionsList.style.display = 'none';
    correctionsContent.innerHTML = '';
}

function enterReviewMode() {
    testState.isReviewMode = true;

    // Keep Results View Active, but swap the view internally
    scoreCard.style.display = 'none';
    resultsActionsBox.style.display = 'none';
    correctionsList.style.display = 'block';

    correctionsContent.innerHTML = '';

    testState.questions.forEach((q, index) => {
        const userAns = testState.userAnswers[index];
        const correctAns = q.answer;

        const qContainer = document.createElement('div');
        qContainer.className = 'correction-item';

        let htmlSnippet = `<div class="correction-question"><strong>Q${index + 1}:</strong> ${q.question}</div>`;

        if (q.section) {
            htmlSnippet += `<div class="correction-passage">${q.section}</div>`;
        }

        let optionsHtml = '';
        q.options.forEach((optStr, i) => {
            const prefix = OPTION_PREFIXES[i];
            let rowClass = 'opt-row';

            if (prefix === correctAns) {
                rowClass += ' correct';
            } else if (prefix === userAns && userAns !== correctAns) {
                rowClass += ' wrong';
            }

            let icon = '';
            if (prefix === correctAns) {
                icon = '<i class="fas fa-check-circle"></i>';
            } else if (prefix === userAns && userAns !== correctAns) {
                icon = '<i class="fas fa-times-circle"></i>';
            } else {
                icon = '<i class="far fa-circle"></i>';
            }

            optionsHtml += `
                <div class="${rowClass}">
                    ${icon} <strong>${prefix}.</strong> <span>${optStr}</span>
                </div>
            `;
        });
        htmlSnippet += `<div class="correction-options">${optionsHtml}</div>`;

        if (q.solution) {
            htmlSnippet += `
                <div class="correction-solution">
                    <h5><i class="fas fa-lightbulb"></i> Explanation</h5>
                    <p>${q.solution}</p>
                </div>
            `;
        }

        qContainer.innerHTML = htmlSnippet;
        correctionsContent.appendChild(qContainer);
    });

    // Add a back button inside the corrections container if needed
    const returnBtn = document.createElement('button');
    returnBtn.className = 'btn btn-outline';
    returnBtn.style.marginTop = '24px';
    returnBtn.textContent = 'Back to Results';
    returnBtn.onclick = () => {
        correctionsList.style.display = 'none';
        scoreCard.style.display = 'block';
        resultsActionsBox.style.display = 'flex';
        testState.isReviewMode = false;
    };
    correctionsContent.appendChild(returnBtn);
}