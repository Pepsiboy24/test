import { supabaseClient } from './supabase_client.js';
// const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// Register new teacher function
export async function registerNewTeacher(formData) {
  try {
    // Assuming teachers might need auth, but for now, just insert into tables
    // If auth is needed, uncomment and adapt the auth part

    const { data: { user }, error: authError } = await supabaseClient.auth.signUp({
      email: formData.personalEmail,
      password: "123456",
    });
    if (authError) {
      console.error("Error signing up teacher:", authError.message);
      return false;
    }

    // Insert into main Teachers table
    const teacherData = {
      teacher_id: user.id,
      first_name: formData.firstName,
      email: formData.personalEmail,
      phone_number: formData.mobilePhone, //this is suppose to be phone_number
      // we'll have to remove the date_hired field
      date_hired: formData.startDate, // Fixed: use startDate instead of hireDate
      last_name: formData.lastName,
      date_of_birth: formData.dateOfBirth,
      address: formData.address,
      //we'll have to add a marital status field
      trcn_reg_number: formData.teachingLicense || null,
      // we'll have to add a teachers license num expiration field
      gender: formData.gender,
    };
    console.log(teacherData);

    const { data: teacherInsert, error: teacherError } = await supabaseClient
      .from("Teachers")
      .insert([teacherData])
      .select();

    if (teacherError) {
      console.error("Error inserting teacher:", teacherError.message);
      return false;
    }

    const teacherId = teacherInsert[0].teacher_id; // Primary key is teacher_id

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
      return false;
    }

    // Insert into Teacher_Experience
    //we have to restructure the entire work experience table or change the front end input's
    const expData = {
      teacher_id: teacherId,
      total_experience: formData.totalExperience,
      school_name: formData.previousSchool || null,
      position_held: formData.previousPosition || null,
      duration: formData.previousDuration || null,
      professional_development: formData.professionalDevelopment || null,
    };

    const { error: expError } = await supabaseClient
      .from("work_experience")
      .insert([expData]);

    if (expError) {
      console.error("Error inserting experience:", expError.message);
      return false;
    }

    // Insert into Teacher_Employment
    const empData = {
      teacher_id: teacherId,
      start_date: formData.startDate,
      job_title: formData.jobTitle,
      contract_type: formData.contractType,
      salary: formData.salary || null,
      // specialized_roles: formData.specializedRoles || [], // Array
    };

    const { error: empError } = await supabaseClient
      .from("school_employment")
      .insert([empData]);

    if (empError) {
      console.error("Error inserting employment:", empError.message);
      return false;
    }

    // Insert into emergency contacts
    const emcData = {
      teacher_id: teacherId,
      name: formData.emergencyContactName,
      relationship: formData.emergencyContactRelation, // Fixed: use emergencyContactRelation
      phone_number: formData.emergencyContactPhone,
      // address: formData.,
      // specialized_roles: formData.specializedRoles || [], // Array
    };

    const { error: emcError } = await supabaseClient
      .from("emergency_contact")
      .insert([emcData]);

    if (emcError) {
      console.error("Error inserting emergency contact:", emcError.message);
      return false;
    }

    // Insert into Teacher_Background
    // we'll have to add a teachers background field
    // const bgData = {
    //   teacher_id: teacherId,
    //   work_authorization: formData.workAuthorization,
    //   background_check: formData.backgroundCheck || null,
    //   references: formData.references || null,
    //   allergies: formData.allergies || null,
    //   medical_conditions: formData.medicalConditions || null,
    //   medications: formData.medications || null,
    // };

    // const { error: bgError } = await supabaseClient
    //   .from("Teacher_Background")
    //   .insert([bgData]);

    // if (bgError) {
    //   console.error("Error inserting background:", bgError.message);
    //   return false;
    // }

    console.log("Teacher registered successfully.");
    return true;
  } catch (err) {
    console.error("An unexpected error occurred:", err.message);
    return false;
  }
}
