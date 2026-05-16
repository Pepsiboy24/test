import { supabase } from '../../core/config.js';

/**
 * Account Recovery - Password Reset Workflow
 * Handles forgot password functionality with secure token-based reset
 */

class AuthRecovery {
    constructor() {
        this.resetTokens = new Map(); // Store reset tokens temporarily
    }

    /**
     * Initialize password reset
     */
    async initialize() {
        try {
            console.log('Auth Recovery system initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Auth Recovery:', error);
            return false;
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        try {
            // Validate email format
            if (!this.isValidEmail(email)) {
                return {
                    success: false,
                    error: 'Invalid email address format'
                };
            }

            // Check if user exists
            const { data: existingUsers, error: userError } = await supabase
                .from('School_Admin')
                .or('Teachers')
                .or('Parents')
                .select('email')
                .eq('email', email);

            if (userError) throw userError;

            const userExists = existingUsers && existingUsers.length > 0;

            // Generate secure reset token
            const resetToken = this.generateSecureToken();
            this.resetTokens.set(email, {
                token: resetToken,
                expires: Date.now() + (60 * 60 * 1000), // 1 hour expiry
                attempts: 0
            });

            // Send reset email (placeholder - would use email service)
            const resetData = {
                email: email,
                token: resetToken,
                resetLink: `${window.location.origin}/reset_password.html?token=${resetToken}`,
                expiryMinutes: 60
            };

            console.log('Password reset requested for:', email);
            console.log('Reset token:', resetToken);

            // In production, this would send via email service:
            // await supabase.functions.invoke('send-password-reset', { body: resetData });

            return {
                success: true,
                message: userExists 
                    ? 'Password reset link sent to your email. Please check your inbox.' 
                    : 'If an account exists with this email, you will receive a reset link.',
                token: resetToken,
                email: email
            };
        } catch (error) {
            console.error('Error requesting password reset:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reset password with token
     */
    async resetPassword(token, newPassword, confirmPassword) {
        try {
            // Validate token
            const storedData = this.resetTokens.get(token);
            if (!storedData) {
                return {
                    success: false,
                    error: 'Invalid or expired reset token'
                };
            }

            // Check expiry
            if (Date.now() > storedData.expires) {
                return {
                    success: false,
                    error: 'Reset token has expired. Please request a new password reset.'
                };
            }

            // Check attempts
            if (storedData.attempts >= 3) {
                return {
                    success: false,
                    error: 'Too many reset attempts. Please request a new password reset.'
                };
            }

            // Validate passwords
            if (newPassword !== confirmPassword) {
                return {
                    success: false,
                    error: 'Passwords do not match'
                };
            }

            if (!this.isValidPassword(newPassword)) {
                return {
                    success: false,
                    error: 'Password must be at least 8 characters long and contain letters, numbers, and symbols'
                };
            }

            // Find user by email
            const { data: users, error: userError } = await supabase
                .from('School_Admin')
                .or('Teachers')
                .or('Parents')
                .select('id, email')
                .eq('email', storedData.email);

            if (userError) throw userError;

            const user = users.find(u => u.email === storedData.email);
            if (!user) {
                return {
                    success: false,
                    error: 'No account found with this email address'
                };
            }

            // Update password
            const { error: updateError } = await supabase.auth.admin.updateUser({
                email: storedData.email,
                password: newPassword
            });

            if (updateError) throw updateError;

            // Clean up token
            this.resetTokens.delete(token);

            console.log('Password reset successful for:', storedData.email);

            return {
                success: true,
                message: 'Password has been reset successfully. You can now login with your new password.',
                email: storedData.email
            };
        } catch (error) {
            console.error('Error resetting password:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate password strength
     */
    isValidPassword(password) {
        // At least 8 characters, contain letters, numbers, and symbols
        const minLength = 8;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSymbol = /[!@#$%^&*]/.test(password);
        
        return password.length >= minLength && hasLetter && hasNumber && hasSymbol;
    }

    /**
     * Generate secure reset token
     */
    generateSecureToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array, array);
        
        // Convert to hex string
        const token = Array.from(array)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
        
        return token;
    }

    /**
     * Clean expired tokens
     */
    cleanupExpiredTokens() {
        const now = Date.now();
        for (const [email, data] of this.resetTokens.entries()) {
            if (now > data.expires) {
                this.resetTokens.delete(email);
            }
        }
    }
}

// Export for global use
window.AuthRecovery = AuthRecovery;
