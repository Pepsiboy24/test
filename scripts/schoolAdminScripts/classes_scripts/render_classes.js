import { supabase } from '../../config.js';

// --- State Management ---
window.allClassesData = []; // Changed to window property for global access

// --- DOM Elements ---
const template = document.querySelector("[data-template]");
const container = document.querySelector("[data-container]");
const searchInput = document.querySelector(".search-input");

// --- 1. Function to Render Cards ---
function renderClasses(dataToRender) {
    container.innerHTML = "";

    if (dataToRender.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">No classes found.</p>';
        return;
    }

    dataToRender.forEach(elem => {
        const card = template.content.cloneNode(true).children[0];

        const classNameEl = card.querySelector("[data-class-name]");
        const classSectionEl = card.querySelector("[data-class-section]");
        const teacherNameEl = card.querySelector("[data-teacher-name]");
        const studentNoEl = card.querySelector("[data-student-no]");

        const teacherFirstName = elem.Teachers?.first_name || "Unassigned";
        const teacherLastName = elem.Teachers?.last_name || "";

        classNameEl.textContent = elem.class_name;
        classSectionEl.textContent = elem.section ? ` - ${elem.section}` : "";
        teacherNameEl.textContent = `${teacherFirstName} ${teacherLastName}`;
        studentNoEl.textContent = elem._studentCount ?? 0;

        // --- Attach Click Events ---
        const editBtn = card.querySelector(".editBtn");
        const viewBtn = card.querySelector(".viewBtn");
        const deleteBtn = card.querySelector(".deleteBtn");

        if (editBtn) editBtn.onclick = () => window.openEditClassModal(elem.class_id);
        if (viewBtn) viewBtn.onclick = () => window.openViewClassModal(elem.class_id);

        if (deleteBtn) {
            deleteBtn.onclick = () => handleDeleteClass(elem);
            if ((elem._studentCount ?? 0) > 0) {
                deleteBtn.classList.add('deleteBtn--locked');
            }
        }

        container.append(card);
    });
}

// --- 2. Smart Delete Handler ---
async function handleDeleteClass(elem) {
    const studentCount = elem._studentCount ?? 0;

    // Block deletion if students are enrolled
    if (studentCount > 0) {
        showToast(`Cannot delete "${elem.class_name}". It has ${studentCount} active student${studentCount > 1 ? 's' : ''}. Please reassign students first.`, "warning");
        return;
    }

    // Confirm before deleting
    const confirmed = await window.showConfirm(`Are you sure you want to delete "${elem.class_name}${elem.section ? ' - ' + elem.section : ''}"? This cannot be undone.`, "Delete Class");
    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from("Classes")
            .delete()
            .eq("class_id", elem.class_id);

        if (error) throw error;

        // Refresh the grid immediately without a full page reload
        await loadClasses();

    } catch (error) {
        console.error("Delete error:", error);
        showToast("Failed to delete class: " + error.message, "error");
    }
}

// --- 3. Function to Fetch Data ---
async function loadClasses() {
    try {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Loading classes...</p>';

        // Fetch classes and student list in parallel
        const [classesResult, studentsResult] = await Promise.all([
            supabase
                .from("Classes")
                .select("*, Teachers(first_name, last_name)"),
            supabase
                .from("Students")
                .select("class_id")
        ]);

        if (classesResult.error) throw classesResult.error;
        if (studentsResult.error) throw studentsResult.error;

        // Build a count map: { class_id -> count }
        const countMap = {};
        (studentsResult.data || []).forEach(student => {
            if (student.class_id != null) {
                countMap[student.class_id] = (countMap[student.class_id] || 0) + 1;
            }
        });

        // Attach the count to each class object
        const classes = (classesResult.data || []).map(cls => ({
            ...cls,
            _studentCount: countMap[cls.class_id] ?? 0
        }));

        window.allClassesData = classes;
        renderClasses(window.allClassesData);

    } catch (error) {
        console.error("Error loading classes:", error);
        container.innerHTML = '<p style="color: red; text-align: center;">Failed to load classes.</p>';
    }
}

// --- 4. Search Logic ---
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredClasses = window.allClassesData.filter(item => {
            const fullName = `${item.class_name || ""} ${item.section || ""}`.toLowerCase();
            return fullName.includes(searchTerm);
        });
        renderClasses(filteredClasses);
    });
}

loadClasses();