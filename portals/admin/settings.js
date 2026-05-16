// School Settings JavaScript
import { waitForUser } from '/core/perf.js';
import { supabase } from '../../core/config.js';
// Handles CRUD operations for Schools table with logo upload

let currentSchoolId = null;
let currentAdminId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeSettings();
});

async function initializeSettings() {
    try {
        // Get current admin info
        currentAdminId = await getCurrentAdminId();
        
        if (!currentAdminId) {
            showError('Unable to identify admin user. Please log in again.');
            return;
        }

        // Setup event listeners
        if (!currentSchoolId) {
            console.warn('Strict Guard: No school_id found. Execution blocked.');
            return;
        }
        setupEventListeners();
        
        // Load current school settings
        await loadSchoolSettings();
        
    } catch (error) {
        console.error('Error initializing settings:', error);
        showError('Failed to load school settings. Please refresh the page.');
    }
}

async function getCurrentAdminId() {
    try {
        // Get authenticated user
        const user = await waitForUser();
        
        if (!user) {
            console.error('No authenticated user found');
            return null;
        }
        
        // Get admin record from School_Admin table using email
        const { data: adminData, error: adminError } = await supabase
            .from('School_Admin')
            .select('admin_id, school_id')
            .eq('email', user.email)
            .single();
            
        if (adminError) {
            console.error('Error getting admin data:', adminError);
            return null;
        }
        
        // Store school_id for later use
        if (adminData.school_id) {
            currentSchoolId = adminData.school_id;
        }
        
        return adminData.admin_id;
    } catch (error) {
        console.error('Error getting admin ID:', error);
        return null;
    }
}

function setupEventListeners() {
    // Form submission
    const form = document.getElementById('schoolSettingsForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Logo upload
    const logoContainer = document.querySelector('.current-logo');
    const logoInput = document.getElementById('logoInput');
    
    if (logoContainer && logoInput) {
        logoContainer.addEventListener('click', () => logoInput.click());
        
        logoInput.addEventListener('change', handleLogoUpload);
    }

    // Reset button
    const resetBtn = document.querySelector('button[onclick="resetForm()"]');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }
}

async function loadSchoolSettings() {
    try {
        showLoading(true);
        
        // If we don't have school_id yet, get it
        if (!currentSchoolId) {
            const adminId = await getCurrentAdminId();
            if (!adminId) {
                showError('Unable to identify admin user. Please log in again.');
                return;
            }
        }

        if (!currentSchoolId) {
            showError('No school assigned to this admin account.');
            return;
        }

        // Load school data
        const { data: schoolData, error: schoolError } = await supabase
            .from('Schools')
            .select('*')
            .eq('school_id', currentSchoolId)
            .single();

        if (schoolError) {
            if (schoolError.code === 'PGRST116') {
                // School doesn't exist, create default
                await createDefaultSchool();
                return;
            }
            throw schoolError;
        }

        // Populate form with existing data
        populateForm(schoolData);
        
    } catch (error) {
        console.error('Error loading school settings:', error);
        showError('Failed to load school settings.');
    } finally {
        showLoading(false);
    }
}

async function createDefaultSchool() {
    try {
        const defaultSchoolData = {
            school_name: 'My School',
            school_logo_url: null,
            bank_name: null,
            account_number: null,
            bank_code: null,
            sub_account_code: null,
            commission_rate: 1.5,
            is_active: true
        };

        const { data: newSchool, error: insertError } = await supabase
            .from('Schools')
            .insert([defaultSchoolData])
            .select()
            .single();

        if (insertError) throw insertError;

        // Link admin to school
        const { error: linkError } = await supabase
            .from('School_Admin')
            .update({ school_id: newSchool.school_id })
            .eq('admin_id', currentAdminId);

        if (linkError) throw linkError;

        currentSchoolId = newSchool.school_id;
        populateForm(newSchool);
        
        showSuccess('Default school profile created. Please update your information.');
        
    } catch (error) {
        console.error('Error creating default school:', error);
        showError('Failed to create school profile.');
    }
}

