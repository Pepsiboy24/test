import { supabase } from '../../../core/config.js';
import { waitForUser } from '/core/perf.js';

/**
 * Subject Allocation Manager - Clean Subject Management System
 * Prevents duplicate subjects and manages subject-class-teacher relationships
 */
class SubjectAllocationManager {
    constructor() {
        this.schoolId = null;
        this.subjects = [];
        this.classes = [];
        this.teachers = [];
    }

    /**
     * Initialize the allocation manager
     */
    async initialize() {
        try {
            const user = await waitForUser();
            this.schoolId = userData.user?.user_metadata?.school_id;

            if (!this.schoolId) {
                throw new Error('School ID not found in user metadata');
            }

            await this.loadMasterData();
            console.log('Subject Allocation Manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Subject Allocation Manager:', error);
            return false;
        }
    }

    /**
     * Load master data (subjects, classes, teachers)
     */
    async loadMasterData() {
        try {
            const { data: subjects, error: subjectsError } = await supabase
                .from('Subjects')
                .select('*')
                .eq('school_id', this.schoolId)
                .order('subject_name');

            if (subjectsError) throw subjectsError;
            this.subjects = subjects || [];

            const { data: classes, error: classesError } = await supabase
                .from('Classes')
                .select('class_id, class_name, section')
                .eq('school_id', this.schoolId)
                .order('class_name');

            if (classesError) throw classesError;
            this.classes = classes || [];

            const { data: teachers, error: teachersError } = await supabase
                .from('Teachers')
                .select('teacher_id, first_name, last_name')
                .eq('school_id', this.schoolId)
                .order('first_name');

            if (teachersError) throw teachersError;
            this.teachers = teachers || [];
        } catch (error) {
            console.error('Error loading master data:', error);
            throw error;
        }
    }

    /**
     * Add new subject (unique subjects table)
     */
    async addSubject(subjectData) {
        try {
            const existingSubject = this.subjects.find(
                s => s.subject_name.toLowerCase() === subjectData.subjectName.toLowerCase()
            );

            if (existingSubject) {
                throw new Error(`Subject "${subjectData.subjectName}" already exists`);
            }

            const { data, error } = await supabase
                .from('Subjects')
                .insert([{
                    subject_name: subjectData.subjectName,
                    subject_code: subjectData.subjectCode || this.generateSubjectCode(subjectData.subjectName),
                    is_core: subjectData.subjectType === 'core',
                    school_id: this.schoolId,
                    created_at: new Date().toISOString(),
                    created_by: await waitForUser()?.email || 'system'
                }])
                .select()
                .single();

            if (error) throw error;
            this.subjects.push(data);

            return {
                success: true,
                subject: data,
                message: `Subject "${subjectData.subjectName}" added successfully`
            };
        } catch (error) {
            console.error('Error adding subject:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Allocate subject to class and teacher
     * LOGICAL FIX: Now populates 'class_subjects' to ensure data appears on student dashboard.
     */
    async allocateSubject(allocationData) {
        try {
            const { subjectId, classId, teacherId } = allocationData;

            if (!subjectId || !classId || !teacherId) {
                throw new Error('Subject, Class, and Teacher are all required');
            }

            // 1. Check if teacher allocation already exists
            const { data: existingAllocation, error: checkError } = await supabase
                .from('Subject_Allocations')
                .select('*')
                .eq('subject_id', subjectId)
                .eq('class_id', classId)
                .eq('teacher_id', teacherId)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existingAllocation) {
                throw new Error('This subject is already allocated to this class and teacher');
            }

            const userEmail = await waitForUser()?.email || 'system';

            // 2. LOGICAL LINK: Upsert into 'class_subjects' (the table used by student dashboard)
            // Using upsert prevents duplicates if multiple teachers are assigned to the same subject/class
            const { error: junctionError } = await supabase
                .from('class_subjects')
                .upsert({
                    class_id: classId,
                    subject_id: subjectId,
                    school_id: this.schoolId
                }, { onConflict: 'class_id, subject_id' });

            if (junctionError) {
                console.error('Failed to link subject to class roster:', junctionError);
                throw new Error('Failed to update class roster. Allocation aborted.');
            }

            // 3. Create specific Teacher allocation
            const { data, error } = await supabase
                .from('Subject_Allocations')
                .insert([{
                    subject_id: subjectId,
                    class_id: classId,
                    teacher_id: teacherId,
                    school_id: this.schoolId,
                    academic_year: new Date().getFullYear().toString(),
                    term: 'First Term',
                    created_at: new Date().toISOString(),
                    created_by: userEmail
                }])
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                allocation: data,
                message: 'Subject allocated and roster updated successfully'
            };
        } catch (error) {
            console.error('Error allocating subject:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all allocations
     */
    async getAllocations() {
        try {
            const { data, error } = await supabase
                .from('Subject_Allocations')
                .select(`
                    *,
                    Subjects(subject_name, subject_code, is_core),
                    Classes(class_name, section),
                    Teachers(first_name, last_name)
                `)
                .eq('school_id', this.schoolId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, allocations: data || [] };
        } catch (error) {
            console.error('Error fetching allocations:', error);
            return { success: false, error: error.message, allocations: [] };
        }
    }

    /**
     * Remove allocation
     */
    async removeAllocation(allocationId) {
        try {
            const { error } = await supabase
                .from('Subject_Allocations')
                .delete()
                .eq('allocation_id', allocationId);

            if (error) throw error;

            return { success: true, message: 'Allocation removed successfully' };
        } catch (error) {
            console.error('Error removing allocation:', error);
            return { success: false, error: error.message };
        }
    }

    generateSubjectCode(subjectName) {
        return subjectName.toUpperCase().replace(/\s+/g, '_').substring(0, 8);
    }

    populateDropdowns(subjectSelect, classSelect, teacherSelect) {
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
        classSelect.innerHTML = '<option value="">Select Class</option>';
        teacherSelect.innerHTML = '<option value="">Select Teacher</option>';

        this.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.subject_id;
            option.textContent = `${subject.subject_name} (${subject.is_core ? 'Core' : 'Elective'})`;
            subjectSelect.appendChild(option);
        });

        this.classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.class_id;
            option.textContent = `${cls.class_name} ${cls.section || ''}`;
            classSelect.appendChild(option);
        });

        this.teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.teacher_id;
            option.textContent = `${teacher.first_name} ${teacher.last_name}`;
            teacherSelect.appendChild(option);
        });
    }
}

window.SubjectAllocationManager = SubjectAllocationManager;