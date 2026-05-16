import { supabase } from "../../../core/config.js";
import { waitForUser, debounce } from '/core/perf.js';

// --- State Management ---
let allEvents = [];          
let uniqueSessions = [];     
let currentSessionIndex = 0; 
let currentCalendarType = 'academic'; // Track the active filter

// --- DOM Elements ---
const tableBody = document.getElementById('academicTableBody');
const monthYearSpan = document.getElementById('monthYear');
const searchInput = document.querySelector('.search-input');
const calendarSelector = document.getElementById('calendarSelector');

// --- 1. Fetching Data ---
async function fetchEvents() {
    try {
        const user = await waitForUser();
        if (!user?.user_metadata?.school_id) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Auth error — please log in again.</td></tr>';
            return;
        }
        const schoolId = user.user_metadata.school_id;

        // Parallel fetch for speed
        const [eventsRes, schoolRes] = await Promise.all([
            supabase.from('academic_events').select('*').eq('school_id', schoolId).order('start_date', { ascending: true }),
            supabase.from('Schools').select('current_session').eq('school_id', schoolId).single()
        ]);

        if (eventsRes.error) throw eventsRes.error;

        allEvents = eventsRes.data;
        processSessions(allEvents, schoolRes.data?.current_session);
        renderCurrentSession();
    } catch (error) {
        console.error("Error fetching events:", error);
    }
}

// --- 2. Data Processing ---
function processSessions(data, currentSchoolSession) {
    const sessions = data.map(event => event.academic_session).filter(Boolean);
    if (currentSchoolSession) sessions.push(currentSchoolSession);
    
    uniqueSessions = [...new Set(sessions)].sort(); 
    window.uniqueSessions = uniqueSessions; 

    if (uniqueSessions.length > 0) {
        if (currentSchoolSession && uniqueSessions.includes(currentSchoolSession)) {
            currentSessionIndex = uniqueSessions.indexOf(currentSchoolSession);
        } else {
            currentSessionIndex = uniqueSessions.length - 1;
        }
    }
}

// --- 3. Rendering (Logic updated to filter by Type) ---
function renderCurrentSession() {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (uniqueSessions.length === 0) {
        monthYearSpan.textContent = "No Academic Sessions Found";
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No events found.</td></tr>';
        return;
    }

    const currentSessionName = uniqueSessions[currentSessionIndex];
    const typeDisplay = currentCalendarType.charAt(0).toUpperCase() + currentCalendarType.slice(1);
    monthYearSpan.textContent = `${currentSessionName} ${typeDisplay} Calendar`;
    monthYearSpan.dataset.sessionName = currentSessionName;

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // FILTERING LOGIC
    let filteredEvents = allEvents.filter(e => {
        const matchesSession = searchTerm ? true : (e.academic_session === currentSessionName);
        const matchesSearch = searchTerm ? 
            (e.academic_session?.toLowerCase().includes(searchTerm) || e.activity_event?.toLowerCase().includes(searchTerm)) : true;
        
        // Category filtering based on term_period or keywords in activity name
        let matchesType = true;
        const activity = (e.activity_event || '').toLowerCase();
        const term = (e.term_period || '').toLowerCase();

        if (currentCalendarType === 'exams') matchesType = activity.includes('exam') || activity.includes('test') || activity.includes('cbt');
        else if (currentCalendarType === 'holidays') matchesType = term === 'holiday' || activity.includes('break') || activity.includes('vacation');
        else if (currentCalendarType === 'events') matchesType = !activity.includes('exam') && term !== 'holiday';

        return matchesSession && matchesSearch && matchesType;
    });

    if (filteredEvents.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #64748b;">No ${currentCalendarType} records found for this period.</td></tr>`;
        return;
    }

    filteredEvents.forEach(event => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${event.term_period || '-'}</td>
            <td>${event.activity_event || '-'}</td>
            <td>${formatDateRange(event.start_date, event.end_date)}</td>
            <td>${event.duration || '-'}</td>
            <td>${event.remarks || '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}

function formatDateRange(start, end) {
    if (!start) return '-';
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const s = new Date(start).toLocaleDateString('en-US', options);
    if (!end || start === end) return s;
    return `${s} - ${new Date(end).toLocaleDateString('en-US', options)}`;
}

// --- 4. Navigation & Search ---
document.getElementById('prevButton').addEventListener('click', () => {
    if (currentSessionIndex > 0) { currentSessionIndex--; renderCurrentSession(); }
});

document.getElementById('nextButton').addEventListener('click', () => {
    if (currentSessionIndex < uniqueSessions.length - 1) { currentSessionIndex++; renderCurrentSession(); }
});

if (searchInput) {
    searchInput.addEventListener('input', debounce(() => renderCurrentSession(), 300));
}

// --- 5. Calendar Switching (FIXED) ---
if (calendarSelector) {
    calendarSelector.addEventListener('change', (e) => {
        currentCalendarType = e.target.value;
        switchCalendarUI(currentCalendarType);
    });
}

function switchCalendarUI(type) {
    const calendarTitle = document.querySelector('.calendar-h2');
    const headers = {
        academic: ['Term/Period', 'Activity/Event', 'Date Range', 'Duration', 'Remarks'],
        events: ['Event Period', 'Event Name', 'Date Range', 'Duration', 'Remarks'],
        holidays: ['Term', 'Holiday Name', 'Date Range', 'Duration', 'Type/Remarks'],
        exams: ['Term', 'Subject/Exam', 'Date Range', 'Duration', 'Instructions']
    };
    
    if (calendarTitle) calendarTitle.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Calendar`;
    updateTableHeader(headers[type] || headers.academic);
    renderCurrentSession();
}

function updateTableHeader(headers) {
    const tableHeader = document.querySelector('.academic-calendar-table thead tr');
    if (tableHeader) {
        tableHeader.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
    }
}

// --- 6. Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Re-select elements inside the listener to ensure they exist
    const calendarSelector = document.getElementById('calendarSelector');
    
    if (calendarSelector) {
        calendarSelector.addEventListener('change', (e) => {
            console.log("Switching to:", e.target.value);
            switchCalendarType(e.target.value);
        });
    } else {
        console.error("Critical Error: 'calendarSelector' element not found in HTML.");
    }

    await fetchEvents();
});