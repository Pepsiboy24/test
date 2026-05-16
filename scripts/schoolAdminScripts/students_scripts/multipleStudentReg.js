// multipleStudentReg.js
import { supabaseClient } from './supabase_client.js';


// --- Global Cache for Classes (Prevents constant DB lookups) ---
let _allClassesCache = null;

// --- Helper: Delay to prevent Rate Limiting ---
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// --- 1. Excel Processing Logic ---

export async function uploadAndProcessExcel(file) {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const results = [];

    // Loop through rows
    for (const row of jsonData) {
      // Add Delay to stop 429 Errors
      await delay(1500);

      const studentData = {
        full_name: row['Full Name'] || row['full_name'] || row['Name'],
        email: row['Email'] || row['email'],
        date_of_birth: row['Date of Birth'] || row['date_of_birth'] || row['DOB'],
        gender: row['Gender'] || row['gender'],
        admission_date: row['Admission Date'] || row['admission_date'] || new Date().toISOString().split('T')[0],
        profile_picture: "https://placehold.co/150x150/e8e8e8/363636?text=Profile",
        class_input: row['Classes'] || row['classes'] || row['Class'],
        parent_name: row['Parent Name'] || row['parent_name'] || row['Parent Full Name'] || row['Parent'],
        parent_email: row['Parent Email'] || row['parent_email'],
        parent_phone: row['Parent Phone'] || row['parent_phone'] || row['Parent Phone Number'],
        relationship: row['Relationship'] || row['relationship'] || 'Guardian'
      };

      if (!studentData.full_name || !studentData.email) {
        results.push({ success: false, error: 'Missing Name or Email', data: studentData });
        continue;
      }

      const password = generatePassword();
      let class_id = null;

      try {
        // Handle Class/Section lookup using the NEW Robust Function
        if (studentData.class_input) {
          class_id = await getExistingClassId(studentData.class_input);
        }

        // 1. Create Auth User
        const {
          data: { user },
          error: authError,
        } = await supabaseClient.auth.signUp({
          email: studentData.email,
          password: password,
        });

        if (authError) {
          // Check if email already exists and skip with logging
          if (authError.message.includes('already registered') ||
            authError.message.includes('User already registered') ||
            authError.message.includes('duplicate')) {
            console.log(`Skip: Email already exists - ${studentData.email}`);
            results.push({
              success: false,
              error: 'Skip: Email already exists',
              data: studentData,
              skipped: true
            });
            continue;
          }
          throw new Error("Auth: " + authError.message);
        }

        // 2. Insert Profile into 'Students' Table
        const { error: insertError } = await supabaseClient
          .from("Students")
          .insert([
            {
              student_id: user.id,
              full_name: studentData.full_name,
              date_of_birth: formatExcelDate(studentData.date_of_birth),
              gender: studentData.gender,
              admission_date: formatExcelDate(studentData.admission_date),
              profile_picture: studentData.profile_picture,
              class_id: class_id // Will be null if class not found
            },
          ]);

        if (insertError) throw new Error("DB: " + insertError.message);

        // --- STEP B & C: Parent Auth & Link ---
        if (studentData.parent_name && studentData.parent_phone) {
          let finalParentId = null;

          // Look up existing parent by phone
          const { data: existingParent, error: lookupError } = await supabaseClient
            .from("Parents")
            .select("parent_id")
            .eq("phone_number", studentData.parent_phone)
            .maybeSingle();

          if (existingParent && !lookupError) {
            finalParentId = existingParent.parent_id;
          } else {
            // Need to create new parent
            // If they didn't provide an email, auto-generate one to satisfy auth requirement
            const pEmail = studentData.parent_email || `parent_${studentData.parent_phone}@eduhub.com`;

            const { data: { user: parentUser }, error: parentAuthError } = await supabaseClient.auth.signUp({
              email: pEmail,
              password: '123456',
            });

            if (parentAuthError) {
              // If email exists, we might need a fallback or log it. Proceeding with caution.
              if (!parentAuthError.message.includes('already registered')) {
                throw new Error("Parent Auth: " + parentAuthError.message);
              }
              console.warn(`Parent email ${pEmail} already registered, could not create parent auth.`);
            }

            const authUserId = parentUser ? parentUser.id : null;

            const { data: newParentData, error: parentInsertError } = await supabaseClient
              .from("Parents")
              .insert([
                {
                  user_id: authUserId,
                  full_name: studentData.parent_name,
                  email: pEmail,
                  phone_number: studentData.parent_phone,
                  address: studentData.parent_address || null,
                  occupation: studentData.parent_occupation || null
                }
              ])
              .select("parent_id")
              .single();

            if (parentInsertError) throw new Error("Parent DB: " + parentInsertError.message);
            finalParentId = newParentData.parent_id;
          }

          // Establish Link
          if (finalParentId) {
            const { error: linkError } = await supabaseClient
              .from("Parent_Student_Links")
              .insert([
                {
                  parent_id: finalParentId,
                  student_id: user.id,
                  relationship: studentData.relationship
                }
              ]);
            if (linkError) throw new Error("Link DB: " + linkError.message);
          }
        }

        console.log(`✅ Successfully registered: ${studentData.email} (ID: ${user.id})`);
        results.push({ success: true, data: studentData, userId: user.id });

      } catch (err) {
        console.error("Row Error:", err.message);
        results.push({ success: false, error: err.message, data: studentData });
      }
    }
    return results;
  } catch (error) {
    console.error('File Error:', error);
    throw error;
  }
}

