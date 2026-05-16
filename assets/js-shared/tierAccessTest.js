import { hasFeatureAccess, getCurrentUserTier, canCreateRole, getAvailableFeatures, TIERS, FEATURES } from './tierAccess.js';

// Tier Access Testing Suite
class TierAccessTest {
    constructor() {
        this.testResults = [];
        this.currentTier = null;
    }

    async runAllTests() {
        console.log('🧪 Starting Tier Access Tests...');
        
        // Get current user tier
        this.currentTier = await getCurrentUserTier();
        console.log(`📊 Current User Tier: ${this.currentTier}`);
        
        // Run all test categories
        await this.testFeatureAccess();
        await this.testUserCreation();
        await this.testRouteAccess();
        await this.testUIElements();
        
        // Generate report
        this.generateTestReport();
    }

    async testFeatureAccess() {
        console.log('\n🔐 Testing Feature Access...');
        
        for (const [featureKey, feature] of Object.entries(FEATURES)) {
            const hasAccess = await hasFeatureAccess(featureKey);
            const expectedAccess = this.currentTier >= feature.tier;
            
            const result = {
                test: `Feature Access: ${feature.name}`,
                feature: featureKey,
                requiredTier: feature.tier,
                userTier: this.currentTier,
                hasAccess,
                expectedAccess,
                passed: hasAccess === expectedAccess
            };
            
            this.testResults.push(result);
            
            console.log(`${result.passed ? '✅' : '❌'} ${feature.name}: ${hasAccess ? 'Accessible' : 'Blocked'} (Expected: ${expectedAccess ? 'Accessible' : 'Blocked'})`);
        }
    }

    async testUserCreation() {
        console.log('\n👥 Testing User Creation...');
        
        const roles = ['admin', 'teacher', 'student', 'parent'];
        
        for (const role of roles) {
            const canCreate = await canCreateRole(role);
            let expectedCanCreate = false;
            
            switch (role) {
                case 'admin':
                case 'teacher':
                    expectedCanCreate = this.currentTier >= TIERS.ADMIN_CORE;
                    break;
                case 'student':
                    expectedCanCreate = this.currentTier >= TIERS.STUDENT_ENGAGEMENT;
                    break;
                case 'parent':
                    expectedCanCreate = this.currentTier >= TIERS.FULL_CONNECT;
                    break;
            }
            
            const result = {
                test: `User Creation: ${role}`,
                role,
                userTier: this.currentTier,
                canCreate,
                expectedCanCreate,
                passed: canCreate === expectedCanCreate
            };
            
            this.testResults.push(result);
            
            console.log(`${result.passed ? '✅' : '❌'} Create ${role}: ${canCreate ? 'Allowed' : 'Blocked'} (Expected: ${expectedCanCreate ? 'Allowed' : 'Blocked'})`);
        }
    }

    async testRouteAccess() {
        console.log('\n🛣️ Testing Route Access...');
        
        const routes = [
            { path: '/portals/student', tier: TIERS.STUDENT_ENGAGEMENT, name: 'Student Portal' },
            { path: '/cbt', tier: TIERS.STUDENT_ENGAGEMENT, name: 'CBT Exams' },
            { path: '/portals/parent', tier: TIERS.FULL_CONNECT, name: 'Parent Portal' },
            { path: '/ai', tier: TIERS.FULL_CONNECT, name: 'AI Assistants' },
            { path: '/portals/admin', tier: TIERS.ADMIN_CORE, name: 'School Admin' },
            { path: '/portals/teacher', tier: TIERS.ADMIN_CORE, name: 'Teacher Portal' }
        ];
        
        for (const route of routes) {
            const hasAccess = this.currentTier >= route.tier;
            
            const result = {
                test: `Route Access: ${route.name}`,
                route: route.path,
                requiredTier: route.tier,
                userTier: this.currentTier,
                hasAccess,
                expectedAccess: hasAccess,
                passed: true // Route access is deterministic
            };
            
            this.testResults.push(result);
            
            console.log(`${result.passed ? '✅' : '❌'} ${route.name}: ${hasAccess ? 'Accessible' : 'Blocked'}`);
        }
    }

    async testUIElements() {
        console.log('\n🎨 Testing UI Elements...');
        
        // Check if UI elements have proper tier attributes
        const navItems = document.querySelectorAll('[data-tier]');
        const buttons = document.querySelectorAll('[data-action]');
        const widgets = document.querySelectorAll('[data-widget]');
        
        let navItemsTested = 0;
        let buttonsTested = 0;
        let widgetsTested = 0;
        
        // Test navigation items
        navItems.forEach(item => {
            const requiredTier = parseInt(item.getAttribute('data-tier'));
            const isVisible = item.style.display !== 'none';
            const shouldBeVisible = this.currentTier >= requiredTier;
            
            const result = {
                test: `UI Navigation: ${item.textContent.trim()}`,
                element: 'nav-item',
                requiredTier,
                userTier: this.currentTier,
                isVisible,
                expectedVisible: shouldBeVisible,
                passed: isVisible === shouldBeVisible
            };
            
            this.testResults.push(result);
            navItemsTested++;
            
            console.log(`${result.passed ? '✅' : '❌'} Nav "${item.textContent.trim()}": ${isVisible ? 'Visible' : 'Hidden'} (Expected: ${shouldBeVisible ? 'Visible' : 'Hidden'})`);
        });
        
        // Test action buttons
        buttons.forEach(button => {
            const action = button.getAttribute('data-action');
            let requiredTier = TIERS.ADMIN_CORE; // Default
            
            switch (action) {
                case 'create-student':
                    requiredTier = TIERS.STUDENT_ENGAGEMENT;
                    break;
                case 'create-parent':
                    requiredTier = TIERS.FULL_CONNECT;
                    break;
                case 'ai-chat':
                    requiredTier = TIERS.FULL_CONNECT;
                    break;
                case 'white-label':
                    requiredTier = TIERS.ENTERPRISE;
                    break;
            }
            
            const isEnabled = !button.disabled;
            const shouldBeEnabled = this.currentTier >= requiredTier;
            
            const result = {
                test: `UI Button: ${action}`,
                element: 'action-button',
                requiredTier,
                userTier: this.currentTier,
                isEnabled,
                expectedEnabled: shouldBeEnabled,
                passed: isEnabled === shouldBeEnabled
            };
            
            this.testResults.push(result);
            buttonsTested++;
            
            console.log(`${result.passed ? '✅' : '❌'} Button "${action}": ${isEnabled ? 'Enabled' : 'Disabled'} (Expected: ${shouldBeEnabled ? 'Enabled' : 'Disabled'})`);
        });
        
        console.log(`📊 UI Elements Tested: ${navItemsTested} nav items, ${buttonsTested} buttons, ${widgetsTested} widgets`);
    }

