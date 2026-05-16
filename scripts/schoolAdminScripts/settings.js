// School Settings JavaScript
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
        // Get admin ID from localStorage or session
        const adminId = localStorage.getItem('admin_id') || 
                       sessionStorage.getItem('admin_id') ||
                       window.currentAdminId;
        
        if (!adminId) {
            // Try to get from auth
            const { data: { user } } = await window.supabase.auth.getUser();
            return user?.id;
        }
        
        return adminId;
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
        
        // Get admin with school info
        const { data: adminData, error: adminError } = await window.supabase
            .from('School_Admin')
            .select('school_id')
            .eq('admin_id', currentAdminId)
            .single();

        if (adminError) {
            console.error('Error getting admin data:', adminError);
            throw adminError;
        }

        if (!adminData.school_id) {
            showError('No school assigned to this admin account.');
            return;
        }

        currentSchoolId = adminData.school_id;

        // Load school data
        const { data: schoolData, error: schoolError } = await window.supabase
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
            logo_url: null,
            bank_details: null,
            current_balance: 0
        };

        const { data: newSchool, error: insertError } = await window.supabase
            .from('Schools')
            .insert([defaultSchoolData])
            .select()
            .single();

        if (insertError) throw insertError;

        // Link admin to school
        const { error: linkError } = await window.supabase
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
    document.getElementById('schoolEmail').value = schoolData.school_email || '';
    document.getElementById('schoolPhone').value = schoolData.school_phone || '';
    document.getElementById('schoolAddress').value = schoolData.school_address || '';

    // Logo
    if (schoolData.logo_url) {
        document.getElementById('currentLogo').src = schoolData.logo_url;
    }

    // Bank details (stored as JSON)
    if (schoolData.bank_details) {
        try {
            const bankDetails = typeof schoolData.bank_details === 'string' 
                ? JSON.parse(schoolData.bank_details) 
                : schoolData.bank_details;
            
            document.getElementById('bankName').value = bankDetails.bank_name || '';
            document.getElementById('accountName').value = bankDetails.account_name || '';
            document.getElementById('accountNumber').value = bankDetails.account_number || '';
            document.getElementById('sortCode').value = bankDetails.sort_code || '';
        } catch (error) {
            console.error('Error parsing bank details:', error);
        }
    }

    // Current balance
    if (schoolData.current_balance !== undefined) {
        document.getElementById('currentBalance').textContent = 
            `₦${parseFloat(schoolData.current_balance).toFixed(2)}`;
    }
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
        const { error: updateError } = await window.supabase
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
    // Basic information
    const schoolData = {
        school_name: document.getElementById('schoolName').value.trim(),
        school_email: document.getElementById('schoolEmail').value.trim(),
        school_phone: document.getElementById('schoolPhone').value.trim(),
        school_address: document.getElementById('schoolAddress').value.trim()
    };

    // Bank details as JSON
    const bankDetails = {
        bank_name: document.getElementById('bankName').value.trim(),
        account_name: document.getElementById('accountName').value.trim(),
        account_number: document.getElementById('accountNumber').value.trim(),
        sort_code: document.getElementById('sortCode').value.trim()
    };

    // Only include non-empty bank details
    const hasBankDetails = Object.values(bankDetails).some(value => value !== '');
    if (hasBankDetails) {
        schoolData.bank_details = bankDetails;
    }

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
        
        const { error: uploadError } = await window.supabase.storage
            .from('school-assets')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = window.supabase.storage
            .from('school-assets')
            .getPublicUrl(fileName);

        // Update school record with new logo URL
        const { error: updateError } = await window.supabase
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
