import { registerNewStudent } from "../../scripts/schoolAdminScripts/students_scripts/singleStudentRegScript.js";
import { supabase as supabaseClient } from "../config.js";
import { checkTeacherLogin } from "../teacherUtils.js";

// --- 1. Supabase Configuration ---
if (!supabaseClient) {
  console.error("Supabase client not loaded. Make sure the CDN script is in your HTML.");
}

// --- 3. Populate Teacher's Classes ---
let teacherClasses = [];

async function populateTeacherClasses(teacherId) {
    try {
        const [formClassesRes, subjectClassesRes] = await Promise.all([
            supabaseClient
                .from('Classes')
                .select('class_id, class_name, section')
                .eq('teacher_id', teacherId),
            supabaseClient
                .from('Class_Subjects')
                .select(`
                    class_id,
                    Classes!inner(class_name, section)
                `)
                .eq('teacher_id', teacherId)
        ]);

        const classSelect = document.getElementById("classSelect");
        if (!classSelect) return;

        if (formClassesRes.error && subjectClassesRes.error) {
            window.showToast?.('Error fetching teacher classes.', 'error');
            classSelect.innerHTML = '<option value="">Error loading classes</option>';
            return;
        }

        const uniqueClasses = [];
        const seen = new Set();
        
        (formClassesRes.data || []).forEach(record => {
            if (!seen.has(record.class_id)) {
                seen.add(record.class_id);
                uniqueClasses.push({
                    class_id: record.class_id,
                    class_name: record.class_name,
                    section: record.section
                });
            }
        });

        (subjectClassesRes.data || []).forEach(record => {
            if (!seen.has(record.class_id)) {
                seen.add(record.class_id);
                uniqueClasses.push({
                    class_id: record.class_id,
                    class_name: record.Classes?.class_name,
                    section: record.Classes?.section
                });
            }
        });

        teacherClasses = uniqueClasses;

        if (teacherClasses.length === 0) {
            classSelect.innerHTML = '<option value="">No classes assigned</option>';
            classSelect.disabled = true;
            document.getElementById("nextBtn").disabled = true;
            window.showToast?.('No classes assigned to this account.', 'warning');
            return;
        }

        classSelect.innerHTML = '<option value="">Select a class</option>';
        teacherClasses.forEach(c => {
            const option = document.createElement("option");
            option.value = c.class_id;
            option.textContent = `${c.class_name} ${c.section || ''}`.trim();
            classSelect.appendChild(option);
        });
        classSelect.disabled = false;
        document.getElementById("nextBtn").disabled = false;

    } catch (err) {
        window.showToast?.('Unexpected error fetching classes.', 'error');
    }
}

// --- 4. Existing Form Logic ---
let currentStep = 1;
const totalSteps = 3;
const previousBtn = document.getElementById("prevBtn");
const nextBtns = document.getElementById("nextBtn");
const submitBtns = document.getElementById("submitBtn");

function updateProgress() {
  const progressFill = document.getElementById("progressFill");
  const percentage = (currentStep / totalSteps) * 100;
  progressFill.style.width = percentage + "%";
}

function updateStepIndicators() {
  for (let i = 1; i <= totalSteps; i++) {
    const indicator = document.getElementById("indicator" + i);
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
  // Hide all steps
  const steps = document.querySelectorAll(".step");
  steps.forEach((s) => s.classList.remove("active"));

  // Show current step
  document.getElementById("step" + step).classList.add("active");

  // Update buttons
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");

  if (step === 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "block";
    submitBtn.style.display = "none";
  } else if (step === totalSteps) {
    prevBtn.style.display = "block";
    nextBtn.style.display = "none";
    submitBtn.style.display = "block";
  } else {
    prevBtn.style.display = "block";
    nextBtn.style.display = "block";
    submitBtn.style.display = "none";
  }

  updateProgress();
  updateStepIndicators();
}

// --- UPDATED VALIDATION LOGIC ---
function validateStep(step) {
  let isValid = true;

  // Get "Today" with time stripped out for accurate date comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (step === 1) {
    const fullName = document.getElementById("fullName");
    const email = document.getElementById("email");
    const dateOfBirth = document.getElementById("dateOfBirth");
    const gender = document.querySelector('input[name="gender"]:checked');

    // Name Validation
    if (!fullName.value.trim()) {
      showError("fullNameError"); // Ensure you have <div id="fullNameError"> in HTML
      isValid = false;
    } else {
      hideError("fullNameError");
    }

    // Email Validation
    if (!email.value.trim() || !email.validity.valid) {
      showError("emailError");
      isValid = false;
    } else {
      hideError("emailError");
    }

    // Date of Birth Validation (Check Future)
    const dobError = document.getElementById("dobError");
    if (!dateOfBirth.value) {
      if(dobError) dobError.textContent = "Date of Birth is required";
      showError("dobError");
      isValid = false;
    } else {
      const dobDate = new Date(dateOfBirth.value);
      if (dobDate > today) {
         if(dobError) dobError.textContent = "Date of birth cannot be in the future";
         showError("dobError");
         isValid = false;
      } else {
        hideError("dobError");
      }
    }

    // Gender Validation
    if (!gender) {
      showError("genderError");
      isValid = false;
    } else {
      hideError("genderError");
    }
  }

  if (step === 2) {
    const admissionDate = document.getElementById("admissionDate");
    const classSelect = document.getElementById("classSelect");

    // Class Validation
    if (classSelect) {
      if (!classSelect.value) {
        showError("classSelectError");
        isValid = false;
      } else {
        hideError("classSelectError");
      }
    }

    // Admission Date Validation (Check Past)
    const admitError = document.getElementById("admissionDateError");
    if (!admissionDate.value) {
      if(admitError) admitError.textContent = "Admission Date is required";
      showError("admissionDateError");
      isValid = false;
    } else {
      const admitDate = new Date(admissionDate.value);
      // Check if admission date is strictly before today
      if (admitDate < today) {
        if(admitError) admitError.textContent = "Admission date cannot be in the past";
        showError("admissionDateError");
        isValid = false;
      } else {
        hideError("admissionDateError");
      }
    }
  }

  return isValid;
}

