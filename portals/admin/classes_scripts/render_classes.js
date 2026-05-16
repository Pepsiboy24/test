import { supabase } from '../../../core/config.js';

/**
 * Helper: Smart Level Naming (Kept original logic)
 */
function getFullLevelName(className) {
    if (!className) return "General Category";
    const name = className.toUpperCase().trim();
    if (name.startsWith('JSS')) return name.replace('JSS', 'Junior Secondary School ');
    if (name.startsWith('SS')) return name.replace('SS', 'Senior Secondary School ');
    if (name.startsWith('PRI')) return name.replace('PRI', 'Primary School ');
    if (name.startsWith('NUR')) return name.replace('NUR', 'Nursery ');
    if (name.startsWith('BASIC')) return name.replace('BASIC', 'Basic Education ');
    return "Secondary School Level";
}

// --- State Management ---
window.allClassesData = [];

// --- DOM Elements ---
const template = document.querySelector("[data-template]");
const container = document.querySelector("[data-container]");
const searchInput = document.querySelector(".search-input");

/**
 * SPEED FIX 1: DOM Fragment Rendering
 * Instead of appending elements one by one, we build a fragment in memory
 * and perform a single "DOM injection" to prevent layout thrashing.
 */
function renderClasses(dataToRender) {
    if (!container || !template) return;

    // Clear container once
    container.innerHTML = "";

    if (dataToRender.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No classes found.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    dataToRender.forEach(elem => {
        const card = template.content.cloneNode(true).children[0];

        // Optimized Selectors
        const classNameEl = card.querySelector("[data-class-name]");
        const classSectionEl = card.querySelector("[data-class-section]");
        const teacherNameEl = card.querySelector("[data-teacher-name]");
        const studentNoEl = card.querySelector("[data-student-no]");
        const levelNameEl = card.querySelector("[data-level]") || card.querySelector("p");

        const teacherName = elem.Teachers 
            ? `${elem.Teachers.first_name} ${elem.Teachers.last_name}` 
            : "Unassigned";

        // Batch content updates
        classNameEl.textContent = elem.class_name;
        classSectionEl.textContent = elem.section ? ` - ${elem.section}` : "";
        if (levelNameEl) levelNameEl.textContent = getFullLevelName(elem.class_name);
        teacherNameEl.textContent = teacherName;
        studentNoEl.textContent = elem._studentCount ?? 0;

        // Actions
        const editBtn = card.querySelector(".editBtn");
        const deleteBtn = card.querySelector(".deleteBtn");
        const viewBtn = card.querySelector(".viewBtn");

        if (viewBtn) viewBtn.setAttribute('data-id', elem.class_id);
        if (editBtn) editBtn.onclick = () => window.openEditClassModal(elem.class_id);

        if (deleteBtn) {
            deleteBtn.onclick = () => handleDeleteClass(elem);
            if ((elem._studentCount ?? 0) > 0) {
                deleteBtn.classList.add('deleteBtn--locked');
                deleteBtn.title = "Cannot delete class with active students";
            }
        }

        fragment.appendChild(card);
    });

    // Single DOM update
    container.appendChild(fragment);
}

/**
 * SPEED FIX 2: Event-Driven Initialization
 * We wait for the 'auth-ready' event from authGuard.js instead of calling
 * getUser() ourselves, preventing Auth Lock collisions.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentUser) {
        loadClasses(window.currentUser);
    } else {
        window.addEventListener('auth-ready', (e) => loadClasses(e.detail), { once: true });
    }
});

async function loadClasses(user) {
    try {
        const schoolId = user?.user_metadata?.school_id;
        if (!schoolId) return;

        // SPEED FIX 3: Parallelized Burst Fetching
        const [classesResult, studentsResult] = await Promise.all([
            supabase.from("Classes")
                .select("*, Teachers(first_name, last_name)")
                .eq("school_id", schoolId)
                .order('class_name', { ascending: true }),
            supabase.from("Students")
                .select("class_id")
                .eq("school_id", schoolId)
        ]);

        if (classesResult.error) throw classesResult.error;

        // High-speed count mapping using a single loop
        const countMap = (studentsResult.data || []).reduce((acc, s) => {
            if (s.class_id) acc[s.class_id] = (acc[s.class_id] || 0) + 1;
            return acc;
        }, {});

        window.allClassesData = (classesResult.data || []).map(cls => ({
            ...cls,
            _studentCount: countMap[cls.class_id] ?? 0
        }));

        renderClasses(window.allClassesData);

    } catch (error) {
        console.error("Load error:", error);
        container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Failed to load classes.</p>';
    }
}

// SPEED FIX 4: Debounced Search
// Prevents unnecessary re-renders while typing
let searchTimeout;
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filtered = window.allClassesData.filter(item => 
                `${item.class_name} ${item.section}`.toLowerCase().includes(searchTerm)
            );
            renderClasses(filtered);
        }, 100); 
    });
}

// Delete Handler (Kept original logic with Optimistic UI hint)
async function handleDeleteClass(elem) {
    if ((elem._studentCount ?? 0) > 0) {
        showToast(`Cannot delete "${elem.class_name}". It has active students.`, "warning");
        return;
    }

    const confirmed = await window.showConfirm(`Delete "${elem.class_name}"?`, "Confirm");
    if (!confirmed) return;

    try {
        const { error } = await supabase.from("Classes").delete().eq("class_id", elem.class_id);
        if (error) throw error;
        
        // Optimistic UI: remove from local state immediately
        window.allClassesData = window.allClassesData.filter(c => c.class_id !== elem.class_id);
        renderClasses(window.allClassesData);
        showToast("Class deleted", "success");
    } catch (err) {
        showToast("Delete failed", "error");
    }
}