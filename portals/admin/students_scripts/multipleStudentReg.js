import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabase } from '../../../core/config.js'; // Your main Admin client
import { waitForUser, lazyScript } from '/core/perf.js';

/**
 * 1. ISOLATED AUTH CLIENT
 * This client is created with persistSession: false.
 * It is used ONLY for the signUp calls so it doesn't log you out.
 */
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// --- Global Cache ---
let _allClassesCache = null;
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * 2. MAIN PROCESSING FUNCTION
 */
export async function uploadAndProcessExcel(file) {
    // Lazy-load XLSX only when needed (saves ~1MB on initial page load)
    await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
  try {
    // Get Admin school_id from the MAIN client (Your persistent login)
    const adminUser = await waitForUser();

    if (adminError || !adminUser) {
      return [{ success: false, error: "Admin session expired. Please log in again." }];
    }

    const schoolId = adminUser.user_metadata?.school_id;
    if (!schoolId) return [{ success: false, error: "School ID not found in Admin metadata." }];

    // Read Excel
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const results = [];

    for (const row of jsonData) {
      // 800ms delay to keep Supabase Auth happy
      await delay(800);

      const studentData = {
        full_name: row['Full Name'] || row['full_name'] || row['Name'],
        email: row['Email'] || row['email'],
        date_of_birth: row['Date of Birth'] || row['date_of_birth'] || row['DOB'],
        gender: row['Gender'] || row['gender'],
        admission_date: row['Admission Date'] || row['admission_date'] || new Date().toISOString().split('T')[0],
        class_input: row['Classes'] || row['classes'] || row['Class'],
        parent_name: row['Parent Name'] || row['parent_name'],
        parent_phone: row['Parent Phone'] || row['parent_phone']
      };

      if (!studentData.full_name || !studentData.email) continue;

      try {
        const class_id = await getExistingClassId(studentData.class_input);

        // --- STEP A: SIGN UP (Using Isolated authClient) ---
        // This will NOT update LocalStorage or cookies.
        const { data: authData, error: authError } = await authClient.auth.signUp({
          email: studentData.email,
          password: "123456", // Default password
          options: {
            data: {
              role: 'student',
              school_id: schoolId
            }
          }
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            results.push({ success: false, error: 'Email exists', skipped: true, data: studentData });
            continue;
          }
          throw authError;
        }

        // --- STEP B: INSERT PROFILE (Using Main supabase client) ---
        // 'supabase' is still authenticated as the Admin.
        const { error: insertError } = await supabase
          .from("Students")
          .insert([{
            student_id: authData.user.id,
            full_name: studentData.full_name,
            gender: studentData.gender,
            date_of_birth: formatExcelDate(studentData.date_of_birth),
            admission_date: formatExcelDate(studentData.admission_date),
            school_id: schoolId,
            class_id: class_id,
            profile_picture: "https://placehold.co/150x150?text=Profile"
          }]);

        if (insertError) throw insertError;

        console.log(`✅ Success: ${studentData.email}`);
        results.push({ success: true, data: studentData });

      } catch (err) {
        console.error("Row Error:", err.message);
        results.push({ success: false, error: err.message, data: studentData });
      }
    }
    return results;
  } catch (error) {
    console.error('Fatal Upload Error:', error);
    throw error;
  }
}

/**
 * 3. HELPERS
 */
async function getExistingClassId(rawString) {
  if (!rawString) return null;
  if (!_allClassesCache) {
    const { data } = await supabase.from('Classes').select('class_id, class_name, section');
    _allClassesCache = data || [];
  }
  const inputClean = rawString.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = _allClassesCache.find(c => {
    const dbFull = (c.class_name + (c.section || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return dbFull === inputClean;
  });
  return match ? match.class_id : null;
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