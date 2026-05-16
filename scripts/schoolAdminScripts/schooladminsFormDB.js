const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

// @ts-ignore
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Function to submit school admin data to Supabase
async function submitSchoolAdmin(adminData) {
    try {
        console.log('Submitting school admin data with Auth registration:', adminData);

        // 1. Create a temporary Supabase client for registration (avoids signing out current user)
        // @ts-ignore
        const tempClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 2. Register User in Supabase Auth
        const { data: authData, error: authError } = await tempClient.auth.signUp({
            email: adminData.email,
            password: '123456', // Default password as requested
            options: {
                data: {
                    full_name: adminData.full_name,
                    role: adminData.role
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

        // 3. Insert into School_Admin table with linked ID
        // We use the Auth User ID as the Primary Key (admin_id)
        const dbPayload = {
            ...adminData,
            admin_id: authData.user.id
        };

        const { data, error } = await supabaseClient
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
        const { data, error } = await supabaseClient
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

        const { data, error } = await supabaseClient
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
async function deleteSchoolAdmin(adminId) {
    try {
        console.log('Deleting school admin:', adminId);

        const { error } = await supabaseClient
            .from('School_Admin')
            .delete()
            .eq('admin_id', adminId);

        if (error) {
            console.error('Error deleting school admin:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete school admin'
            };
        }

        console.log('School admin deleted successfully');
        return {
            success: true
        };

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
