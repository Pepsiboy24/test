/**
 * ai_assistant.js - Groq + Supabase Edition (Multimodal Version)
 * ─────────────────────────────────────────────────────────────────
 * Now supports text prompts and image uploads for textbook analysis.
 */
import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

/* ── DOM ─────────────────────────────────────────────────────────── */
const greetingWrapper = document.getElementById('greetingWrapper');
const promptChips = document.getElementById('promptChips');
const messagesArea = document.getElementById('messagesArea');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const teacherNameEl = document.getElementById('teacherName');

// New File Upload Elements
const fileInput = document.getElementById('fileUpload');
const attachBtn = document.getElementById('attachBtn');

/* ── State ───────────────────────────────────────────────────────── */
let hasStarted = false;
let isLoading = false;
let selectedFileBase64 = null; // Stores the image to send to the AI

/* ── Init: fetch teacher name ────────────────────────────────────── */
async function init() {
    const user = await waitForUser();
    if (!user) return;

    const { data: teacher } = await supabase
        .from('Teachers')
        .select('first_name')
        .eq('teacher_id', user.id)
        .maybeSingle();

    if (teacher?.first_name) {
        teacherNameEl.textContent = teacher.first_name;
    }
}

/* ── UI & File Logic ────────────────────────────────────────────── */
function autoResize() {
    chatInput.style.height = 'auto';
    const maxH = 5 * 1.5 * 15 + 12;
    chatInput.style.height = Math.min(chatInput.scrollHeight, maxH) + 'px';
}

// Trigger file picker
if (attachBtn) {
    attachBtn.addEventListener('click', () => fileInput.click());
}

// Handle file selection
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Optional: Add file size check (Groq limits are around 4MB-10MB usually)
    if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Please upload an image under 5MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        // Extract Base64 string
        selectedFileBase64 = reader.result.split(',')[1];
        // Visual feedback: Change icon color to show something is attached
        attachBtn.style.color = '#3182ce';
    };
    reader.readAsDataURL(file);
});

chatInput.addEventListener('input', autoResize);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// Prompt chips click
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        let action = 'chat';
        if (prompt.toLowerCase().includes('lesson plan')) action = 'lesson-plan';
        if (prompt.toLowerCase().includes('quiz')) action = 'quiz';

        handleSend(prompt, action);
    });
});

sendBtn.addEventListener('click', () => handleSend());

/* ── Send logic ─────────────────────────────────────────────────── */
async function handleSend(overrideText = null, actionOverride = 'chat') {
    const text = overrideText || chatInput.value.trim();

    // Only stop if both text AND image are empty
    if (!text && !selectedFileBase64 || isLoading) return;

    // Transition Layout on first use
    if (!hasStarted) {
        hasStarted = true;
        greetingWrapper.classList.add('has-messages');
        promptChips.classList.add('hidden');
        setTimeout(() => {
            greetingWrapper.style.display = 'none';
            messagesArea.classList.add('visible');
        }, 500);
    }

    // Capture the current image data and reset UI
    const imageToSubmit = selectedFileBase64;
    selectedFileBase64 = null;
    attachBtn.style.color = '#a0aec0'; // Reset icon color
    fileInput.value = ''; // Reset file input

    chatInput.value = '';
    autoResize();

    // Show user bubble (if image is present, indicate it)
    const userDisplayLabel = imageToSubmit ? `[Image Attached] ${text}` : text;
    appendBubble('user', userDisplayLabel);

    const loaderRow = appendLoader();
    isLoading = true;
    sendBtn.disabled = true;

    try {
        const { data, error } = await supabase.functions.invoke('clever-responder', {
            body: {
                action: actionOverride,
                topic: text,
                image: imageToSubmit // Sending the Base64 image to Groq via Supabase
            }
        });

        if (error) throw error;

        loaderRow.remove();
        appendBubble('ai', data.text);

    } catch (err) {
        loaderRow.remove();
        appendBubble('ai', `⚠️ Connection Error: Please try again in a moment.`);
        console.error('[AI Assistant] Error:', err);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        chatInput.focus();
    }
}

/* ── DOM Helpers ─────────────────────────────────────────────────── */
function appendBubble(role, text) {
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`;
    avatar.textContent = isUser ? '👤' : '✦';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (isUser) {
        bubble.textContent = text;
    } else {
        bubble.innerHTML = formatAIResponse(text);
    }

    if (isUser) {
        row.appendChild(bubble);
        row.appendChild(avatar);
    } else {
        row.appendChild(avatar);
        row.appendChild(bubble);
    }

    messagesArea.appendChild(row);
    scrollToBottom();
    return row;
}

function appendLoader() {
    const row = document.createElement('div');
    row.className = 'message-row ai';
    const avatar = document.createElement('div');
    avatar.className = 'avatar ai-avatar';
    avatar.textContent = '✦';
    const loader = document.createElement('div');
    loader.className = 'loader-bubble';
    loader.innerHTML = `<div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div>`;
    row.appendChild(avatar);
    row.appendChild(loader);
    messagesArea.appendChild(row);
    scrollToBottom();
    return row;
}

function scrollToBottom() {
    messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
}

function formatAIResponse(text) {
    return text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/### (.*?)$/gm, '<h4 style="margin-top:10px;">$1</h4>')
        .replace(/## (.*?)$/gm, '<h3 style="margin-top:12px;">$1</h3>');
}

init();