// timetable.js - Handles timetable UI generation and DOM manipulation

const config = {
    startTime: "08:00",
    periodDuration: 40, // in minutes
    periodsPerDay: 8,
    breakTime: "10:00", // Time where the long break occurs
    breakDuration: 30
};

const dayMapping = {
    'Mon': 1,
    'Tue': 2,
    'Wed': 3,
    'Thu': 4,
    'Fri': 5
};

function generateTimeGrid() {
    const start = new Date(`1970-01-01T${config.startTime}:00`);
    const rows = [];

    for (let i = 0; i < config.periodsPerDay; i++) {
        const currentTime = new Date(start.getTime() + i * config.periodDuration * 60000);
        const timeString = currentTime.toTimeString().substring(0, 5);

        if (timeString === config.breakTime) {
            // Insert break row
            rows.push(`<tr><td>${timeString}</td><td colspan="5" class="break">Break</td></tr>`);
            // Skip the break duration
            i += Math.ceil(config.breakDuration / config.periodDuration) - 1;
        } else {
            rows.push(`<tr data-time="${timeString}"><td>${timeString}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`);
        }
    }

    return rows.join('');
}

async function populateTimetableCards() {
    const entries = await fetchTimetableEntries();
    const timetableCards = document.querySelectorAll('.timetable-card');

    timetableCards.forEach(card => {
        const tbody = card.querySelector('tbody');
        const classId = card.getAttribute('data-class-id');
        if (tbody) {
            tbody.innerHTML = generateTimeGrid();

            // Map entries to cells
            entries.forEach(entry => {
                const time = entry.start_time.slice(0, 5); // "08:00:00" -> "08:00"
                const dayIndex = dayMapping[entry.day_of_week];
                if (dayIndex && time) {
                    const row = tbody.querySelector(`tr[data-time="${time}"]`);
                    if (row) {
                        const cell = row.querySelector(`td:nth-child(${dayIndex + 1})`);
                        if (cell) {
                            cell.innerHTML = `<span class="subject-cell">${entry.Subjects.code}</span><span class="room-cell">${entry.room_number}</span>`;
                        }
                    }
                }
            });

            // Add onclick events to empty cells
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const time = row.getAttribute('data-time');
                if (time) {
                    const cells = row.querySelectorAll('td');
                    cells.forEach((cell, index) => {
                        if (index > 0 && cell.innerHTML === '-') { // Skip time column and only for empty cells
                            const day = Object.keys(dayMapping)[index - 1]; // Mon, Tue, etc.
                            cell.style.cursor = 'pointer';
                            cell.onclick = () => openAssignModal(day, time, classId);
                        }
                    });
                }
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    populateTimetableCards();
    await populateModalDropdowns();
    setupModalHandlers();
});

// Function to open the assign class modal
function openAssignModal(day, time, classId) {
    const modal = document.getElementById('assignClassModal');
    const selectedSlot = document.getElementById('selectedSlot');
    selectedSlot.textContent = `${day} ${time}`;
    modal.style.display = 'block';

    // Store the selected data in hidden inputs or variables
    modal.setAttribute('data-day', day);
    modal.setAttribute('data-time', time);
    modal.setAttribute('data-class-id', classId);
}

// Function to close the modal
function closeModal() {
    const modal = document.getElementById('assignClassModal');
    modal.style.display = 'none';
}

// Function to populate modal dropdowns
async function populateModalDropdowns() {
    const subjects = await fetchSubjectsList();
    const teachers = await fetchTeachersList();

    const subjectSelect = document.getElementById('subjectSelect');
    const teacherSelect = document.getElementById('teacherSelect');

    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        subjectSelect.appendChild(option);
    });

    teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = teacher.name;
        teacherSelect.appendChild(option);
    });
}

// Function to set up modal event handlers
function setupModalHandlers() {
    const saveBtn = document.getElementById('saveClassBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    saveBtn.addEventListener('click', async () => {
        const modal = document.getElementById('assignClassModal');
        const day = modal.getAttribute('data-day');
        const time = modal.getAttribute('data-time');
        const classId = modal.getAttribute('data-class-id');
        const subjectId = document.getElementById('subjectSelect').value;
        const teacherId = document.getElementById('teacherSelect').value;
        const roomNumber = document.getElementById('roomInput').value;

        if (!subjectId || !teacherId || !roomNumber) {
            showToast('Please fill in all fields.', 'warning');
            return;
        }

        const entryData = {
            class_id: parseInt(classId),
            subject_id: parseInt(subjectId),
            teacher_id: parseInt(teacherId),
            day_of_week: day,
            start_time: time + ':00', // Assuming time is HH:MM, add :00 for seconds
            room_number: roomNumber
        };

        const success = await assignClass(entryData);
        if (success) {
            closeModal();
            populateTimetableCards(); // Refresh the grid
        }
    });

    cancelBtn.addEventListener('click', closeModal);
}

// Function to open the create timetable modal
function openCreateModal() {
    const modal = document.getElementById('createTimetableModal');
    modal.style.display = 'block';
}

// Function to close the create modal
function closeCreateModal() {
    const modal = document.getElementById('createTimetableModal');
    modal.style.display = 'none';
}

// Function to set up create modal event handlers
function setupCreateModalHandlers() {
    const createBtn = document.querySelector('[data-create_time_table]');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const createForm = document.getElementById('createTimetableForm');

    createBtn.addEventListener('click', openCreateModal);
    cancelCreateBtn.addEventListener('click', closeCreateModal);
    createForm.addEventListener('submit', handleCreateTimetable);
}

setupCreateModalHandlers()