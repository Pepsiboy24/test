import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

// Register new teacher function
export async function registerNewTeacher(formData) {
  try {
    // Get current authenticated user (school admin)
    const adminUser = await waitForUser();
    
    if (adminError || !adminUser) {
      console.error("Error getting authenticated admin:", adminError?.message);
      return { success: false, error: "Admin authentication required" };
    }

    // Get admin's school_id from School_Admin table
    console.log("🔍 Looking up admin data for email:", adminUser.email);
    const { data: adminData, error: adminDataError } = await supabase
      .from('School_Admin')
      .select('school_id')
      .eq('email', adminUser.email)
      .single();

    console.log("📊 Admin query result:", { adminData, adminDataError });
    
    if (adminDataError || !adminData?.school_id) {
      console.error("❌ Error getting admin school data:", adminDataError?.message);
      return { success: false, error: "Admin school association not found" };
    }

    console.log("✅ Admin school_id found:", adminData?.school_id);

    // Step 1: Create auth user for the teacher
    const { data: { user }, error: authError } = await supabase.auth.signUp({
      email: formData.personalEmail,
      password: '123456', // Hardcoded default password
      options: {
        data: {
          user_type: 'teacher',
          school_id: adminData.school_id
        }
      }
    });

    if (authError) {
      console.error("Error creating teacher auth user:", authError.message);
      return { success: false, error: `Failed to create teacher account: ${authError.message}` };
    }

    if (!user || !user.id) {
      return { success: false, error: "Failed to create teacher auth user - no user ID returned" };
    }

    // Use the auth user ID as teacher_id
    const teacherId = user.id;
    console.log("✅ Teacher auth user created with ID:", teacherId);

    // Validate and format dates
    let dateHired = null;
    let dateOfBirth = null;
    
    // Handle start date
    if (formData.startDate && formData.startDate.trim() !== '') {
      const startDate = new Date(formData.startDate);
      if (!isNaN(startDate.getTime())) {
        dateHired = startDate.toISOString().split('T')[0];
      }
    }
    
    // Handle date of birth
    if (formData.dateOfBirth && formData.dateOfBirth.trim() !== '') {
      const dobDate = new Date(formData.dateOfBirth);
      if (!isNaN(dobDate.getTime())) {
        dateOfBirth = dobDate.toISOString().split('T')[0];
      }
    }
    
    // Check if dates are valid and required
    if (!dateHired && formData.startDate && formData.startDate.trim() !== '') {
      return { success: false, error: "Invalid start date format. Please use YYYY-MM-DD format." };
    }
    
    if (!dateOfBirth && formData.dateOfBirth && formData.dateOfBirth.trim() !== '') {
      return { success: false, error: "Invalid date of birth format. Please use YYYY-MM-DD format." };
    }
    
    // Log the processed dates for debugging
    console.log('Processed dates:', { 
      originalStartDate: formData.startDate, 
      processedDateHired: dateHired,
      originalDateOfBirth: formData.dateOfBirth, 
      processedDateOfBirth: dateOfBirth 
    });

    // Insert into main Teachers table with school_id
    const teacherData = {
      teacher_id: teacherId, // Use auth user ID
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.personalEmail,
      phone_number: formData.mobilePhone,
      date_hired: dateHired,
      date_of_birth: dateOfBirth,
      address: formData.address,
      trcn_reg_number: formData.teachingLicense || null,
      gender: formData.gender,
      school_id: adminData.school_id, // CRITICAL: Add school_id for RLS compliance
    };
    
    console.log("📝 Inserting teacher data with RLS compliance:", teacherData);

    const { data: teacherInsert, error: teacherError } = await supabaseClient
      .from("Teachers")
      .insert([teacherData])
      .select();

    if (teacherError) {
      console.error("❌ Error inserting teacher:", teacherError.message);
      return { success: false, error: teacherError.message };
    }

    const teacherRecord = teacherInsert[0];
    console.log("✅ Teacher record created successfully:", teacherRecord);

    // Insert into Teacher_Qualifications
    const qualData = {
      teacher_id: teacherId,
      school_name: formData.institution,
      certificate_name: formData.highestDegree,
      feild_of_study: formData.degreeMajor,
      graduation_year: formData.graduationYear,
    };

    const { error: qualError } = await supabaseClient
      .from("qualifications")
      .insert([qualData]);

    if (qualError) {
      console.error("Error inserting qualifications:", qualError.message);
      // Don't return error here, teacher was created successfully
    }

    return { 
      success: true, 
      teacherId: teacherId,
      teacherData: teacherRecord 
    };

  } catch (error) {
    console.error("Unexpected error in registerNewTeacher:", error);
    return { success: false, error: error.message };
  }
}