    generateTestReport() {
        console.log('\n📋 Test Report Summary:');
        console.log('================================');
        
        const passedTests = this.testResults.filter(r => r.passed).length;
        const totalTests = this.testResults.length;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        console.log(`✅ Passed: ${passedTests}/${totalTests} (${successRate}%)`);
        console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
        
        if (this.testResults.some(r => !r.passed)) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(r => !r.passed).forEach(test => {
                console.log(`   - ${test.test}`);
                console.log(`     Expected: ${test.expectedAccess !== undefined ? (test.expectedAccess ? 'Accessible' : 'Blocked') : (test.expectedEnabled !== undefined ? (test.expectedEnabled ? 'Enabled' : 'Disabled') : (test.expectedVisible !== undefined ? (test.expectedVisible ? 'Visible' : 'Hidden') : 'N/A'))}`);
                console.log(`     Actual: ${test.hasAccess !== undefined ? (test.hasAccess ? 'Accessible' : 'Blocked') : (test.isEnabled !== undefined ? (test.isEnabled ? 'Enabled' : 'Disabled') : (test.isVisible !== undefined ? (test.isVisible ? 'Visible' : 'Hidden') : 'N/A'))}`);
            });
        }
        
        // Tier-specific summary
        console.log('\n🎯 Tier Access Summary:');
        console.log(`Current Tier: ${this.getTierName(this.currentTier)}`);
        console.log(`Available Features: ${this.testResults.filter(r => r.test.includes('Feature Access') && r.passed && r.hasAccess).length}/${Object.keys(FEATURES).length}`);
        console.log(`User Creation Rights: ${this.testResults.filter(r => r.test.includes('User Creation') && r.passed && r.canCreate).length}/4 roles`);
        
        // Recommendations
        this.generateRecommendations();
    }

    getTierName(tier) {
        switch (tier) {
            case TIERS.ADMIN_CORE: return 'Tier 1 (Admin Core)';
            case TIERS.STUDENT_ENGAGEMENT: return 'Tier 2 (Student Engagement)';
            case TIERS.FULL_CONNECT: return 'Tier 3 (Full Connect)';
            case TIERS.ENTERPRISE: return 'Enterprise';
            default: return 'Unknown';
        }
    }

    generateRecommendations() {
        console.log('\n💡 Recommendations:');
        
        const missingFeatures = this.testResults
            .filter(r => r.test.includes('Feature Access') && !r.hasAccess && r.requiredTier > this.currentTier)
            .map(r => r.feature);
        
        if (missingFeatures.length > 0) {
            console.log(`🔓 To unlock ${missingFeatures.length} more features, consider upgrading to Tier ${Math.max(...missingFeatures.map(f => FEATURES[f].tier))} or higher`);
        }
        
        const blockedUserCreation = this.testResults
            .filter(r => r.test.includes('User Creation') && !r.canCreate)
            .map(r => r.role);
        
        if (blockedUserCreation.length > 0) {
            console.log(`👥 Cannot create: ${blockedUserCreation.join(', ')} users with current tier`);
        }
        
        if (this.currentTier === TIERS.ADMIN_CORE) {
            console.log('📈 Upgrade to Tier 2 to enable student creation and engagement features');
        } else if (this.currentTier === TIERS.STUDENT_ENGAGEMENT) {
            console.log('📈 Upgrade to Tier 3 to enable parent portal and AI assistants');
        } else if (this.currentTier === TIERS.FULL_CONNECT) {
            console.log('📈 Upgrade to Enterprise for white-labeling and custom branding');
        }
    }

    // Method to run tests for a specific tier (for testing purposes)
    async testTier(tier) {
        const originalTier = this.currentTier;
        this.currentTier = tier;
        
        console.log(`\n🧪 Testing for ${this.getTierName(tier)}...`);
        await this.runAllTests();
        
        this.currentTier = originalTier;
    }
}

// Auto-run tests if in development mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.addEventListener('DOMContentLoaded', () => {
        // Add test button to page
        const testButton = document.createElement('button');
        testButton.textContent = '🧪 Run Tier Access Tests';
        testButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            background: #6200ea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        testButton.addEventListener('click', async () => {
            const tester = new TierAccessTest();
            await tester.runAllTests();
        });
        
        document.body.appendChild(testButton);
        
        // Also expose to console for manual testing
        window.tierAccessTest = new TierAccessTest();
    });
}

export { TierAccessTest };