// --- 2. Helper Functions ---

/**
 * THE ULTIMATE FIX: Fetch & Match
 * Fetches all classes once, strips spaces, and finds the matching ID.
 */
async function getExistingClassId(rawString) {
  if (!rawString) return null;

  // 1. Load Cache if empty (Only happens once per file upload)
  if (!_allClassesCache) {
    console.log("🔄 Fetching all classes from DB...");
    const { data, error } = await supabaseClient
      .from('Classes')
      .select('class_id, class_name, section');

    if (error) {
      console.error("DB Error fetching classes:", error.message);
      return null;
    }
    _allClassesCache = data;
  }

  // 2. Normalize Input: "JSS 1 - A" -> "JSS1A"
  // Removes all spaces, hyphens, and makes uppercase
  const inputClean = rawString.toUpperCase().replace(/[^A-Z0-9]/g, '');

  console.log(`🔎 Searching match for: "${rawString}" (Normalized: ${inputClean})`);

  // 3. Find Match in Cache
  const match = _allClassesCache.find(dbClass => {
    // Normalize DB Data: "JSS 1" + "A" -> "JSS1A"
    const dbName = (dbClass.class_name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const dbSection = (dbClass.section || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Compare
    return (dbName + dbSection) === inputClean;
  });

  if (match) {
    console.log(`✅ MATCH FOUND! Class: "${match.class_name} ${match.section}" (ID: ${match.class_id})`);
    return match.class_id;
  } else {
    console.warn(`❌ No match found for "${rawString}". Check your spellings.`);
    return null;
  }
}

function generatePassword() {
  return Math.random().toString(36).slice(-10) + "!";
}

function formatExcelDate(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string' && dateVal.includes('-')) return dateVal;
  if (!isNaN(dateVal)) {
    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  return dateVal;
}

function displayResults(results) {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success && !r.skipped).length;
  const skippedCount = results.filter(r => r.skipped).length;

  let message = `Process Complete!\n✅ Successfully Registered: ${successCount}\n`;
  if (skippedCount > 0) {
    message += `⏭️ Skipped (Email Exists): ${skippedCount}\n`;
  }
  if (failureCount > 0) {
    message += `❌ Failed: ${failureCount}`;
  }

  // Log skipped emails for admin reference
  const skippedStudents = results.filter(r => r.skipped);
  if (skippedStudents.length > 0) {
    console.log('=== SKIPPED STUDENTS (Email Already Exists) ===');
    skippedStudents.forEach(student => {
      console.log(`- ${student.data.email} (${student.data.full_name})`);
    });
  }

  showToast(message, 'info');
  document.querySelector('.upload-modal')?.remove();

  if (typeof window.refreshStudentList === 'function') {
    console.log("🔄 Refreshing student table...");
    window.refreshStudentList();
  }
}

// --- 3. UI Generation ---

export function createDragDropArea() {
  const container = document.createElement('div');
  container.className = 'drag-drop-container';
  container.innerHTML = `
    <div class="drag-drop-box" id="dropZone" style="border: 2px dashed #ccc; padding: 20px; text-align: center; cursor: pointer;">
      <i class="fa-solid fa-cloud-arrow-up"></i>
      <h3>Drag & Drop Excel File</h3>
      <p>Supported: .xlsx, .xls, .csv</p>
      <button type="button" class="btn-browse">Browse Files</button>
      <input type="file" id="excelFileInput" accept=".xlsx,.xls,.csv" style="display: none;">
      <div id="uploadStatus"></div>
    </div>
  `;

  const dropZone = container.querySelector('#dropZone');
  const fileInput = container.querySelector('#excelFileInput');
  const statusDiv = container.querySelector('#uploadStatus');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0], statusDiv));

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#f0f0f0'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.background = 'transparent'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0], statusDiv);
  });

  return container;
}

async function handleFile(file, statusDiv) {
  statusDiv.innerHTML = "Processing... (This may take a moment per student)";
  try {
    const results = await uploadAndProcessExcel(file);
    displayResults(results);
  } catch (error) {
    statusDiv.innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
  }
}