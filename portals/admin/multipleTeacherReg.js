import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabase as supabaseClient } from '../../core/config.js';
import { waitForUser, lazyScript } from '/core/perf.js';

// --- 1. ISOLATED AUTH CLIENT ---
// This client is used ONLY for signUp. persistSession: false ensures
// it does not overwrite your Admin session in LocalStorage.
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

function excelSerialDateToISO(serial) {
  const EPOCH_DIFF = 25569;
  const msPerDay = 24 * 60 * 60 * 1000;
  const correctedSerial = serial > 60 ? serial - 1 : serial;
  const dateMilliseconds = (correctedSerial - EPOCH_DIFF) * msPerDay;
  const date = new Date(dateMilliseconds);
  return date.toISOString().split("T")[0];
}

function sanitizeValue(value) {
  const cleanedValue = String(value).trim();
  if (value === null || value === undefined || cleanedValue === "" || cleanedValue === "########") {
    return null;
  }
  const numValue = Number(value);
  if (!isNaN(numValue) && numValue > 10000 && numValue < 100000) {
    try {
      return excelSerialDateToISO(numValue);
    } catch (e) {
      return null;
    }
  }
  if (typeof value === "string" && /^\d{4}$/.test(cleanedValue)) {
    return parseInt(cleanedValue, 10);
  }
  return value;
}

export async function uploadAndProcessExcel(file) {
    // Lazy-load XLSX only when needed (saves ~1MB on initial page load)
    await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
  try {
    // Get Admin info from the MAIN client (Your persistent login)
    const adminUser = await waitForUser();

    if (adminError || !adminUser) {
      throw new Error("Admin authentication required");
    }

    const schoolId = adminUser.user_metadata?.school_id;
    if (!schoolId) {
      throw new Error("Admin school association not found");
    }

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const results = [];
    for (const row of jsonData) {
      const rawTeacherData = {
        first_name: row["First Name"] || row["first_name"] || row["FirstName"],
        last_name: row["Last Name"] || row["last_name"] || row["LastName"],
        email: row["Email"] || row["email"],
        date_of_birth: row["Date of Birth"] || row["date_of_birth"] || row["DOB"],
        gender: row["Gender"] || row["gender"],
        address: row["Address"] || row["address"],
        mobile_phone: row["Mobile Phone"] || row["mobile_phone"] || row["Phone"],
        start_date: row["Start Date"] || row["start_date"] || new Date().toISOString().split("T")[0],
        teaching_license: row["Teaching License"] || row["teaching_license"] || row["License"],
        // Add other fields as needed from your Excel mapping...
      };

      const teacherData = Object.fromEntries(
        Object.entries(rawTeacherData).map(([key, value]) => [key, sanitizeValue(value)])
      );

      if (!teacherData.first_name || !teacherData.email) continue;

      try {
        // --- STEP 2: SIGN UP USING THE ISOLATED authClient ---
        // This client will NOT trigger a session swap.
        const { data: authData, error: authError } = await authClient.auth.signUp({
          email: teacherData.email,
          password: "123456",
          options: {
            data: {
              user_type: 'teacher',
              school_id: schoolId
            }
          }
        });

        await new Promise(resolve => setTimeout(resolve, 800));

        if (authError) {
          results.push({ success: false, error: authError.message, data: teacherData });
          continue;
        }

        const teacherId = authData.user.id;

        // --- STEP 3: INSERT PROFILE USING MAIN supabaseClient ---
        // This works because the main client is still authenticated as Admin.
        const { error: teacherError } = await supabaseClient
          .from("Teachers")
          .insert([{
            teacher_id: teacherId,
            first_name: teacherData.first_name,
            last_name: teacherData.last_name,
            email: teacherData.email,
            phone_number: teacherData.mobile_phone,
            date_hired: teacherData.start_date,
            date_of_birth: teacherData.date_of_birth,
            address: teacherData.address,
            trcn_reg_number: teacherData.teaching_license,
            gender: teacherData.gender,
            school_id: schoolId,
          }]);

        if (teacherError) throw teacherError;

        results.push({ success: true, data: teacherData });
      } catch (err) {
        results.push({ success: false, error: err.message, data: teacherData });
      }
    }
    return results;
  } catch (error) {
    throw error;
  }
}