nextBtns.addEventListener("click", () => {
  changeStep(1);
});

previousBtn.addEventListener("click", () => {
  changeStep(-1);
});

function showError(errorId) {
  const el = document.getElementById(errorId);
  if (el) el.style.display = "block";
}

function hideError(errorId) {
  // UPDATED: Uncommented this line so errors actually disappear
  const el = document.getElementById(errorId);
  if (el) el.style.display = "none";
}

function changeStep(direction) {
  if (direction === 1 && !validateStep(currentStep)) {
    return;
  }

  if (direction === 1 && currentStep === 2) {
    populateReview();
  }

  const newStep = currentStep + direction;
  if (newStep >= 1 && newStep <= totalSteps) {
    currentStep = newStep;
    showStep(currentStep);
  }
}

async function populateReview() {
  const formData = new FormData(document.getElementById("registrationForm"));
  const reviewContent = document.getElementById("reviewContent");

  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const dateOfBirth = formData.get("dateOfBirth");
  const gender = formData.get("gender");
  const admissionDate = formData.get("admissionDate");

  // Get teacher's class for display safely from dropdown
  let classDisplay = "N/A";
  const classSelect = document.getElementById("classSelect");
  if (classSelect && classSelect.options[classSelect.selectedIndex]) {
    const selectedText = classSelect.options[classSelect.selectedIndex].text;
    if (classSelect.value) { // Ensure a real value is selected
      classDisplay = selectedText;
    }
  }

  reviewContent.innerHTML = `
                <h3 style="margin-bottom: 16px; color: #1e293b;">Personal Information</h3>
                <p><strong>Full Name:</strong> ${fullName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Date of Birth:</strong> ${new Date(
                  dateOfBirth
                ).toLocaleDateString()}</p>
                <p><strong>Gender:</strong> ${
                  gender.charAt(0).toUpperCase() + gender.slice(1)
                }</p>

                <h3 style="margin: 24px 0 16px; color: #1e293b;">Academic Details</h3>
                <p><strong>Class:</strong> ${classDisplay}</p>
                <p><strong>Admission Date:</strong> ${new Date(
                  admissionDate
                ).toLocaleDateString()}</p>
            `;

  return {
    fullName,
    email,
    dateOfBirth,
    gender,
    admissionDate,
  };
}

const resetBtn = document.querySelector("[data-resetBtn]")
if (resetBtn) {
    resetBtn.addEventListener("click", resetForm)
}

function resetForm() {
  document.getElementById("registrationForm").reset();
  currentStep = 1;
  showStep(currentStep);
  document.getElementById("successStep").classList.remove("active");
  // Show buttons again
  document.querySelector(".buttons").style.display = "block";
  // Reset date default
  document.getElementById("admissionDate").valueAsDate = new Date();
}

// --- 5. Initialize Form ---
document.addEventListener('DOMContentLoaded', async () => {
  // Set default admission date to today
  document.getElementById("admissionDate").valueAsDate = new Date();

  // Initialize Steps
  showStep(currentStep);

  const loginInfo = await checkTeacherLogin();
  if (loginInfo && loginInfo.teacherId) {
      await populateTeacherClasses(loginInfo.teacherId);
  }
});

// --- 6. Form Submission ---
document
  .getElementById("registrationForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    if (validateStep(currentStep)) {
      const loginInfo = await checkTeacherLogin();
      if (!loginInfo || !loginInfo.teacherId) return;

      const classSelect = document.getElementById("classSelect");
      const selectedClassId = classSelect ? classSelect.value : null;

      if (!selectedClassId) {
        window.showToast?.('Please select a class first.', 'error');
        return;
      }

      const fullName = document.getElementById("fullName").value;
      const email = document.getElementById("email").value;
      const dateOfBirth = document.getElementById("dateOfBirth").value;
      const admissionDate = document.getElementById("admissionDate").value;

      // Get the selected gender
      const gender = document.querySelector('input[name="gender"]:checked').value;

      const profilePicUrl = "https://placehold.co/150x150/e8e8e8/363636?text=Profile";

      // Pass the teacher's class_id to your registration function
      const registrationResult = await registerNewStudent(
          fullName,
          email,
          "123456",
          dateOfBirth,
          admissionDate,
          profilePicUrl,
          selectedClassId,
          gender
      );

      if (registrationResult) {
        document.getElementById("step3").classList.remove("active");
        document.getElementById("successStep").classList.add("active");
        document.querySelector(".buttons").style.display = "none";
        
        window.showToast?.('Student registered successfully!', 'success');

        // Refresh the student list
        if (typeof window.loadAllTeacherStudents === 'function') {
            window.loadAllTeacherStudents();
        } else {
            window.location.reload();
        }
      } else {
        window.showToast?.("Registration failed. Please try again.", "error");
      }
    }
  });
