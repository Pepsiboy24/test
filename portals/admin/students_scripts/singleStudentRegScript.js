import { supabase } from '../../../core/config.js';

// Dedicated client to prevent session overwrites during registration
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
 * Full Registration Flow:
 * 1. Auth Signup for Student (with school_id metadata)
 * 2. Profile insertion into 'Students' table
 * 3. Conditional Auth Signup for Parent (if not already linked)
 * 4. Profile insertion into 'Parents' table
 * 5. Creation of Parent-Student junction record
 * 6. Invocation of Virtual Account Edge Function
 */
export async function registerNewStudent(
  fullName, email, password, dateOfBirth, admissionDate, profilePicUrl, classId, gender, parentInfo = null
) {
  try {
    // 1. IDENTITY GUARD: Fetch admin's school_id from session
    const { data: { user: adminUser }, error: adminError } = await supabase.auth.getUser();
    if (adminError || !adminUser) return { success: false, error: "Admin authentication required" };

    const schoolId = adminUser.user_metadata?.school_id;
    if (!schoolId) return { success: false, error: "Admin school identity not found." };

    // 2. DATA PREP: Defaults for credentials
    const studentEmail = email || `${fullName.toLowerCase().replace(/\s+/g, '.')}@ischool.com`;
    const studentPassword = password || '123456';

    // 3. STUDENT AUTH: Create account tagged with school metadata (RLS bypass)
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

    // 4. STUDENT PROFILE: Insert into public.Students table
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
        // Create Parent Auth (including school_id fixes 403 Forbidden errors)
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
          // Handle existing parent (e.g. Sibling already in school)
          if (pAuthError.message.includes("already registered")) {
            const { data: existing } = await supabase
              .from('Parents')
              .select('parent_id')
              .eq('email', parentInfo.parentEmail)
              .single();
            finalParentId = existing?.parent_id;
          } else throw pAuthError;
        } else {
          // Insert New Parent Profile record
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
            .select("parent_id").single();

          if (pInsertError) throw pInsertError;
          finalParentId = newParent.parent_id;
        }
      }

      // Link Parent to Student in junction table
      const { error: linkError } = await supabase
        .from("Parent_Student_Links")
        .insert([{
          parent_id: finalParentId,
          student_id: studentAuth.user.id,
          relationship: parentInfo.relationship || 'Guardian'
        }]);
      if (linkError) console.error("Link established error:", linkError.message);
    }

    // 6. VIRTUAL ACCOUNT: Invoke Monnify generation function
    try {
      await supabase.functions.invoke('create-student-virtual-account', {
        body: {
          studentId: studentAuth.user.id,
          studentName: fullName,
          schoolId: schoolId,
          parentEmail: parentInfo?.parentEmail || null
        }
      });
      console.log("Virtual account request dispatched.");
    } catch (vErr) {
      console.warn("Virtual account creation background failure:", vErr.message);
    }

    return { success: true };
  } catch (err) {
    console.error("Critical Registration Failure:", err.message);
    return { success: false, error: err.message };
  }
}