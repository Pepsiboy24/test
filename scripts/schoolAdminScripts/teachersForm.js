let currentStep = 1;
const totalSteps = 7;
let submissionInProgress = false;

// UI Initialization
function showStep(step) {
  // 1. Clear everything first
  const steps = document.querySelectorAll(".step, #successStep, #errorStep");
  steps.forEach((s) => s.classList.remove("active"));

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");
  const buttonsContainer = document.querySelector(".buttons");
  const indicators = document.querySelector('.step-indicators');

  // 2. Handle Success State (Hide everything)
  if (step === 'success') {
    const successStep = document.getElementById("successStep");
    if (successStep) successStep.classList.add("active");
    if (indicators) indicators.style.display = "none";
    if (buttonsContainer) buttonsContainer.style.display = "none";
    return;
  }

  // 3. Handle Error State (Show the error div, but keep buttons available)
  if (step === 'error') {
    const errorStep = document.getElementById("errorStep");
    if (errorStep) errorStep.classList.add("active");

    // We keep the buttonsContainer visible so the "Back to Edit" button (if inside) can show
    // Or we rely on the button we just added inside the errorStep div itself.
    if (buttonsContainer) buttonsContainer.style.display = "none"; // Hide main nav buttons
    return;
  }

  // 4. Normal step logic
  if (indicators) indicators.style.display = "flex";
  if (buttonsContainer) buttonsContainer.style.display = "flex";

  const currentStepEl = document.getElementById("step" + step);
  if (currentStepEl) currentStepEl.classList.add("active");

  if (prevBtn) prevBtn.style.display = step === 1 ? "none" : "block";
  if (nextBtn) nextBtn.style.display = step === totalSteps ? "none" : "block";
  if (submitBtn) submitBtn.style.display = step === totalSteps ? "block" : "none";

  updateProgress();
  updateStepIndicators();
}

function updateProgress() {
  const progressFill = document.getElementById("progressFill");
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

function validateStep(step) {
  let isValid = true;
  const requiredFields = document.querySelectorAll(`#step${step} [required]`);
  const today = new Date().toISOString().split('T')[0]; // Gets today's date in YYYY-MM-DD

  requiredFields.forEach((field) => {
    field.classList.remove("error");
    const value = field.value.trim();

    // Basic "Required" check
    if (!value) {
      isValid = false;
      field.classList.add("error");
    }

    // Specific Date Validation (e.g., Date of Birth)
    if (field.type === "date" && field.id === "dateOfBirth") {
      if (value > today) {
        isValid = false;
        field.classList.add("error");
        showToast("Date of Birth cannot be in the future.", "warning");
      }
    }

    // You can add more checks here (e.g., email format, phone length)
  });

  return isValid;
}

function changeStep(direction) {
  if (direction === 1 && !validateStep(currentStep)) return;
  if (direction === 1 && currentStep === 6) populateReview();

  const newStep = currentStep + direction;
  if (newStep >= 1 && newStep <= totalSteps) {
    currentStep = newStep;
    showStep(currentStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// FORM SUBMISSION Logic
document.getElementById("teacherForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!validateStep(7)) return;
  if (submissionInProgress) return;

  const submitBtn = document.getElementById("submitBtn");
  const originalText = submitBtn.textContent;

  submissionInProgress = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Verifying & Saving...";

  try {
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    // Import and Execute
    const { registerNewTeacher } = await import('./teachersFormDB.js');
    const result = await registerNewTeacher(data);

    // LOGIC: Only proceed if result is explicitly TRUE
    if (result === true) {
      this.style.display = "none";
      const buttonsContainer = document.querySelector(".buttons");
      if (buttonsContainer) buttonsContainer.style.display = "none";
      showStep('success');
    } else {
      showStep('error');
      // We don't necessarily need to throw an error here since we handled the UI
    }

  } catch (error) {
    console.error("Submission Error Caught:", error);
    showStep('error'); // Ensure error page shows on crash
  } finally {
    submissionInProgress = false;
  }
});

// Event Listeners
document.getElementById("prevBtn").addEventListener("click", () => changeStep(-1));
document.getElementById("nextBtn").addEventListener("click", () => changeStep(1));

document.addEventListener("DOMContentLoaded", () => {
  showStep(currentStep);
});

function populateReview() {
  const formData = new FormData(document.getElementById("teacherForm"));
  const reviewContent = document.getElementById("reviewContent");
  let html = '<div class="review-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';
  for (let [key, value] of formData.entries()) {
    if (value) {
      html += `<div><strong>${key.replace(/([A-Z])/g, ' $1')}:</strong> ${value}</div>`;
    }
  }
  html += "</div>";
  reviewContent.innerHTML = html;
}

document.addEventListener("click", function (e) {
  if (e.target && e.target.id === "backToEditBtn" || e.target.closest("#backToEditBtn")) {
    // Reset submission locks
    submissionInProgress = false;

    // Go back to the Review Step (Step 7)
    currentStep = 7;
    showStep(currentStep);

    // Re-enable the submit button
    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Registration";
    }
  }
});