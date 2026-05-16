import { registerNewStudent } from "./singleStudentRegScript.js";
import { supabaseClient } from './supabase_client.js';


// --- 2. Existing Form Logic ---
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
      if (dobError) dobError.textContent = "Date of Birth is required";
      showError("dobError");
      isValid = false;
    } else {
      const dobDate = new Date(dateOfBirth.value);
      if (dobDate > today) {
        if (dobError) dobError.textContent = "Date of birth cannot be in the future";
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

    // Parent Validation
    const parentFullName = document.getElementById("parentFullName");
    if (!parentFullName.value.trim()) {
      showError("parentFullNameError");
      isValid = false;
    } else {
      hideError("parentFullNameError");
    }

    const parentEmail = document.getElementById("parentEmail");
    let emailPatternValid = parentEmail.value.trim() !== "" && parentEmail.validity && parentEmail.validity.valid;
    // Special check if we set it to "No Email in DB"
    if (parentEmail.value === "No Email in DB") emailPatternValid = true;

    if (!emailPatternValid) {
      showError("parentEmailError");
      isValid = false;
    } else {
      hideError("parentEmailError");
    }

    const parentPhone = document.getElementById("parentPhone");
    if (!parentPhone.value.trim()) {
      showError("parentPhoneError");
      isValid = false;
    } else {
      hideError("parentPhoneError");
    }

    const relationship = document.getElementById("relationship");
    if (!relationship.value) {
      showError("relationshipError");
      isValid = false;
    } else {
      hideError("relationshipError");
    }
  }

  if (step === 2) {
    const classField = document.getElementById("class");
    const admissionDate = document.getElementById("admissionDate");

    // Class Validation
    if (!classField.value) {
      showError("classError");
      isValid = false;
    } else {
      hideError("classError");
    }

    // Admission Date Validation (Check Past)
    const admitError = document.getElementById("admissionDateError");
    if (!admissionDate.value) {
      if (admitError) admitError.textContent = "Admission Date is required";
      showError("admissionDateError");
      isValid = false;
    } else {
      const admitDate = new Date(admissionDate.value);
      // Check if admission date is strictly before today
      if (admitDate < today) {
        if (admitError) admitError.textContent = "Admission date cannot be in the past";
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

function populateReview() {
  const formData = new FormData(document.getElementById("registrationForm"));
  const reviewContent = document.getElementById("reviewContent");

  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const dateOfBirth = formData.get("dateOfBirth");
  const gender = formData.get("gender");
  const classValue = formData.get("class"); // This is the ID (e.g., 45)
  const admissionDate = formData.get("admissionDate");
  const parentFullName = formData.get("parentFullName");
  const parentPhone = formData.get("parentPhone");
  const relationship = formData.get("relationship");
  const parentOccupation = formData.get("parentOccupation") || "";
  const parentAddress = formData.get("parentAddress") || "";

  // Get the text label of the selected option (e.g., "JSS 1 A")
  const classTextOption = document.querySelector(`option[value="${classValue}"]`);
  const classText = classTextOption ? classTextOption.textContent : "Not Selected";

  reviewContent.innerHTML = `
                <h3 style="margin-bottom: 16px; color: #1e293b;">Personal Information</h3>
                <p><strong>Full Name:</strong> ${fullName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Date of Birth:</strong> ${new Date(
    dateOfBirth
  ).toLocaleDateString()}</p>
                <p><strong>Gender:</strong> ${gender.charAt(0).toUpperCase() + gender.slice(1)
    }</p>
                
                <h3 style="margin: 24px 0 16px; color: #1e293b;">Parent/Guardian Details</h3>
                <p><strong>Name:</strong> ${parentFullName}</p>
                <p><strong>Phone:</strong> ${parentPhone}</p>
                <p><strong>Relationship:</strong> ${relationship}</p>

                <h3 style="margin: 24px 0 16px; color: #1e293b;">Academic Details</h3>
                <p><strong>Class:</strong> ${classText}</p>
                <p><strong>Admission Date:</strong> ${new Date(
      admissionDate
    ).toLocaleDateString()}</p>
            `;

  return {
    fullName,
    email,
    dateOfBirth,
    gender,
    classValue,
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

document
  .getElementById("registrationForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    if (validateStep(currentStep)) {
      const fullName = document.getElementById("fullName").value;
      const email = document.getElementById("email").value;
      const dateOfBirth = document.getElementById("dateOfBirth").value;
      const admissionDate = document.getElementById("admissionDate").value;

      // Get the Class ID (integer) from the dropdown
      const classId = document.getElementById("class").value;

      // Get the selected gender
      const gender = document.querySelector('input[name="gender"]:checked').value;

      const profilePicUrl = "https://placehold.co/150x150/e8e8e8/363636?text=Profile";

      const linkedParentId = document.getElementById("linkedParentId").value;
      const parentFullName = document.getElementById("parentFullName").value;
      const parentEmail = document.getElementById("parentEmail").value;
      const parentPhone = document.getElementById("parentPhone").value;
      const relationship = document.getElementById("relationship").value;
      const parentOccupation = document.getElementById("parentOccupation").value;
      const parentAddress = document.getElementById("parentAddress").value;

      // Pass the classId and gender to your registration function
      const registrationResult = await registerNewStudent(
        fullName,
        email,
        "123456",
        dateOfBirth,
        admissionDate,
        profilePicUrl,
        classId,
        gender,
        {
          linkedParentId,
          parentFullName,
          parentEmail,
          parentPhone,
          relationship,
          parentOccupation,
          parentAddress
        }
      );

      if (registrationResult) {
        document.getElementById("step3").classList.remove("active");
        document.getElementById("successStep").classList.add("active");
        document.querySelector(".buttons").style.display = "none";

        if (typeof window.refreshStudentList === 'function') {
          console.log("🔄 Refreshing student table...");
          window.refreshStudentList();
        }
      } else {
        console.error("Registration failed. Please try again.");
      }
    }
  });

// --- 3. Populate Class Dropdown ---

async function populateClassDropdown(elementId) {
  const dropdown = document.getElementById(elementId);
  if (!dropdown) return;

  try {
    const { data: classes, error } = await supabaseClient
      .from('Classes')
      .select('class_id, class_name, section')
      .order('class_name', { ascending: true });

    if (error) throw error;

    dropdown.innerHTML = '<option value="">Select a Class</option>';

    classes.forEach(cls => {
      const option = document.createElement('option');
      option.value = cls.class_id;
      option.textContent = `${cls.class_name} ${cls.section}`;
      dropdown.appendChild(option);
    });

    console.log("✅ Classes loaded successfully.");

  } catch (err) {
    console.error("Error loading classes:", err.message);
    dropdown.innerHTML = '<option value="">Error loading classes</option>';
  }
}


// --- 4. Initialization ---

// Set default admission date to today
document.getElementById("admissionDate").valueAsDate = new Date();

// Initialize Steps
showStep(currentStep);

// Trigger population
populateClassDropdown("class");

const searchParentBtn = document.getElementById("searchParentBtn");
if (searchParentBtn) {
  // singleStudentRegForm.js - Updated Search Logic
  searchParentBtn.addEventListener("click", async () => {
    const phoneInput = document.getElementById("parentSearchPhone").value.trim();
    const msgDiv = document.getElementById("parentSearchMessage");

    // 1. Reset Form State immediately on click
    const fields = ["parentFullName", "parentEmail", "parentPhone", "parentOccupation", "parentAddress", "linkedParentId"];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id !== "parentPhone") el.value = ""; // Don't clear the phone being searched
        el.readOnly = false; // Ensure fields are typeable for new entries
      }
    });

    if (!phoneInput) {
      msgDiv.textContent = "Please enter a phone number.";
      msgDiv.style.color = "red";
      return;
    }

    try {
      // 2. Use maybeSingle() to prevent the 406 error we discussed
      const { data, error } = await supabaseClient
        .from("Parents")
        .select("*")
        .eq("phone_number", phoneInput)
        .maybeSingle();

      if (data) {
        // PARENT FOUND: Lock fields
        document.getElementById("linkedParentId").value = data.parent_id;
        document.getElementById("parentFullName").value = data.full_name;
        document.getElementById("parentEmail").value = data.email || "No Email in DB";
        document.getElementById("parentPhone").value = data.phone_number;
        document.getElementById("parentOccupation").value = data.occupation || "";
        document.getElementById("parentAddress").value = data.address || "";

        // Disable editing for existing records
        document.getElementById("parentFullName").readOnly = true;
        document.getElementById("parentEmail").readOnly = true;
        document.getElementById("parentPhone").readOnly = true;
        document.getElementById("parentOccupation").readOnly = true;
        document.getElementById("parentAddress").readOnly = true;

        msgDiv.innerHTML = `<i class="fa-solid fa-check-circle"></i> Parent found.`;
        msgDiv.style.color = "green";
      } else {
        // PARENT NOT FOUND: Ensure fields are fresh and editable
        document.getElementById("linkedParentId").value = "";
        document.getElementById("parentPhone").value = phoneInput;

        msgDiv.innerHTML = `<i class="fa-solid fa-info-circle"></i> New Parent. Please enter details.`;
        msgDiv.style.color = "#64748b";
      }
    } catch (err) {
      console.error("Search Error:", err);
      msgDiv.textContent = "Error searching database.";
    }
  });
}