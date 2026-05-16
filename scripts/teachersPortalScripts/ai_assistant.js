/**
 * ai_assistant.js
 * ─────────────────────────────────────────────────────────────────
 * Powers the EduHub AI Assistant for teachers.
 * Uses the Gemini API (gemini-2.0-flash) for responses.
 *
 * HOW TO SET YOUR API KEY:
 *   Replace the empty string in GEMINI_API_KEY below with your key.
 *   Get one free at: https://aistudio.google.com/app/apikey
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ── Config ──────────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://dzotwozhcxzkxtunmqth.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE';
const GEMINI_API_KEY = '';   // ← Paste your Gemini API key here
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/* ── DOM ─────────────────────────────────────────────────────────── */
const greetingWrapper = document.getElementById('greetingWrapper');
const promptChips = document.getElementById('promptChips');
const messagesArea = document.getElementById('messagesArea');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const teacherNameEl = document.getElementById('teacherName');

/* ── State ───────────────────────────────────────────────────────── */
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const history = []; // { role: 'user'|'model', parts: [{text}] }
let hasStarted = false;
let isLoading = false;

/* ── System prompt injected at the start of every conversation ───── */
const SYSTEM_PROMPT = `You are EduHub AI, a helpful and knowledgeable teaching assistant for the EduHub school management platform.
Your primary goal is to assist teachers with lesson planning, creating quiz questions, drafting report comments, explaining concepts, and other classroom-related tasks.
Be concise, professional, and supportive. Format longer responses with clear headings or bullet points where helpful.
When asked to create lesson plans or assessments, structure them clearly and practically.`;

/* ── Init: fetch teacher name ────────────────────────────────────── */
async function init() {
    const { data: { user } } = await supabase.auth.getUser();
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

/* ── Auto-height textarea ────────────────────────────────────────── */
function autoResize() {
    chatInput.style.height = 'auto';
    const maxH = 5 * 1.5 * 15 + 12; // 5 lines × line-height × font-size + padding
    chatInput.style.height = Math.min(chatInput.scrollHeight, maxH) + 'px';
}

chatInput.addEventListener('input', autoResize);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

/* ── Prompt chips → pre-fill textarea ───────────────────────────── */
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chatInput.value = chip.dataset.prompt;
        autoResize();
        chatInput.focus();
    });
});

sendBtn.addEventListener('click', handleSend);

/* ── Send logic ─────────────────────────────────────────────────── */
async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || isLoading) return;
    if (!GEMINI_API_KEY) {
        alert('No Gemini API key set.\n\nOpen scripts/teachersPortalScripts/ai_assistant.js and paste your key into GEMINI_API_KEY.');
        return;
    }

    // First message — trigger layout transition
    if (!hasStarted) {
        hasStarted = true;
        greetingWrapper.classList.add('has-messages');
        promptChips.classList.add('hidden');
        setTimeout(() => {
            greetingWrapper.style.display = 'none'; // remove from flow after animation
            messagesArea.classList.add('visible');
        }, 500);
    }

    // Clear input
    chatInput.value = '';
    autoResize();

    // Show user bubble immediately
    appendBubble('user', text);

    // Add to history
    history.push({ role: 'user', parts: [{ text }] });

    // Show loader
    const loaderRow = appendLoader();
    isLoading = true;
    sendBtn.disabled = true;
    chatInput.disabled = true;

    try {
        const responseText = await callGemini();
        loaderRow.remove();
        appendBubble('ai', responseText);
        history.push({ role: 'model', parts: [{ text: responseText }] });
    } catch (err) {
        loaderRow.remove();
        appendBubble('ai', `⚠️ Sorry, something went wrong: ${err.message}`);
        console.error('[AI Assistant] Error:', err);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}

/* ── Call Gemini API ─────────────────────────────────────────────── */
async function callGemini() {
    // Prepend system prompt as a user→model turn (Gemini doesn't have a system role)
    const contents = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Understood. I am EduHub AI, ready to assist you.' }] },
        ...history
    ];

    const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.9,
                maxOutputTokens: 2048
            }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response received.';
}

/* ── DOM helpers ─────────────────────────────────────────────────── */
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
        // Render markdown-like formatting
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
    loader.innerHTML = `
        <div class="loader-dot"></div>
        <div class="loader-dot"></div>
        <div class="loader-dot"></div>
    `;

    row.appendChild(avatar);
    row.appendChild(loader);
    messagesArea.appendChild(row);
    scrollToBottom();
    return row;
}

function scrollToBottom() {
    messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
}

/* ── Lightweight markdown formatter ─────────────────────────────── */
function formatAIResponse(text) {
    return text
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Headers (### ## #)
        .replace(/^### (.+)$/gm, '<h4 style="font-weight:600;margin:12px 0 6px;font-size:14px;">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 style="font-weight:600;margin:14px 0 8px;font-size:15px;">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 style="font-weight:700;margin:16px 0 10px;font-size:17px;">$1</h2>')
        // Bullet lists
        .replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Paragraphs (double newlines)
        .replace(/\n\n/g, '</p><p>')
        // Single newlines
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^(.)/s, '<p>$1')
        .replace(/(.)$/s, '$1</p>');
}

/* ── Boot ────────────────────────────────────────────────────────── */
init();
