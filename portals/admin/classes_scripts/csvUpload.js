import { supabase as supabaseClient } from '../../../core/config.js';

// --- CSV Upload Functionality ---
// document.addEventListener('DOMContentLoaded', function() {
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const csvUpload = document.getElementById('csvUpload');
// console.log(uploadCsvBtn && csvUpload)

if (uploadCsvBtn && csvUpload) {
  uploadCsvBtn.addEventListener('click', () => {
    console.log("working")
    csvUpload.click();
  });

  csvUpload.addEventListener('change', handleCsvUpload);
}
// });

async function handleCsvUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    showToast('Please select a CSV file.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const csvText = e.target.result;
    const rows = csvText.split('\n').filter(row => row.trim() !== '');
    if (rows.length < 2) {
      showToast('CSV file must have at least a header row and one data row.', 'warning');
      return;
    }

    const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['class_name', 'section', 'teacher_name', 'students_count'];

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      showToast(`CSV is missing required columns: ${missingHeaders.join(", ")}`, "warning");
      return;
    }

    const classesData = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;

      const classData = {};
      headers.forEach((header, index) => {
        classData[header] = values[index];
      });

      // Validate required fields
      if (!classData.class_name || !classData.section || !classData.teacher_name || !classData.students_count) {
        console.warn(`Skipping row ${i + 1}: Missing required data`);
        continue;
      }

      classesData.push(classData);
    }

    if (classesData.length === 0) {
      showToast('No valid class data found in CSV.', 'warning');
      return;
    }

    // Process each class
    let successCount = 0;
    let errorCount = 0;

    for (const classData of classesData) {
      try {
        // Find teacher ID
        const { data: teachers, error: teacherError } = await supabaseClient
          .from('Teachers')
          .select('teacher_id')
          .ilike('first_name', classData.teacher_name)
          .limit(1);

        if (teacherError) throw teacherError;

        if (!teachers || teachers.length === 0) {
          console.error(`Teacher '${classData.teacher_name}' not found for class '${classData.class_name}'`);
          errorCount++;
          continue;
        }

        const teacherId = teachers[0].teacher_id;

        // Insert class
        const { error: insertError } = await supabaseClient
          .from('Classes')
          .insert([{
            class_name: classData.class_name,
            section: classData.section,
            teacher_id: teacherId,
            // students_count: parseInt(classData.students_count) || 0
          }]);

        if (insertError) throw insertError;

        successCount++;
      } catch (error) {
        console.error(`Error creating class '${classData.class_name}':`, error);
        errorCount++;
      }
    }

    // Reset file input
    event.target.value = '';

    // Show results
    if (successCount > 0) {
      showToast(`${successCount} class(es) created successfully!`, "success");
      // Re-render classes if renderClasses function is available
      if (typeof renderClasses === 'function') {
        renderClasses();
      }
    }

    if (errorCount > 0) {
      showToast(`${errorCount} class(es) failed to create. Check console for details.`, "error");
    }
  };

  reader.readAsText(file);
}