function populateForm(schoolData) {
    // Basic information
    document.getElementById('schoolName').value = schoolData.school_name || '';
    
    // These fields don't exist in the Schools table, so leave them empty
    document.getElementById('schoolEmail').value = '';
    document.getElementById('schoolPhone').value = '';
    document.getElementById('schoolAddress').value = '';

    // Logo
    if (schoolData.school_logo_url) {
        document.getElementById('currentLogo').src = schoolData.school_logo_url;
    }

    // Bank details - Schools table has individual columns, not JSON
    document.getElementById('bankName').value = schoolData.bank_name || '';
    document.getElementById('accountNumber').value = schoolData.account_number || '';
    document.getElementById('sortCode').value = schoolData.bank_code || '';
    
    // Account name would need to be stored separately or derived
    document.getElementById('accountName').value = schoolData.account_name || '';

    // Current balance - this column doesn't exist in Schools table
    document.getElementById('currentBalance').textContent = '';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        // Collect form data
        const formData = collectFormData();
        
        // Validate required fields
        if (!formData.school_name.trim()) {
            showError('School name is required.');
            return;
        }

        // Update school data
        const { error: updateError } = await supabase
            .from('Schools')
            .update(formData)
            .eq('school_id', currentSchoolId);

        if (updateError) throw updateError;

        showSuccess('School settings saved successfully!');
        
        // Update branding if name/logo changed
        if (formData.school_name || formData.logo_url) {
            updateGlobalBranding(formData);
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save settings. Please try again.');
    } finally {
        showLoading(false);
    }
}

function collectFormData() {
    // Basic information - only include fields that exist in Schools table
    const schoolData = {
        school_name: document.getElementById('schoolName').value.trim()
    };

    // Bank details - Schools table has individual columns, not JSON
    const bankName = document.getElementById('bankName').value.trim();
    const accountNumber = document.getElementById('accountNumber').value.trim();
    const bankCode = document.getElementById('sortCode').value.trim();

    if (bankName) schoolData.bank_name = bankName;
    if (accountNumber) schoolData.account_number = accountNumber;
    if (bankCode) schoolData.bank_code = bankCode;

    // Note: school_email, school_phone, school_address don't exist in Schools table
    // These would need to be stored in a separate table or added as columns

    return schoolData;
}

async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file.');
        return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
        showError('Image size must be less than 2MB.');
        return;
    }

    try {
        showLoading(true);
        
        // Upload to Supabase Storage
        const fileName = `school-logos/${currentSchoolId}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
            .from('school-assets')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('school-assets')
            .getPublicUrl(fileName);

        // Update school record with new logo URL
        const { error: updateError } = await supabase
            .from('Schools')
            .update({ logo_url: publicUrl })
            .eq('school_id', currentSchoolId);

        if (updateError) throw updateError;

        // Update preview
        document.getElementById('currentLogo').src = publicUrl;
        
        showSuccess('Logo uploaded successfully!');
        
        // Update global branding
        updateGlobalBranding({ logo_url: publicUrl });
        
    } catch (error) {
        console.error('Error uploading logo:', error);
        showError('Failed to upload logo. Please try again.');
    } finally {
        showLoading(false);
        // Reset file input
        e.target.value = '';
    }
}

function resetForm() {
    if (confirm('Are you sure you want to reset all changes?')) {
        loadSchoolSettings();
    }
}

function updateGlobalBranding(schoolData) {
    // Update sidebar branding if elements exist
    const sidebarLogo = document.querySelector('.sidebar-logo img');
    const sidebarName = document.querySelector('.sidebar-logo span');
    
    if (schoolData.logo_url && sidebarLogo) {
        sidebarLogo.src = schoolData.logo_url;
    }
    
    if (schoolData.school_name && sidebarName) {
        sidebarName.textContent = schoolData.school_name;
    }
    
    // Update page title
    if (schoolData.school_name) {
        document.title = `${schoolData.school_name} Settings - Admin Portal`;
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    if (successDiv && successText) {
        successText.textContent = message;
        successDiv.style.display = 'block';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

function showError(message) {
    console.error('Error:', message);
    alert(message);
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN'
    }).format(amount);
}

// Export functions for global access
window.resetForm = resetForm;
window.handleLogoUpload = handleLogoUpload;
