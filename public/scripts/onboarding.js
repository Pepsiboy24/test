import { supabase } from './config.js';

// Add error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

class SchoolOnboarding {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 3;
        this.logoFile = null;
        this.formData = {};
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStepIndicator();
        this.loadSavedData();
        
        // Small delay ensures DOM and Supabase client are fully ready
        setTimeout(() => {
            this.checkAuthentication();
        }, 100);
    }

    loadSavedData() {
        // Load data from sessionStorage (from previous signup steps)
        const schoolName = sessionStorage.getItem('schoolName');
        const workEmail = sessionStorage.getItem('workEmail');
        const fullName = sessionStorage.getItem('fullName');
        const phoneNumber = sessionStorage.getItem('phoneNumber');
        const gender = sessionStorage.getItem('gender');
        const selectedTier = sessionStorage.getItem('selectedTier');
        
        if (schoolName) {
            const field = document.getElementById('schoolName');
            if (field) field.value = schoolName;
        }
        
        if (selectedTier) {
            this.selectTier(parseInt(selectedTier));
        }
    }

    async checkAuthentication() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const mainContent = document.querySelector('.onboarding-container');
        
        try {
            // 1. Get current authenticated user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            
            if (userError || !user) {
                console.log('User not authenticated, redirecting to signup...');
                window.location.href = '/signup/step1';
                return;
            }
            
            this.currentUser = user;

            // 2. Check if user is already an admin of a school
            const { data: adminRecord } = await supabase
                .from('School_Admin')
                .select('school_id')
                .eq('email', user.email)
                .maybeSingle();
            
            if (adminRecord) {
                console.log('User already assigned to a school, redirecting to dashboard...');
                window.location.href = '../html/schoolAdmin/schoolAdminDashboard.html';
                return;
            }
            
            // 3. Reveal the form if no school is found
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            if (mainContent) mainContent.style.display = 'flex';
            
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.showError('Authentication check failed. Please try logging in again.');
            
            if (loadingOverlay) {
                loadingOverlay.innerHTML = `
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                        <p style="font-size: 18px; font-weight: 500;">Authentication Failed</p>
                    </div>
                `;
            }
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 3000);
        }
    }

    preFillForm() {
        if (!this.currentUser) return;
        const schoolName = this.currentUser.user_metadata?.school_name;
        if (schoolName) {
            const field = document.getElementById('schoolName');
            if (field) field.value = schoolName;
        }
    }

    setupEventListeners() {
        const form = document.getElementById('onboardingForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        const logoInput = document.getElementById('schoolLogo');
        if (logoInput) {
            logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        }
    }

    updateStepIndicator() {
        const steps = document.querySelectorAll('.step');
        const progressFill = document.getElementById('progressFill');
        
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('completed', stepNumber < this.currentStep);
            step.classList.toggle('active', stepNumber === this.currentStep);
        });

        const progress = ((this.currentStep - 1) / 3) * 100;
        if (progressFill) progressFill.style.width = `${progress}%`;

        this.updateFormSections();
    }

    updateFormSections() {
        const s1 = document.getElementById('schoolInfoSection');
        const s2 = document.getElementById('academicSetupSection');
        const s3 = document.getElementById('bankInfoSection');
        const btnText = document.getElementById('btnText');

        if (this.currentStep === 1) {
            s1.style.display = 'block';
            s2.style.display = 'none';
            s3.style.display = 'none';
            btnText.textContent = 'Continue';
        } else if (this.currentStep === 2) {
            s1.style.display = 'none';
            s2.style.display = 'block';
            s3.style.display = 'none';
            btnText.textContent = 'Continue';
        } else if (this.currentStep === 3) {
            s1.style.display = 'none';
            s2.style.display = 'none';
            s3.style.display = 'block';
            btnText.textContent = 'Create School Account';
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        if (this.currentStep === 1) {
            if (this.validateStep1()) {
                this.currentStep = 2;
                this.updateStepIndicator();
            }
        } else if (this.currentStep === 2) {
            if (this.validateStep2()) {
                this.currentStep = 3;
                this.updateStepIndicator();
            }
        } else if (this.currentStep === 3) {
            if (this.validateStep3()) {
                await this.createSchoolAccount();
            }
        }
    }

    validateStep1() {
        const schoolName = document.getElementById('schoolName').value.trim();
        const tierEl = document.getElementById('tierSelect');
        
        if (!schoolName || schoolName.length < 3) {
            this.showError('A valid school name is required');
            return false;
        }
        
        if (!tierEl || !tierEl.value) {
            this.showError('Please select a subscription plan');
            return false;
        }
        
        this.formData.schoolName = schoolName;
        this.formData.tier = parseInt(tierEl.value);
        this.hideMessages();
        return true;
    }

    validateStep2() {
        const academicSession = document.getElementById('academicSession').value.trim();
        const currentTerm = document.getElementById('currentTerm').value;
        const nextTermStartDate = document.getElementById('nextTermStartDate').value;
        
        if (!academicSession) {
            this.showError('Academic session is required');
            return false;
        }
        
        if (!currentTerm) {
            this.showError('Please select the current term');
            return false;
        }
        
        if (!nextTermStartDate) {
            this.showError('Next term start date is required');
            return false;
        }
        
        this.formData.academicSession = academicSession;
        this.formData.currentTerm = currentTerm;
        this.formData.nextTermStartDate = nextTermStartDate;
        this.formData.schoolAddress = document.getElementById('schoolAddress').value.trim();
        
        this.hideMessages();
        return true;
    }

    validateStep3() {
        const bankName = document.getElementById('bankName').value.trim();
        const accNum = document.getElementById('accountNumber').value.trim();
        const commRate = parseFloat(document.getElementById('commissionRate').value);

        if (!bankName || accNum.length < 8) {
            this.showError('Please check your bank details');
            return false;
        }

        this.formData.bankName = bankName;
        this.formData.accountNumber = accNum;
        this.formData.bankCode = document.getElementById('bankCode').value.trim();
        this.formData.subAccountCode = document.getElementById('subAccountCode').value.trim();
        this.formData.commissionRate = isNaN(commRate) ? 1.5 : commRate;

        this.hideMessages();
        return true;
    }

    async createSchoolAccount() {
        const submitBtn = document.getElementById('submitBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const btnText = document.getElementById('btnText');

        try {
            submitBtn.disabled = true;
            loadingSpinner.style.display = 'inline-block';
            btnText.textContent = 'Creating Account...';

            if (!this.currentUser) throw new Error('Session expired. Please log in again.');

            // Get form values
            const bankName = document.getElementById('bankName').value.trim();
            const accountNumber = document.getElementById('accountNumber').value.trim();
            const bankCode = document.getElementById('bankCode').value.trim();
            const commissionRate = parseFloat(document.getElementById('commissionRate').value);
            const academicSession = document.getElementById('academicSession').value.trim();
            const currentTerm = document.getElementById('currentTerm').value;
            const nextTermStartDate = document.getElementById('nextTermStartDate').value;
            const tierEl = document.getElementById('tierSelect');

            // Get saved data from sessionStorage
            const schoolName = sessionStorage.getItem('schoolName');
            const workEmail = sessionStorage.getItem('workEmail');
            const fullName = sessionStorage.getItem('fullName');
            const phoneNumber = sessionStorage.getItem('phoneNumber');
            const gender = sessionStorage.getItem('gender');
            const schoolType = sessionStorage.getItem('schoolType');
            const schoolWebsite = sessionStorage.getItem('schoolWebsite') || null;

            // Validation
            if (!bankName || !accountNumber || accountNumber.length < 8) {
                this.showError('Please check your bank details');
                return;
            }

            if (!academicSession || !currentTerm || !nextTermStartDate) {
                this.showError('Please complete all academic configuration fields');
                return;
            }

            this.formData.bankName = bankName;
            this.formData.accountNumber = accountNumber;
            this.formData.bankCode = bankCode || null;
            this.formData.subAccountCode = null;
            this.formData.commissionRate = isNaN(commissionRate) ? 1.5 : commissionRate;
            this.formData.tier = tierEl ? parseInt(tierEl.value) : 1;
            this.formData.academicSession = academicSession;
            this.formData.currentTerm = currentTerm;
            this.formData.nextTermStartDate = nextTermStartDate;

            let logoUrl = null;
            if (this.logoFile) {
                logoUrl = await this.uploadLogo(this.logoFile);
            }

            // 1. Insert into Schools table (using correct schema)
            const { data: school, error: schoolError } = await supabase
                .from('Schools')
                .insert([{
                    school_name: schoolName,
                    school_logo_url: logoUrl,
                    bank_name: this.formData.bankName,
                    account_number: this.formData.accountNumber,
                    bank_code: this.formData.bankCode,
                    sub_account_code: this.formData.subAccountCode,
                    commission_rate: this.formData.commissionRate,
                    current_session: this.formData.academicSession,
                    current_term: this.formData.currentTerm,
                    next_term_start_date: this.formData.nextTermStartDate,
                    tier: this.formData.tier,
                    school_type: schoolType || null,
                    website: schoolWebsite,
                    is_active: true,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (schoolError) throw new Error(`School creation failed: ${schoolError.message}`);

            // 2. Create School_Admin record
            const { error: adminError } = await supabase
                .from('School_Admin')
                .insert([{
                    email: workEmail,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    gender: gender,
                    role: 'super_admin',
                    school_id: school.school_id,
                    permissions_json: { can_manage_school: true, can_manage_users: true }
                }]);

            if (adminError) throw new Error(`Admin assignment failed: ${adminError.message}`);

            console.log('✅ School_Admin record created successfully');

            // 3. CRITICAL: Update Auth Metadata for RLS compliance and tier persistence
            // This ensures the tier selection 'sticks' to the user's session for dashboard gating
            const { error: metadataError } = await supabase.auth.updateUser({
                data: { 
                    school_id: school.school_id,
                    tier: parseInt(school.tier), // Ensure tier is an integer
                    user_type: 'school_admin'
                }
            });

            if (metadataError) {
                console.error('❌ Failed to update user metadata:', metadataError);
                throw new Error(`Metadata update failed: ${metadataError.message}`);
            }

            console.log('✅ User metadata updated - school_id:', school.school_id, 'tier:', school.tier);

            console.log('School created successfully with ID:', school.school_id);
            this.showSuccess('School setup complete! Redirecting to login...');
            
            setTimeout(() => {
                // Clear sessionStorage and redirect to main login page
                sessionStorage.clear();
                window.location.href = "/login";
            }, 2000);

        } catch (error) {
            console.error('Onboarding error:', error);
            this.showError(error.message);
            submitBtn.disabled = false;
            loadingSpinner.style.display = 'none';
            btnText.textContent = 'Create School Account';
        }
    }

    // Helper methods for logo upload and UI messages
    async uploadLogo(file) {
        const fileName = `school-logos/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('school-assets').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('school-assets').getPublicUrl(fileName);
        return publicUrl;
    }

    showError(msg) {
        const el = document.getElementById('errorMessage');
        el.textContent = msg;
        el.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showSuccess(msg) {
        const el = document.getElementById('successMessage');
        el.textContent = msg;
        el.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    hideMessages() {
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('successMessage').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => { new SchoolOnboarding(); });