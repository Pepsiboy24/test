import { supabase } from './config.js';
import { hasFeatureAccess, getCurrentUserTier, TIERS } from './tierAccess.js';
import { waitForUser } from '/core/perf.js';

// UI Element hiding based on tier
class UITierGating {
    constructor() {
        this.init();
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.applyTierGating());
        } else {
            await this.applyTierGating();
        }
    }

    async applyTierGating() {
        const userTier = await getCurrentUserTier();
        if (!userTier) return;

        console.log(`Applying UI gating for tier ${userTier}`);

        // Check if we should show setup checklist
        await this.checkSetupStatus();

        // Hide navigation items based on tier
        this.hideNavigationItems(userTier);

        // Hide dashboard widgets based on tier
        this.hideDashboardWidgets(userTier);

        // Hide buttons and actions based on tier
        this.hideActionButtons(userTier);

        // Update branding based on tier
        this.updateBranding(userTier);
    }

    async checkSetupStatus() {
        try {
            // Get current user's school data
            const user = await waitForUser();
            
            if (userError || !user) {
                console.error('User not authenticated');
                return;
            }

            const schoolId = user.user_metadata?.school_id;
            if (!schoolId) {
                console.error('School ID not found in user metadata');
                return;
            }

            // Check school setup status
            const { data: school, error: schoolError } = await supabase
                .from('Schools')
                .select('setup_completed, setup_progress')
                .eq('school_id', schoolId)
                .single();

            if (schoolError) {
                console.error('Error fetching school data:', schoolError);
                return;
            }

            // Check if school has actual data (classes, teachers, students)
            const { data: classes } = await supabase
                .from('Classes')
                .select('class_id')
                .eq('school_id', schoolId)
                .limit(1);

            const { data: teachers } = await supabase
                .from('Teachers')
                .select('teacher_id')
                .eq('school_id', schoolId)
                .limit(1);

            const hasClasses = classes && classes.length > 0;
            const hasTeachers = teachers && teachers.length > 0;
            const setupCompleted = school?.setup_completed || false;

            // Determine which view to show
            const setupChecklist = document.getElementById('setupChecklist');
            const standardDashboard = document.getElementById('standardDashboard');

            if (setupChecklist && standardDashboard) {
                if (!setupCompleted && (!hasClasses || !hasTeachers)) {
                    // Show setup checklist
                    setupChecklist.style.display = 'block';
                    standardDashboard.style.display = 'none';
                    
                    // Update setup progress
                    this.updateSetupProgress(school?.setup_progress || 0);
                } else {
                    // Show standard dashboard
                    setupChecklist.style.display = 'none';
                    standardDashboard.style.display = 'block';
                }
            }

        } catch (error) {
            console.error('Error checking setup status:', error);
            // Show standard dashboard as fallback
            const setupChecklist = document.getElementById('setupChecklist');
            const standardDashboard = document.getElementById('standardDashboard');
            
            if (setupChecklist && standardDashboard) {
                setupChecklist.style.display = 'none';
                standardDashboard.style.display = 'block';
            }
        }
    }

    updateSetupProgress(progress) {
        const progressBar = document.getElementById('setupProgress');
        const progressText = document.getElementById('progressPercentage');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `Setup Progress: ${progress}%`;
        }
    }

    hideNavigationItems(userTier) {
        // Navigation items to hide based on tier
        const navItems = [
            {
                selector: '[data-feature="student-dashboard"]',
                tier: TIERS.STUDENT_ENGAGEMENT,
                type: 'nav'
            },
            {
                selector: '[data-feature="cbt-exams"]',
                tier: TIERS.STUDENT_ENGAGEMENT,
                type: 'nav'
            },
            {
                selector: '[data-feature="parent-portal"]',
                tier: TIERS.FULL_CONNECT,
                type: 'nav'
            },
            {
                selector: '[data-feature="ai-assistants"]',
                tier: TIERS.FULL_CONNECT,
                type: 'nav'
            },
            {
                selector: '[data-feature="white-labeling"]',
                tier: TIERS.ENTERPRISE,
                type: 'nav'
            }
        ];

        navItems.forEach(item => {
            const elements = document.querySelectorAll(item.selector);
            if (userTier < item.tier) {
                elements.forEach(el => {
                    el.style.display = 'none';
                    el.setAttribute('aria-hidden', 'true');
                });
            } else {
                elements.forEach(el => {
                    el.style.display = '';
                    el.removeAttribute('aria-hidden');
                });
            }
        });
    }

    hideDashboardWidgets(userTier) {
        // Dashboard widgets to hide based on tier
        const widgets = [
            {
                selector: '[data-widget="student-rankings"]',
                tier: TIERS.STUDENT_ENGAGEMENT
            },
            {
                selector: '[data-widget="cbt-materials"]',
                tier: TIERS.STUDENT_ENGAGEMENT
            },
            {
                selector: '[data-widget="ai-assistant"]',
                tier: TIERS.FULL_CONNECT
            },
            {
                selector: '[data-widget="parent-payments"]',
                tier: TIERS.FULL_CONNECT
            }
        ];

        widgets.forEach(widget => {
            const elements = document.querySelectorAll(widget.selector);
            if (userTier < widget.tier) {
                elements.forEach(el => {
                    el.style.display = 'none';
                    // Add a "Upgrade required" message
                    const upgradeMsg = document.createElement('div');
                    upgradeMsg.className = 'tier-upgrade-message';
                    upgradeMsg.innerHTML = `
                        <div class="upgrade-prompt">
                            <i class="fas fa-lock"></i>
                            <span>This feature requires Tier ${widget.tier} or higher</span>
                            <button class="upgrade-btn" onclick="window.tierAccess.showUpgradeModal()">
                                Upgrade Now
                            </button>
                        </div>
                    `;
                    upgradeMsg.style.cssText = `
                        padding: 20px;
                        text-align: center;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        color: #64748b;
                    `;
                    el.parentNode.insertBefore(upgradeMsg, el);
                });
            } else {
                elements.forEach(el => {
                    el.style.display = '';
                    // Remove any upgrade messages
                    const upgradeMsg = el.parentNode.querySelector('.tier-upgrade-message');
                    if (upgradeMsg) upgradeMsg.remove();
                });
            }
        });
    }

    hideActionButtons(userTier) {
        // Action buttons to hide based on tier
        const buttons = [
            {
                selector: '[data-action="create-student"]',
                tier: TIERS.STUDENT_ENGAGEMENT
            },
            {
                selector: '[data-action="create-parent"]',
                tier: TIERS.FULL_CONNECT
            },
            {
                selector: '[data-action="ai-chat"]',
                tier: TIERS.FULL_CONNECT
            },
            {
                selector: '[data-action="white-label"]',
                tier: TIERS.ENTERPRISE
            }
        ];

        buttons.forEach(button => {
            const elements = document.querySelectorAll(button.selector);
            if (userTier < button.tier) {
                elements.forEach(el => {
                    el.disabled = true;
                    el.title = `This feature requires Tier ${button.tier} or higher`;
                    el.style.opacity = '0.5';
                    el.style.cursor = 'not-allowed';
                });
            } else {
                elements.forEach(el => {
                    el.disabled = false;
                    el.title = '';
                    el.style.opacity = '';
                    el.style.cursor = '';
                });
            }
        });
    }

    updateBranding(userTier) {
        // Update branding based on tier
        if (userTier >= TIERS.ENTERPRISE) {
            // White-labeling - remove default branding
            const brandingElements = document.querySelectorAll('[data-branding="default"]');
            brandingElements.forEach(el => el.style.display = 'none');
        }
    }

    // Method to check if a specific feature is available
    async isFeatureAvailable(featureKey) {
        return await hasFeatureAccess(featureKey);
    }

    // Method to show upgrade modal
    showUpgradeModal() {
        const modal = document.createElement('div');
        modal.className = 'tier-upgrade-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>Upgrade Your Plan</h3>
                    <p>Unlock this feature and more by upgrading to a higher tier.</p>
                    <div class="tier-options">
                        <div class="tier-card">
                            <h4>Tier 2 - Student Engagement</h4>
                            <ul>
                                <li>Student Dashboard</li>
                                <li>CBT Exams & Materials</li>
                                <li>Student Creation</li>
                            </ul>
                        </div>
                        <div class="tier-card">
                            <h4>Tier 3 - Full Connect</h4>
                            <ul>
                                <li>Everything in Tier 2</li>
                                <li>Parent Portal</li>
                                <li>AI Assistants</li>
                                <li>Parent Creation</li>
                            </ul>
                        </div>
                        <div class="tier-card">
                            <h4>Enterprise</h4>
                            <ul>
                                <li>Everything in Tier 3</li>
                                <li>White-labeling</li>
                                <li>Custom Domain</li>
                                <li>Priority Support</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="close-modal">Close</button>
                        <button class="contact-sales">Contact Sales</button>
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

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.modal-overlay')) modal.remove();
        });
    }
}

// Initialize UI gating
new UITierGating();

// Export for global usage
window.uiTierGating = new UITierGating();

// Export for module usage
export { UITierGating };
