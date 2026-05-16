import { supabase as supabaseClient } from '../config.js';

function excelSerialDateToISO(serial) {
  const EPOCH_DIFF = 25569; // Difference between Excel epoch (Jan 1, 1900) and JS epoch (Jan 1, 1970) in days.
  const msPerDay = 24 * 60 * 60 * 1000;

  // Adjust for Excel's 1900 leap year bug (serial < 60 is irrelevant for modern dates)
  const correctedSerial = serial > 60 ? serial - 1 : serial;

  // Convert days to milliseconds since JS Epoch
  const dateMilliseconds = (correctedSerial - EPOCH_DIFF) * msPerDay;

  const date = new Date(dateMilliseconds);
  // Format as YYYY-MM-DD
  return date.toISOString().split("T")[0];
}

/**
 * Helper function to sanitize a value: returns null if the value is null, undefined,
 * an empty string, or the '########' error string. Converts Excel serial numbers to dates.
 */
function sanitizeValue(value) {
  const cleanedValue = String(value).trim();

  // 1. Handle common empty/error values
  if (
    value === null ||
    value === undefined ||
    cleanedValue === "" ||
    cleanedValue === "########"
  ) {
    return null;
  }

  // 2. Handle numeric Excel dates (40000+ is a safe range for serial dates)
  const numValue = Number(value);
  if (!isNaN(numValue) && numValue > 10000 && numValue < 100000) {
    try {
      return excelSerialDateToISO(numValue);
    } catch (e) {
      console.error("Failed to convert Excel serial date:", numValue, e);
      return null;
    }
  }

  // 3. Handle string years (e.g., for graduation_year)
  if (typeof value === "string" && /^\d{4}$/.test(cleanedValue)) {
    return parseInt(cleanedValue, 10);
  }

  // 4. Return original value for all other cases (including valid YYYY-MM-DD strings)
  return value;
}

