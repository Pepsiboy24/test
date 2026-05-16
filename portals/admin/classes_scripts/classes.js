import { supabase as supabaseClient } from '../../../core/config.js';
import { waitForUser } from '/core/perf.js';

// --- 🗄️ Unified Modal Control ---

// Handles the Create/Edit Modal
function closeModal() {
  const modal = document.getElementById("createClassModal");
  const overlay = document.getElementById("overlay");

  // Use consistent display logic
  modal.style.display = 'none';
  overlay.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore scrolling

  // Reset Form UI
  document.getElementById("createClassForm").reset();
  document.getElementById('editClassId').value = "";
  document.querySelector('#createClassModal h2').textContent = "Create New Class";
  document.querySelector('[data-create-class]').textContent = "Create Class";
}

// Handles the View Modal
window.closeViewModal = () => {
  const viewModal = document.getElementById('viewClassModal');
  const overlay = document.getElementById("overlay"); // Use same overlay if needed, or none if View has its own

  viewModal.style.display = 'none';
  overlay.style.display = 'none';
  document.body.style.overflow = 'auto';
};

// --- ✏️ Edit Class Function ---
window.openEditClassModal = async (classId) => {
  const classData = window.allClassesData.find(c => c.class_id == classId);
  if (!classData) return;

  // UI Updates
  document.querySelector('#createClassModal h2').textContent = "Edit Class Information";
  document.querySelector('[data-create-class]').textContent = "Update Class";

  // Populate Fields
  document.getElementById('editClassId').value = classId;
  document.getElementById('className').value = classData.class_name;
  document.getElementById('section').value = classData.section || "";
  document.getElementById('studentsCount').value = classData.no_of_students || 0;

  const teacherName = classData.Teachers ?
    `${classData.Teachers.first_name} ${classData.Teachers.last_name}` : "";
  document.getElementById('teacherSearchInput').value = teacherName;

  // Show Modal consistently
  const modal = document.getElementById("createClassModal");
  const overlay = document.getElementById("overlay");
  modal.style.display = 'block';
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
};

// --- 👁️ View Class Function ---
window.openViewClassModal = (classId) => {
  const classData = window.allClassesData.find(c => c.class_id == classId);
  if (!classData) return;

  document.getElementById('viewClassNameDisplay').textContent = classData.class_name;
  document.getElementById('viewTeacherName').textContent = classData.Teachers ?
    `${classData.Teachers.first_name} ${classData.Teachers.last_name}` : "Unassigned";
  document.getElementById('viewStudentCount').textContent = classData._studentCount ?? 0;

  const viewModal = document.getElementById('viewClassModal');
  const overlay = document.getElementById("overlay");

  viewModal.style.display = 'flex';
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
};

/**
 * Handles both CREATE and UPDATE
 */
async function handleCreateClass(e) {
  e.preventDefault();

  const editId = document.getElementById('editClassId').value;
  const className = document.getElementById("className").value;
  const section = document.getElementById("section").value;
  const teacherName = document.getElementById("teacherSearchInput").value.trim();
  const studentsCount = document.getElementById("studentsCount").value;

  if (!teacherName) {
    showToast("Please select a teacher.", "warning");
    return;
  }

  let teacherId = null;
  try {
    const { data: teachers, error } = await supabaseClient
      .from("Teachers")
      .select("teacher_id")
      .ilike("first_name", teacherName.split(' ')[0])
      .limit(1);

    if (error) throw error;
    if (teachers && teachers.length > 0) {
      teacherId = teachers[0].teacher_id;
    } else {
      showToast(`Teacher '${teacherName}' not found.`, 'warning');
      return;
    }
  } catch (error) {
    console.error("Error fetching teacher:", error);
    return;
  }

  // Get current user's school_id for RLS compliance
  let user;
  try {
    user = await waitForUser();
  } catch (error) {
    console.error('User authentication error:', error);
    showToast('Authentication error. Please log in again.', 'error');
    return;
  }
  
  if (!user || !user.user_metadata?.school_id) {
    console.error('User authentication error: Invalid user data');
    showToast('Authentication error. Please log in again.', 'error');
    return;
  }

  const schoolId = user.user_metadata.school_id;

  const formData = {
    class_name: className,
    section: section,
    teacher_id: teacherId,
    school_id: schoolId // CRITICAL: Add school_id for RLS
  };

  try {
    if (editId) {
      const { error } = await supabaseClient.from("Classes").update(formData).eq('class_id', editId);
      if (error) throw error;
      showToast("Class updated successfully!", "success");
    } else {
      const { error } = await supabaseClient.from("Classes").insert([formData]);
      if (error) throw error;
      showToast("Class created successfully!", "success");
    }

    closeModal();
    location.reload();
  } catch (error) {
    console.error("Save error:", error);
    showToast("Error saving class: " + error.message, "error");
  }
}

// --- Initialization ---
function initializeEventListeners() {
  const createClassBtn = document.getElementById("createClassBtn");
  const closeModalBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const overlay = document.getElementById("overlay");
  const createNewClassBtn = document.querySelector("[data-create-class]");

  if (createClassBtn) {
    createClassBtn.addEventListener("click", () => {
      // Ensure reset to 'Create' mode
      document.getElementById('editClassId').value = "";
      document.querySelector('#createClassModal h2').textContent = "Create New Class";
      document.querySelector('[data-create-class]').textContent = "Create Class";

      document.getElementById("createClassModal").style.display = 'block';
      document.getElementById("overlay").style.display = 'block';
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  if (overlay) {
    overlay.addEventListener("click", () => {
      closeModal();
      closeViewModal();
    });
  }

  if (createNewClassBtn) createNewClassBtn.addEventListener("click", handleCreateClass);

  // Escape key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeViewModal();
    }
  });
}

initializeEventListeners();