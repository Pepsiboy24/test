// Supabase setup
import { supabase } from "../../../core/config.js";
import { lazyScript } from '/core/perf.js';

document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const browseButton = document.getElementById('browseButton');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const uploadZone = document.querySelector('.upload-zone');

    if (browseButton) browseButton.addEventListener('click', () => fileInput.click());

    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (fileNameDisplay) fileNameDisplay.textContent = `Selected: ${file.name}`;
                processFile(file);
            }
        });
    }

    // Drag & Drop
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-active'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-active'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-active');
            if (fileInput) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); }
        });
    }

    async function processFile(file) {
        const fileType = file.name.split('.').pop().toLowerCase();
        let events = [];

        // 1. Get current Session Info from UI
        const monthYearEl = document.getElementById('monthYear');
        let currentSession = monthYearEl ? monthYearEl.dataset.sessionName : null;
        if (!currentSession && monthYearEl) {
            currentSession = monthYearEl.textContent.replace(' Academic Session', '').trim();
        }

        try {
            // --- THE ANTI-GRAVITY AUTH PULSE ---
            // This forces the browser to get a fresh JWT token containing your school_id
            const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError || !session) {
                throw new Error("Security token expired. Please log out and log back in to verify your school identity.");
            }

            const schoolId = session.user.user_metadata.school_id;
            if (!schoolId) {
                throw new Error("Your account is not linked to a school UUID. Please re-run onboarding.");
            }

            // 2. Parse based on type
            if (fileType === 'csv') events = await parseCSV(file);
            else if (fileType === 'xlsx') events = await parseXLSX(file);
            else if (fileType === 'ics') events = await parseICS(file);

            if (!events || events.length === 0) {
                showToast('No valid events found in the file.', 'warning');
                return;
            }

            // 3. THE SMART TRANSLATOR: Maps Template Headers -> Database Columns
            // We force-inject the schoolId and the currentSession into every row
            const finalizedEvents = events.map((event, index) => {
                // Defensive check for Row 1/2 failures
                const activityName = event.Title || event.activity_event || event.activity;
                if (!activityName) console.warn(`Row ${index + 1} is missing a Title.`);

                return {
                    activity_event: activityName || "Unnamed Event",
                    start_date: event['Start Date'] || event.start_date,
                    end_date: event['End Date'] || event.end_date || null,
                    term_period: event['Term Period'] || event.term_period || 'First Term',
                    remarks: event.Description || event.remarks || '',
                    academic_session: currentSession,
                    school_id: schoolId // This MUST match the UUID in the DB policy
                };
            });

            console.log("Pushing translated data to Supabase:", finalizedEvents);

            // 4. Secure Insert
            const { error: insertError } = await supabase
                .from('academic_events')
                .insert(finalizedEvents, { count: 'minimal' });

            if (insertError) throw insertError;

            showToast(`✅ Successfully uploaded ${finalizedEvents.length} events!`, "success");
            fileInput.value = '';
            if (fileNameDisplay) fileNameDisplay.textContent = '';

            if (window.refreshAcademicTable) await window.refreshAcademicTable();

        } catch (error) {
            console.error('Anti-Gravity Mission Failure:', error);
            showToast('Upload blocked: ' + error.message, 'error');
        }
    }

    // Helper: Excel Date Parser
    function excelDateToJSDate(serial) {
        if (!serial) return null;
        if (typeof serial === 'string') {
            const d = new Date(serial);
            return isNaN(d) ? null : d.toISOString().split('T')[0];
        }
        return new Date(Math.floor(serial - 25569) * 86400 * 1000).toISOString().split('T')[0];
    }

    async function parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const events = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    if (values.length > 1) {
                        const event = {};
                        headers.forEach((header, index) => {
                            const value = values[index] ? values[index].trim() : null;
                            const field = mapHeaderToField(header);

                            if (header.includes('date') && value) {
                                // Simple fallback parsing for date
                                try {
                                    event[field] = new Date(value).toISOString().split('T')[0];
                                } catch (e) {
                                    event[field] = value;
                                }
                            } else {
                                event[field] = value || null;
                            }
                        });
                        if (event.activity_event) events.push(event);
                    }
                }
                resolve(events);
            };
            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file);
        });
    }

    async function parseXLSX(file) {
    // Lazy-load XLSX only when needed (saves ~1MB on initial page load)
    await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (jsonData.length === 0) resolve([]);

                    const headers = jsonData[0].map(h => String(h).toLowerCase());
                    const events = [];

                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        const event = {};
                        headers.forEach((header, index) => {
                            const value = row[index];
                            const field = mapHeaderToField(header);

                            if (header.includes('date')) {
                                event[field] = value ? excelDateToJSDate(value) : null;
                            } else {
                                event[field] = value || null;
                            }
                        });
                        if (event.activity_event) events.push(event);
                    }
                    resolve(events);
                } catch (error) {
                    reject(new Error('Failed to parse XLSX file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read XLSX file'));
            reader.readAsArrayBuffer(file);
        });
    }

    async function parseICS(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const events = [];
                const eventBlocks = text.split('BEGIN:VEVENT');

                for (let i = 1; i < eventBlocks.length; i++) {
                    const block = eventBlocks[i];
                    const event = {};
                    const lines = block.split('\n');

                    lines.forEach(line => {
                        if (line.startsWith('SUMMARY:')) {
                            event.activity_event = line.substring(8).trim();
                        } else if (line.startsWith('DTSTART:')) {
                            const dateStr = line.substring(8).trim();
                            event.start_date = parseICSDate(dateStr);
                        } else if (line.startsWith('DTEND:')) {
                            const dateStr = line.substring(6).trim();
                            event.end_date = parseICSDate(dateStr);
                        } else if (line.startsWith('DESCRIPTION:')) {
                            event.remarks = line.substring(12).trim();
                        }
                    });

                    if (event.activity_event && event.start_date) {
                        event.term_period = 'Holiday';
                        events.push(event);
                    }
                }
                resolve(events);
            };
            reader.onerror = () => reject(new Error('Failed to read ICS file'));
            reader.readAsText(file);
        });
    }

    function parseICSDate(dateStr) {
        const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }
        return null;
    }

    function mapHeaderToField(header) {
        const mapping = {
            'academic session': 'academic_session',
            'session': 'academic_session',
            'term period': 'term_period', 
            'term': 'term_period',
            'period': 'term_period',
            'title': 'activity_event', 
            'activity': 'activity_event',
            'activity_event': 'activity_event',
            'event': 'activity_event',
            'start date': 'start_date',
            'start_date': 'start_date',
            'start': 'start_date',
            'end date': 'end_date',
            'end_date': 'end_date',
            'end': 'end_date',
            'duration': 'duration',
            'description': 'remarks', 
            'remarks': 'remarks',
            'note': 'remarks'
        };
        if (mapping[header]) return mapping[header];
        for (const key in mapping) {
            if (header.includes(key)) return mapping[key];
        }
        return header;
    }
});