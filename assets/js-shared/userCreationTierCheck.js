import { canCreateRole, getCurrentUserTier, TIERS } from './tierAccess.js';
import { supabase } from './config.js';

// User creation validation based on tier
class UserCreationTierCheck {
    constructor() {
        this.init();
    }

    init() {
        // Intercept form submissions for user creation
        this.interceptUserCreationForms();
        
        // Add validation to user creation buttons
        this.addValidationToButtons();
    }

    interceptUserCreationForms() {
        // Find all user creation forms
        const forms = document.querySelectorAll('[data-user-creation-form]');
        
        forms.forEach(form => {
            form.addEventListener('submit', async (e) => {
                const role = form.getAttribute('data-user-role');
                if (!(await this.validateUserCreation(role))) {
                    e.preventDefault();
                    this.showTierRestrictionModal(role);
                    return false;
                }
            });
        });
    }

    addValidationToButtons() {
        // Add validation to user creation buttons
        const buttons = document.querySelectorAll('[data-create-user]');
        
        buttons.forEach(button => {
            const role = button.getAttribute('data-create-user');
            
            // Check if user can create this role
            this.updateButtonState(button, role);
            
            // Add click listener
            button.addEventListener('click', async (e) => {
                if (!(await this.validateUserCreation(role))) {
                    e.preventDefault();
                    this.showTierRestrictionModal(role);
                    return false;
                }
            });
        });
    }

    async validateUserCreation(role) {
        const canCreate = await canCreateRole(role);
        
        if (!canCreate) {
            console.warn(`User creation blocked: Cannot create ${role} with current tier`);
            return false;
        }
        
        return true;
    }

    updateButtonState(button, role) {
        canCreateRole(role).then(canCreate => {
            if (!canCreate) {
                button.disabled = true;
                button.title = `Your current tier doesn't allow creating ${role}s`;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
                
                // Add upgrade indicator
                if (!button.querySelector('.tier-upgrade-indicator')) {
                    const indicator = document.createElement('span');
                    indicator.className = 'tier-upgrade-indicator';
                    indicator.innerHTML = ' <i class="fas fa-lock"></i>';
                    indicator.style.cssText = 'color: #ef4444; font-size: 0.8em;';
                    button.appendChild(indicator);
                }
            } else {
                button.disabled = false;
                button.title = '';
                button.style.opacity = '';
                button.style.cursor = '';
                
                // Remove upgrade indicator
                const indicator = button.querySelector('.tier-upgrade-indicator');
                if (indicator) indicator.remove();
            }
        });
    }

    showTierRestrictionModal(role) {
        const modal = document.createElement('div');
        modal.className = 'tier-restriction-modal';
        
        const requiredTier = this.getRequiredTierForRole(role);
        const tierNames = {
            [TIERS.ADMIN_CORE]: 'Tier 1 (Admin Core)',
            [TIERS.STUDENT_ENGAGEMENT]: 'Tier 2 (Student Engagement)',
            [TIERS.FULL_CONNECT]: 'Tier 3 (Full Connect)',
            [TIERS.ENTERPRISE]: 'Enterprise'
        };
        
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-lock"></i> Tier Restriction</h3>
                    </div>
                    <div class="modal-body">
                        <p>You cannot create <strong>${role}s</strong> with your current subscription tier.</p>
                        <p>This feature requires <strong>${tierNames[requiredTier]}</strong> or higher.</p>
                        
                        <div class="tier-comparison">
                            <h4>Available Features by Tier:</h4>
                            <div class="tier-grid">
                                <div class="tier-card">
                                    <h5>Tier 1 - Admin Core</h5>
                                    <ul>
                                        <li>✓ Admin & Teacher Creation</li>
                                        <li>✗ Student Creation</li>
                                        <li>✗ Parent Creation</li>
                                    </ul>
                                </div>
                                <div class="tier-card">
                                    <h5>Tier 2 - Student Engagement</h5>
                                    <ul>
                                        <li>✓ Everything in Tier 1</li>
                                        <li>✓ Student Creation</li>
                                        <li>✗ Parent Creation</li>
                                    </ul>
                                </div>
                                <div class="tier-card">
                                    <h5>Tier 3 - Full Connect</h5>
                                    <ul>
                                        <li>✓ Everything in Tier 2</li>
                                        <li>✓ Parent Creation</li>
                                        <li>✓ AI Assistants</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="close-modal">Close</button>
                        <button class="upgrade-btn">Upgrade Plan</button>
                    </div>
                </div>
            </div>
        `;

        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .tier-restriction-modal .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            
            .tier-restriction-modal .modal-content {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .tier-restriction-modal .modal-header h3 {
                margin: 0 0 16px 0;
                color: #1e293b;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .tier-restriction-modal .tier-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 16px;
                margin: 16px 0;
            }
            
            .tier-restriction-modal .tier-card {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
            }
            
            .tier-restriction-modal .tier-card h5 {
                margin: 0 0 8px 0;
                color: #6200ea;
            }
            
            .tier-restriction-modal .tier-card ul {
                margin: 0;
                padding: 0;
                list-style: none;
            }
            
            .tier-restriction-modal .tier-card li {
                padding: 4px 0;
                font-size: 0.9em;
            }
            
            .tier-restriction-modal .modal-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                margin-top: 24px;
            }
            
            .tier-restriction-modal .close-modal {
                padding: 8px 16px;
                border: 1px solid #e2e8f0;
                background: white;
                border-radius: 6px;
                cursor: pointer;
            }
            
            .tier-restriction-modal .upgrade-btn {
                padding: 8px 16px;
                background: #6200ea;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
            style.remove();
        });
        
        modal.querySelector('.upgrade-btn').addEventListener('click', () => {
            // Redirect to upgrade page or contact sales
            window.location.href = '/upgrade.html';
        });
        
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.modal-overlay')) {
                modal.remove();
                style.remove();
            }
        });
    }

    getRequiredTierForRole(role) {
        switch (role.toLowerCase()) {
            case 'admin':
            case 'teacher':
                return TIERS.ADMIN_CORE;
            case 'student':
                return TIERS.STUDENT_ENGAGEMENT;
            case 'parent':
                return TIERS.FULL_CONNECT;
            default:
                return TIERS.ENTERPRISE;
        }
    }

    // Server-side validation check (for API calls)
    static async validateUserCreationServerSide(role, schoolId) {
        try {
            const { data: school } = await supabase
                .from('Schools')
                .select('tier')
                .eq('school_id', schoolId)
                .single();
                
            if (!school) return false;
            
            const tierCheck = new UserCreationTierCheck();
            const requiredTier = tierCheck.getRequiredTierForRole(role);
            
            return school.tier >= requiredTier;
        } catch (error) {
            console.error('Error validating user creation server-side:', error);
            return false;
        }
    }
}

// Initialize user creation tier checks
new UserCreationTierCheck();

// Export for global usage
window.userCreationTierCheck = new UserCreationTierCheck();

// Export for module usage
export { UserCreationTierCheck };
