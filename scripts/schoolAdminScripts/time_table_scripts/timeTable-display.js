
// Simple timetable display functionality
console.log("=== Script starting ===");

document.addEventListener('DOMContentLoaded', function() {
    console.log("=== DOM Content Loaded - Running sample data ===");
    
    // Sample timetable data
    const sampleTimetables = [
        {
            title: "JSS1 Timetable",
            subtitle: "Junior Secondary School Year 1, All Subjects",
            schedule: [
                { time: "08:00", subjects: ["MATH", "SCI", "PENG", "MATH", "ART"] },
                { time: "09:00", subjects: ["ENG", "", "ICT", "", ""] },
                { time: "10:00", subjects: ["", "HIS", "", "ENG", ""] },
                { time: "11:00", subjects: ["", "", "", "", "PE"] }
            ]
        },
        {
            title: "Year 1 Math Timetable",
            subtitle: "Advanced Mathematics Stream",
            schedule: [
                { time: "08:00", subjects: ["", "", "", "", ""] },
                { time: "09:00", subjects: ["ALG", "GEO", "STAT", "ALG", ""] },
                { time: "10:00", subjects: ["", "", "", "", "STAT"] },
                { time: "11:00", subjects: ["CALC", "", "", "", ""] },
                { time: "13:00", subjects: ["", "", "", "CALC", ""] },
                { time: "14:00", subjects: ["", "CALC", "", "", ""] }
            ]
        },
        {
            title: "Science Stream Timetable",
            subtitle: "Biology, Chemistry, Physics for Year 2",
            schedule: [
                { time: "08:00", subjects: ["", "BIO", "", "", ""] },
                { time: "09:00", subjects: ["", "", "", "BIO", "BIO"] },
                { time: "10:00", subjects: ["", "CHEM", "", "", ""] },
                { time: "11:00", subjects: ["", "PHY", "", "", ""] },
                { time: "13:00", subjects: ["", "", "", "CHEM", ""] },
                { time: "14:00", subjects: ["", "", "", "PHY", ""] }
            ]
        }
    ];

    console.log("Sample timetables created:", sampleTimetables.length);
    
    // Call render function
    renderTimetables(sampleTimetables);
});

// Render timetable cards
function renderTimetables(timetables) {
    console.log("=== Rendering timetables ===");
    const container = document.getElementById('timetablesGrid');
    if (!container) {
        console.error("Container not found!");
        showToast("Container not found!", "error");
        return;
    }
    
    console.log("Container found, rendering", timetables.length, "timetables");
    
    // Clear loading message
    container.innerHTML = '';
    
    // Generate HTML for each timetable
    timetables.forEach((timetable, index) => {
        console.log("Processing timetable", index + 1, ":", timetable.title);
        const cardHTML = createTimetableCard(timetable);
        container.innerHTML += cardHTML;
    });
    
    console.log("=== Render complete ===");
}



// Create individual timetable card HTML with proper table structure
function createTimetableCard(timetable) {
    console.log("Creating card for:", timetable.title);
    
    // Create table header
    const tableHeader = `
        <thead>
            <tr>
                <th class="time-column">Time</th>
                <th class="day-column">Monday</th>
                <th class="day-column">Tuesday</th>
                <th class="day-column">Wednesday</th>
                <th class="day-column">Thursday</th>
                <th class="day-column">Friday</th>
            </tr>
        </thead>
    `;
    
    // Create table body with schedule data
    const tableBody = timetable.schedule.map(slot => {

        const cells = slot.subjects.map(subject => {
            if (subject) {
                return `<td class="subject-cell"><span class="subject-block" data-subject="${subject}">${subject}</span></td>`;
            } else {
                return `<td class="empty-cell"></td>`;
            }
        }).join('');
        
        return `
            <tr class="time-row">
                <td class="time-cell">${slot.time}</td>
                ${cells}
            </tr>
        `;
    }).join('');
    
    const tableBodyHTML = `
        <tbody>
            ${tableBody}
        </tbody>
    `;

    const cardHtml = `
        <div class="timetable-card">
            <div class="timetable-header">
                <h3 class="timetable-title">${timetable.title}</h3>
                <p class="timetable-subtitle">${timetable.subtitle}</p>
            </div>
            <div class="schedule-grid">
                <table class="timetable-table">
                    ${tableHeader}
                    ${tableBodyHTML}
                </table>
            </div>
            <div class="card-footer">
                <button class="btn-view">View Full Timetable</button>
                <button class="btn-edit">
                    <i class="fa-solid fa-pen"></i>
                </button>
            </div>
        </div>
    `;
    
    console.log("Card HTML generated for", timetable.title);
    return cardHtml;
}

// Make functions globally available
window.renderTimetables = renderTimetables;
window.createTimetableCard = createTimetableCard;
