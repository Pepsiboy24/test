// supabase-timetable.js - Handles Supabase data fetching for timetable

// Mock data for testing
const mockTimetableData = [
    { day_of_week: 'Mon', start_time: '08:00:00', room_number: '101', Subjects: { code: 'MTH' } },
    { day_of_week: 'Tue', start_time: '08:00:00', room_number: 'Lab 1', Subjects: { code: 'PHY' } },
    { day_of_week: 'Wed', start_time: '08:00:00', room_number: '102', Subjects: { code: 'ENG' } },
    { day_of_week: 'Thu', start_time: '08:00:00', room_number: '101', Subjects: { code: 'MTH' } },
    { day_of_week: 'Fri', start_time: '08:00:00', room_number: 'Art Rm', Subjects: { code: 'ART' } },
    { day_of_week: 'Mon', start_time: '08:40:00', room_number: '102', Subjects: { code: 'ENG' } },
    { day_of_week: 'Tue', start_time: '09:20:00', room_number: '103', Subjects: { code: 'HIS' } },
    { day_of_week: 'Wed', start_time: '09:20:00', room_number: 'Comp Lab', Subjects: { code: 'ICT' } },
    { day_of_week: 'Thu', start_time: '09:20:00', room_number: '102', Subjects: { code: 'ENG' } },
    { day_of_week: 'Mon', start_time: '10:30:00', room_number: '201', Subjects: { code: 'ALG' } },
    { day_of_week: 'Tue', start_time: '10:30:00', room_number: '202', Subjects: { code: 'GEO' } },
    { day_of_week: 'Wed', start_time: '10:30:00', room_number: '201', Subjects: { code: 'STAT' } },
    { day_of_week: 'Thu', start_time: '10:30:00', room_number: '201', Subjects: { code: 'ALG' } },
    { day_of_week: 'Fri', start_time: '10:30:00', room_number: '201', Subjects: { code: 'STAT' } }
];

async function fetchTimetableEntries() {
    // Using mock data for now
    return mockTimetableData;

    // Uncomment below for real fetch when database is ready

    try {
        const { data: entries, error } = await window.supabase
            .from('timetable_entries')
            .select('*, Subjects(code, name)');

        if (error) {
            console.error('Error fetching timetable entries:', error);
            return [];
        }

        return entries || [];
    } catch (err) {
        console.error('Unexpected error fetching timetable entries:', err);
        return [];
    }

}

// Fetch list of subjects
async function fetchSubjectsList() {
    // Using mock data for now
    return [
        { id: 1, name: 'Mathematics' },
        { id: 2, name: 'English' },
        { id: 3, name: 'Science' },
        { id: 4, name: 'History' },
        { id: 5, name: 'Art' },
        { id: 6, name: 'ICT' },
        { id: 7, name: 'Algebra' },
        { id: 8, name: 'Geometry' },
        { id: 9, name: 'Statistics' }
    ];

    // Uncomment below for real fetch when database is ready
    /*
    try {
        const { data: subjects, error } = await window.supabase
            .from('subjects')
            .select('id, name');

        if (error) {
            console.error('Error fetching subjects:', error);
            return [];
        }

        return subjects || [];
    } catch (err) {
        console.error('Unexpected error fetching subjects:', err);
        return [];
    }
    */
}

// Fetch list of teachers
async function fetchTeachersList() {
    // Using mock data for now
    return [
        { id: 1, name: 'Mr. Smith' },
        { id: 2, name: 'Ms. Johnson' },
        { id: 3, name: 'Dr. Brown' },
        { id: 4, name: 'Mrs. Davis' },
        { id: 5, name: 'Mr. Wilson' }
    ];

    // Uncomment below for real fetch when database is ready
    /*
    try {
        const { data: teachers, error } = await window.supabase
            .from('teachers')
            .select('id, name');

        if (error) {
            console.error('Error fetching teachers:', error);
            return [];
        }

        return teachers || [];
    } catch (err) {
        console.error('Unexpected error fetching teachers:', err);
        return [];
    }
    */
}

// Assign a class to the timetable
async function assignClass(entryData) {
    try {
        const { data, error } = await window.supabase
            .from('timetable_entries')
            .insert([entryData]);

        if (error) {
            console.error('Error assigning class:', error);
            showToast('Failed to assign class. Please try again.', 'error');
            return false;
        }

        console.log('Class assigned successfully:', data);
        return true;
    } catch (err) {
        console.error('Unexpected error assigning class:', err);
        showToast('An unexpected error occurred. Please try again.', 'error');
        return false;
    }
}

// Fetch list of classes
async function fetchClassesList() {
    // Using mock data for now
    return [
        { id: 1, name: 'JSS1' },
        { id: 2, name: 'Year 1 Math Stream' },
        { id: 3, name: 'JSS2' },
        { id: 4, name: 'JSS3' }
    ];

    // Uncomment below for real fetch when database is ready
    /*
    try {
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('id, class_name');

        if (error) {
            console.error('Error fetching classes:', error);
            return [];
        }

        return classes || [];
    } catch (err) {
        console.error('Unexpected error fetching classes:', err);
        return [];
    }
    */
}

// Preload form options for the create timetable modal
async function preloadFormOptions() {
    const [classes, subjects, teachers] = await Promise.all([
        fetchClassesList(),
        fetchSubjectsList(),
        fetchTeachersList()
    ]);

    const classSelect = document.getElementById('classSelect');
    const subjectSelectCreate = document.getElementById('subjectSelectCreate');
    const teacherSelectCreate = document.getElementById('teacherSelectCreate');

    // Populate classes
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.name;
        classSelect.appendChild(option);
    });

    // Populate subjects
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        subjectSelectCreate.appendChild(option);
    });

    // Populate teachers
    teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = teacher.name;
        teacherSelectCreate.appendChild(option);
    });
}

// Handle create timetable form submission
async function handleCreateTimetable(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const entryData = {
        class_id: parseInt(formData.get('classSelect')),
        subject_id: parseInt(formData.get('subjectSelectCreate')),
        teacher_id: parseInt(formData.get('teacherSelectCreate')),
        day_of_week: formData.get('daySelect'),
        start_time: formData.get('startTimeInput') + ':00',
        duration_minutes: parseInt(formData.get('durationInput')),
        room_number: formData.get('roomInputCreate')
    };

    try {
        const { data, error } = await window.supabase
            .from('timetable_entries')
            .insert([entryData]);

        if (error) {
            console.error('Error creating timetable entry:', error);
            showToast('Failed to create timetable entry. Please try again.', 'error');
            return;
        }

        console.log('Timetable entry created successfully:', data);
        showToast('Schedule Created Successfully!', 'success');

        // Close modal and reset form
        closeCreateModal();
        event.target.reset();
    } catch (err) {
        console.error('Unexpected error creating timetable entry:', err);
        showToast('An unexpected error occurred. Please try again.', 'error');
    }
}
