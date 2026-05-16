import { registerNewStudent } from "./singleStudentRegScript.js";
import { supabaseClient } from './supabase_client.js';

// --- State Management ---
let currentStep = 1;
const totalSteps = 3;

// --- DOM References ---
const registrationForm = document.getElementById("registrationForm");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const progressFill = document.getElementById("progressFill");

// --- 1. UI Flow Logic ---

function updateProgress() {
  const percentage = (currentStep / totalSteps) * 100;
  if (progressFill) progressFill.style.width = percentage + "%";
}

function updateStepIndicators() {
  for (let i = 1; i <= totalSteps; i++) {
    const indicator = document.getElementById("indicator" + i);
    if (!indicator) continue;
    const circle = indicator.querySelector(".step-circle");

    if (i < currentStep) {
      indicator.className = "step-indicator completed";
      circle.innerHTML = "✓";
    } else if (i === currentStep) {
      indicator.className = "step-indicator active";
      circle.innerHTML = i;
    } else {
      indicator.className = "step-indicator";
      circle.innerHTML = i;
    }
  }
}

function showStep(step) {
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
  const stepEl = document.getElementById("step" + step);
  if (stepEl) stepEl.classList.add("active");

  // Button Visibility
  prevBtn.style.display = step === 1 ? "none" : "block";
  nextBtn.style.display = step === totalSteps ? "none" : "block";
  submitBtn.style.display = step === totalSteps ? "block" : "none";

  updateProgress();
  updateStepIndicators();
}

// --- 2. Validation Logic ---

function validateStep(step) {
  let isValid = true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkField = (id, errorId) => {
    const el = document.getElementById(id);
    if (!el || !el.value.trim() || (el.type === 'email' && !el.validity.valid && el.value !== "No Email in DB")) {
      showError(errorId);
      isValid = false;
    } else {
      hideError(errorId);
    }
  };

  if (step === 1) {
    checkField("fullName", "fullNameError");
    checkField("email", "emailError");

    // DOB check
    const dob = document.getElementById("dateOfBirth");
    if (!dob.value || new Date(dob.value) > today) {
      showError("dobError");
      isValid = false;
    } else {
      hideError("dobError");
    }

    // Parent Fields - CRITICAL for fixing the NULL issue
    checkField("parentFullName", "parentFullNameError");
    checkField("parentPhone", "parentPhoneError");
    checkField("relationship", "relationshipError");

    const parentEmail = document.getElementById("parentEmail");
    if (!parentEmail.value.trim() || (parentEmail.value !== "No Email in DB" && !parentEmail.validity.valid)) {
      showError("parentEmailError");
      isValid = false;
    } else {
      hideError("parentEmailError");
    }
  }

  if (step === 2) {
    checkField("class", "classError");
    const admit = document.getElementById("admissionDate");
    if (!admit.value) {
      showError("admissionDateError");
      isValid = false;
    } else {
      hideError("admissionDateError");
    }
  }

  return isValid;
}

// --- 3. Action Handlers ---

nextBtn.addEventListener("click", () => {
  if (validateStep(currentStep)) {
    if (currentStep === 2) populateReview();
    currentStep++;
    showStep(currentStep);
  }
});

prevBtn.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
});

function showError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function populateReview() {
  const reviewContent = document.getElementById("reviewContent");
  if (!reviewContent) return;

  const getValue = (id) => document.getElementById(id)?.value || "N/A";
  const classId = getValue("class");
  const classText = document.querySelector(`#class option[value="${classId}"]`)?.textContent || "Not Selected";

  reviewContent.innerHTML = `
        <div class="review-section">
            <h4>Student Information</h4>
            <p><strong>Name:</strong> ${getValue("fullName")}</p>
            <p><strong>Email:</strong> ${getValue("email")}</p>
            <p><strong>DOB:</strong> ${getValue("dateOfBirth")}</p>
        </div>
        <div class="review-section">
            <h4>Guardian Information</h4>
            <p><strong>Name:</strong> ${getValue("parentFullName")}</p>
            <p><strong>Phone:</strong> ${getValue("parentPhone")}</p>
            <p><strong>Relationship:</strong> ${getValue("relationship")}</p>
        </div>
        <div class="review-section">
            <h4>Enrollment</h4>
            <p><strong>Class:</strong> ${classText}</p>
            <p><strong>Admission Date:</strong> ${getValue("admissionDate")}</p>
        </div>
    `;
}

