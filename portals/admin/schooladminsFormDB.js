import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

// Function to submit school admin data to Supabase
async function submitSchoolAdmin(adminData) {
    try {
        console.log('Submitting school admin data with Auth registration:', adminData);

        // 2. Register User in Supabase Auth with proper metadata
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: adminData.email,
            password: '123456', // Default password as requested
            options: {
                data: {
                    full_name: adminData.full_name,
                    role: adminData.role,
                    user_type: 'school_admin',
                    school_id: adminData.school_id // CRITICAL: Include school_id for RLS
                }
            }
        });

        if (authError) {
            console.error('Error creating auth user:', authError);
            return {
                success: false,
                error: authError.message || 'Failed to create user account'
            };
        }

        if (!authData.user) {
            return {
                success: false,
                error: 'User creation failed (no user returned)'
            };
        }

        console.log('Auth user created successfully:', authData.user.id);

        // 3. Insert into School_Admin table with linked ID and school_id
        // We use the Auth User ID as the Primary Key (admin_id)
        const dbPayload = {
            ...adminData,
            admin_id: authData.user.id,
            school_id: adminData.school_id // Ensure school_id is included
        };

        console.log('📝 Inserting school admin with RLS compliance:', dbPayload);

        const { data, error } = await supabase
            .from('School_Admin')
            .insert([dbPayload])
            .select();

        if (error) {
            console.error('Error inserting school admin profile:', error);
            // Optional: Rollback auth user creation if DB insert fails?
            // checking if user needs to be deleted from auth if this fails is complex client-side
            // without service role key. For now, report error.
            return {
                success: false,
                error: error.message || 'Failed to save school admin profile'
            };
        }

        console.log('School admin inserted successfully:', data);
        return {
            success: true,
            data: data
        };

    } catch (err) {
        console.error('Unexpected error submitting school admin:', err);
        return {
            success: false,
            error: 'An unexpected error occurred while saving the data'
        };
    }
}

// Function to check if email already exists
async function checkEmailExists(email) {
    try {
        const { data, error } = await supabase
            .from('School_Admin')
            .select('admin_id')
            .eq('email', email) // Corrected from personal_email to email
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
            console.error('Error checking email:', error);
            return false;
        }

        return !!data; // Return true if data exists
    } catch (err) {
        console.error('Unexpected error checking email:', err);
        return false;
    }
}

// Function to update school admin data
async function updateSchoolAdmin(adminId, adminData) {
    try {
        console.log('Updating school admin data:', adminId, adminData);

        const { data, error } = await supabase
            .from('School_Admin')
            .update(adminData)
            .eq('admin_id', adminId)
            .select();

        if (error) {
            console.error('Error updating school admin:', error);
            return {
                success: false,
                error: error.message || 'Failed to update school admin data'
            };
        }

        console.log('School admin updated successfully:', data);
        return {
            success: true,
            data: data
        };

    } catch (err) {
        console.error('Unexpected error updating school admin:', err);
        return {
            success: false,
            error: 'An unexpected error occurred while updating the data'
        };
    }
}

// Function to delete school admin
// FIX #56: Confirmation must be obtained by the caller (UI layer) before calling this.
// This function is now correctly imported and used in viewAllSchoolAdmins.js with a
// confirm dialog. Do NOT call this directly without a preceding confirmation step.
async function deleteSchoolAdmin(adminId) {
    if (!adminId) {
        return { success: false, error: 'No adminId provided' };
    }

    try {
        console.log('Deleting school admin:', adminId);

        // FIX #52: also verify the admin being deleted belongs to the caller's school
        const user = await waitForUser();
        if (authError || !user?.user_metadata?.school_id) {
            return { success: false, error: 'Cannot verify school identity before deletion' };
        }
        const schoolId = user.user_metadata.school_id;

        const { error } = await supabase
            .from('School_Admin')
            .delete()
            .eq('admin_id', adminId)
            .eq('school_id', schoolId); // safety: only delete within caller's own school

        if (error) {
            console.error('Error deleting school admin:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete school admin'
            };
        }

        console.log('School admin deleted successfully');
        return { success: true };

    } catch (err) {
        console.error('Unexpected error deleting school admin:', err);
        return {
            success: false,
            error: 'An unexpected error occurred while deleting the data'
        };
    }
}

// Export functions for use in other modules
export { submitSchoolAdmin, checkEmailExists, updateSchoolAdmin, deleteSchoolAdmin };