// Function to handle Excel file upload and process teachers
export async function uploadAndProcessExcel(file) {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('Parsed Excel data:', jsonData);

    // Process each row and add to Supabase
    const results = [];
    for (const row of jsonData) {
      const rawTeacherData = {
        first_name: row["First Name"] || row["first_name"] || row["FirstName"],
        last_name: row["Last Name"] || row["last_name"] || row["LastName"],
        email: row["Email"] || row["email"],
        date_of_birth:
          row["Date of Birth"] || row["date_of_birth"] || row["DOB"],
        gender: row["Gender"] || row["gender"],
        address: row["Address"] || row["address"],
        mobile_phone:
          row["Mobile Phone"] || row["mobile_phone"] || row["Phone"],
        home_phone: row["Home Phone"] || row["home_phone"],
        emergency_contact_name:
          row["Emergency Contact Name"] || row["emergency_contact_name"],
        emergency_contact_relation:
          row["Emergency Contact Relation"] ||
          row["emergency_contact_relation"],
        emergency_contact_phone:
          row["Emergency Contact Phone"] || row["emergency_contact_phone"],
        highest_degree: row["Highest Degree"] || row["highest_degree"],
        degree_major:
          row["Degree Major"] || row["degree_major"] || row["Major"],
        institution: row["Institution"] || row["institution"] || row["School"],
        graduation_year: row["Graduation Year"] || row["graduation_year"],
        teaching_license:
          row["Teaching License"] || row["teaching_license"] || row["License"],
        license_expiry: row["License Expiry"] || row["license_expiry"],
        subjects: row["Subjects"] || row["subjects"],
        grade_levels: row["Grade Levels"] || row["grade_levels"],
        total_experience: row["Total Experience"] || row["total_experience"],
        previous_school: row["Previous School"] || row["previous_school"],
        previous_position: row["Previous Position"] || row["previous_position"],
        previous_duration: row["Previous Duration"] || row["previous_duration"],
        professional_development:
          row["Professional Development"] || row["professional_development"],
        start_date:
          row["Start Date"] ||
          row["start_date"] ||
          new Date().toISOString().split("T")[0],
        job_title: row["Job Title"] || row["job_title"],
        contract_type: row["Contract Type"] || row["contract_type"],
        salary: row["Salary"] || row["salary"],
        specialized_roles: row["Specialized Roles"] || row["specialized_roles"],
        work_authorization:
          row["Work Authorization"] || row["work_authorization"],
        background_check: row["Background Check"] || row["background_check"],
        references: row["References"] || row["references"],
        allergies: row["Allergies"] || row["allergies"],
        medical_conditions:
          row["Medical Conditions"] || row["medical_conditions"],
        medications: row["Medications"] || row["medications"],
      };

      const teacherData = Object.fromEntries(
        Object.entries(rawTeacherData).map(([key, value]) => [
          key,
          sanitizeValue(value),
        ])
      );
      // Validate required fields
      if (!teacherData.first_name || !teacherData.last_name || !teacherData.email) {
        console.error('Missing required fields for teacher:', teacherData);
        results.push({ success: false, error: 'Missing required fields', data: teacherData });
        continue;
      }

      // Generate a password (you might want to customize this)
      const password = "123456";

      try {
        // Sign up the user
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email: teacherData.email,
          password: password,
        });

        if (authError) {
          console.error("Error signing up teacher:", authError.message);
          results.push({ success: false, error: authError.message, data: teacherData });
          continue;
        }

        // Insert into main Teachers table
        const mainTeacherData = {
          first_name: teacherData.first_name,
          last_name: teacherData.last_name,
          email: teacherData.email,
          phone_number: teacherData.mobile_phone,
          date_hired: teacherData.start_date,
          date_of_birth: teacherData.date_of_birth,
          address: teacherData.address,
          trcn_reg_number: teacherData.teaching_license || null,
          gender: teacherData.gender,
        };

        const { data: teacherInsert, error: teacherError } = await supabaseClient
          .from("Teachers")
          .insert([mainTeacherData])
          .select();

        if (teacherError) {
          console.error("Error inserting teacher:", teacherError.message);
          results.push({ success: false, error: teacherError.message, data: teacherData });
          continue;
        }

        const teacherId = teacherInsert[0].id;

        // Insert into qualifications table
        if (teacherData.highest_degree || teacherData.institution) {
          const qualData = {
            teacher_id: teacherId,
            school_name: teacherData.institution,
            certificate_name: teacherData.highest_degree,
            feild_of_study: teacherData.degree_major,
            graduation_year: teacherData.graduation_year,
          };

          const { error: qualError } = await supabaseClient
            .from("qualifications")
            .insert([qualData]);

          if (qualError) {
            console.error("Error inserting qualifications:", qualError.message);
            // Continue processing other tables
          }
        }

        // Insert into work_experience table
        if (teacherData.total_experience) {
          const expData = {
            teacher_id: teacherId,
            total_experience: teacherData.total_experience,
            school_name: teacherData.previous_school || null,
            position_held: teacherData.previous_position || null,
            duration: teacherData.previous_duration || null,
            professional_development: teacherData.professional_development || null,
          };

          const { error: expError } = await supabaseClient
            .from("work_experience")
            .insert([expData]);

          if (expError) {
            console.error("Error inserting work experience:", expError.message);
            // Continue processing other tables
          }
        }

        // Insert into school_employment table
        if (teacherData.start_date || teacherData.job_title) {
          const empData = {
            teacher_id: teacherId,
            start_date: teacherData.start_date,
            job_title: teacherData.job_title,
            contract_type: teacherData.contract_type,
            salary: teacherData.salary || null,
          };

          const { error: empError } = await supabaseClient
            .from("school_employment")
            .insert([empData]);

          if (empError) {
            console.error("Error inserting employment:", empError.message);
            // Continue processing other tables
          }
        }

        // Insert into emergency_contact table
        if (teacherData.emergency_contact_name) {
          const emcData = {
            teacher_id: teacherId,
            name: teacherData.emergency_contact_name,
            relationship: teacherData.emergency_contact_relation,
            phone_number: teacherData.emergency_contact_phone,
          };

          const { error: emcError } = await supabaseClient
            .from("emergency_contact")
            .insert([emcData]);

          if (emcError) {
            console.error("Error inserting emergency contact:", emcError.message);
            // Continue processing other tables
          }
        }

        results.push({ success: true, data: teacherData });
      } catch (err) {
        console.error("An unexpected error occurred:", err.message);
        results.push({ success: false, error: err.message, data: teacherData });
      }
    }

    return results;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw error;
  }
}

// Function to generate a random password
function generatePassword() {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Function to create drag and drop area
export function createDragDropArea() {
  const dragDropArea = document.createElement('div');
  dragDropArea.id = 'dragDropArea';
  dragDropArea.innerHTML = `
    <div class="drag-drop-content">
      <div class="drag-drop-icon">
        <svg width="48" height="48" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>
      <h3>Drag & Drop Excel File</h3>
      <p>or <span class="file-link">browse files</span></p>
      <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="display: none;">
    </div>
  `;

  // Add drag and drop event listeners
  dragDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropArea.classList.add('drag-over');
  });

  dragDropArea.addEventListener('dragleave', () => {
    dragDropArea.classList.remove('drag-over');
  });

  dragDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  // Add click to browse
  const fileLink = dragDropArea.querySelector('.file-link');
  const fileInput = dragDropArea.querySelector('#excelFileInput');

  fileLink.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  return dragDropArea;
}

// Function to handle file upload
async function handleFileUpload(file) {
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    showToast('Please select a valid Excel file (.xlsx or .xls)', 'warning');
    return;
  }

  try {
    const results = await uploadAndProcessExcel(file);
    displayResults(results);
  } catch (error) {
    showToast('Error processing file: ' + error.message, 'error');
  }
}

// Function to display results
function displayResults(results) {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  let message = `Upload completed!\n\nSuccessful: ${successCount}\nFailed: ${failureCount}`;

  if (failureCount > 0) {
    message += '\n\nFailed entries:';
    results.filter(r => !r.success).forEach((result, index) => {
      message += `\n${index + 1}. ${result.data.first_name} ${result.data.last_name || ''}: ${result.error}`;
    });
  }

  showToast(message, "info");
}