// --- 4. Submission ---

registrationForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  if (!validateStep(currentStep)) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

  const parentData = {
    linkedParentId: document.getElementById("linkedParentId").value,
    parentFullName: document.getElementById("parentFullName").value,
    parentEmail: document.getElementById("parentEmail").value,
    parentPhone: document.getElementById("parentPhone").value,
    parentAddress: document.getElementById("parentAddress").value,
    relationship: document.getElementById("relationship").value,
    parentOccupation: document.getElementById("parentOccupation").value
  };

  const result = await registerNewStudent(
    document.getElementById("fullName").value,
    document.getElementById("email").value,
    "123456", // Default password
    document.getElementById("dateOfBirth").value,
    document.getElementById("admissionDate").value,
    "https://placehold.co/150",
    document.getElementById("class").value,
    document.querySelector('input[name="gender"]:checked')?.value || 'other',
    parentData
  );

  if (result && result.success) {
    document.getElementById("step3").classList.remove("active");
    document.getElementById("successStep").classList.add("active");
    document.querySelector(".buttons").style.display = "none";
    if (typeof window.refreshStudentList === 'function') window.refreshStudentList();
  } else {
    alert("Error: " + (result.error || "Unknown error"));
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Registration";
  }
});

// --- 5. Parent Search ---

const searchParentBtn = document.getElementById("searchParentBtn");
if (searchParentBtn) {
  searchParentBtn.addEventListener("click", async () => {
    const phoneInput = document.getElementById("parentSearchPhone").value.trim();
    const msgDiv = document.getElementById("parentSearchMessage");

    if (!phoneInput) return;

    try {
      const { data, error } = await supabaseClient
        .from("Parents")
        .select("*")
        .eq("phone_number", phoneInput)
        .maybeSingle();

      const parentFields = ["parentFullName", "parentEmail", "parentPhone", "parentOccupation", "parentAddress", "linkedParentId"];

      if (data) {
        document.getElementById("linkedParentId").value = data.parent_id;
        document.getElementById("parentFullName").value = data.full_name;
        document.getElementById("parentEmail").value = data.email || "No Email in DB";
        document.getElementById("parentPhone").value = data.phone_number;
        document.getElementById("parentOccupation").value = data.occupation || "";
        document.getElementById("parentAddress").value = data.address || "";

        parentFields.forEach(id => { if (id !== "linkedParentId") document.getElementById(id).readOnly = true; });
        msgDiv.innerHTML = `<i class="fas fa-check-circle"></i> Existing parent linked.`;
        msgDiv.style.color = "green";
      } else {
        document.getElementById("linkedParentId").value = "";
        document.getElementById("parentPhone").value = phoneInput;
        parentFields.forEach(id => { if (id !== "linkedParentId") document.getElementById(id).readOnly = false; });
        msgDiv.innerHTML = "New parent. Please enter details below.";
        msgDiv.style.color = "#64748b";
      }
    } catch (err) {
      console.error(err);
    }
  });
}

// --- 6. Initialization ---
async function init() {
  showStep(currentStep);
  document.getElementById("admissionDate").valueAsDate = new Date();

  // Load Classes
  const { data: classes } = await supabaseClient.from('Classes').select('class_id, class_name, section').order('class_name');
  const dropdown = document.getElementById("class");
  if (dropdown && classes) {
    dropdown.innerHTML = '<option value="">Select a Class</option>' +
      classes.map(c => `<option value="${c.class_id}">${c.class_name} ${c.section || ''}</option>`).join('');
  }
}

document.addEventListener('DOMContentLoaded', init);