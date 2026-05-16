import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

// Dedicated client for background signups (prevents Admin session logout)
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
const authClient = createClient(
  "https://dzotwozhcxzkxtunmqth.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

/**
 * registerNewStudent
 * -------------------
 * Logic:
 * 1. Validates Admin identity.
 * 2. Creates Student Auth & Profile.
 * 3. Handles Parent creation (or retrieves existing parent for siblings).
 * 4. Links Parent to Student.
 * 5. Triggers Monnify Virtual Account creation.
 */
export async function registerNewStudent(
  fullName, email, password, dateOfBirth, admissionDate, profilePicUrl, classId, gender, parentInfo = null
) {
  try {
    // 1. IDENTITY GUARD: Fetch admin's school_id
    const adminUser = await waitForUser();
    if (adminError || !adminUser) return { success: false, error: "Admin authentication required" };

    const schoolId = adminUser.user_metadata?.school_id;
    if (!schoolId) return { success: false, error: "Admin school identity missing." };

    // 2. DATA PREP: Handle optional emails and default passwords
    const studentEmail = email || `${fullName.toLowerCase().replace(/\s+/g, '.')}@ischool.com`;
    const studentPassword = password || '123456';

    // 3. STUDENT AUTH: Tag with school_id for RLS policy compliance
    const { data: studentAuth, error: authError } = await authClient.auth.signUp({
      email: studentEmail,
      password: studentPassword,
      options: {
        data: {
          user_type: 'student',
          school_id: schoolId
        }
      }
    });
    if (authError) throw authError;

    // 4. STUDENT PROFILE: Insert into Students table
    const { error: studentInsertError } = await supabase
      .from("Students")
      .insert([{
        student_id: studentAuth.user.id,
        full_name: fullName,
        date_of_birth: dateOfBirth,
        gender: gender,
        admission_date: admissionDate,
        profile_picture: profilePicUrl,
        class_id: classId,
        school_id: schoolId,
        enrollment_status: 'active'
      }]);
    if (studentInsertError) throw studentInsertError;

    // 5. PARENT WORKFLOW
    if (parentInfo) {
      let finalParentId = parentInfo.linkedParentId;

      if (!finalParentId) {
        // Create Parent Auth (Fixes 403 Forbidden via school_id metadata)
        const { data: parentAuth, error: pAuthError } = await authClient.auth.signUp({
          email: parentInfo.parentEmail,
          password: '123456',
          options: {
            data: {
              user_type: 'parent',
              school_id: schoolId
            }
          }
        });

        if (pAuthError) {
          // Handle Siblings: If email exists, find the existing profile
          if (pAuthError.message.includes("already registered") || pAuthError.status === 422) {
            const { data: existingParent } = await supabase
              .from('Parents')
              .select('parent_id')
              .eq('email', parentInfo.parentEmail)
              .single();

            if (existingParent) {
              finalParentId = existingParent.parent_id;
            } else {
              throw new Error("Parent email exists but profile could not be found.");
            }
          } else throw pAuthError;
        } else {
          // New Parent Profile insertion (Authorized by the SQL Policy we created)
          const { data: newParent, error: pInsertError } = await supabase
            .from("Parents")
            .insert([{
              user_id: parentAuth.user.id,
              full_name: parentInfo.parentFullName,
              email: parentInfo.parentEmail,
              phone_number: parentInfo.parentPhone,
              address: parentInfo.parentAddress || null,
              school_id: schoolId
            }])
            .select("parent_id")
            .single();

          if (pInsertError) throw pInsertError;
          finalParentId = newParent.parent_id;
        }
      }

      // Junction Link: Connect Parent to the new Student
      const { error: linkError } = await supabase
        .from("Parent_Student_Links")
        .insert([{
          parent_id: finalParentId,
          student_id: studentAuth.user.id,
          relationship: parentInfo.relationship || 'Guardian'
        }]);

      if (linkError) console.warn("Link established error (Student still created):", linkError.message);
    }

    // 6. VIRTUAL ACCOUNT: Invoke Monnify generation (non-blocking)
    try {
      await supabase.functions.invoke('create-student-virtual-account', {
        body: {
          studentId: studentAuth.user.id,
          studentName: fullName,
          schoolId: schoolId,
          parentEmail: parentInfo?.parentEmail || null
        }
      });
    } catch (vErr) {
      console.warn("Virtual account request failure:", vErr.message);
    }

    return { success: true };

  } catch (err) {
    console.error("CRITICAL REGISTRATION FAILURE:", err.message);
    return { success: false, error: err.message };
  }
}