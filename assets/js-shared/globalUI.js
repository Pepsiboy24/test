import { supabase } from '../../core/config.js';

/**
 * Global UI Components - Shared UI Elements
 * Provides common loading states, modals, and UI utilities
 */

class GlobalUI {
    constructor() {
        this.loadingStates = new Map();
        this.modalQueue = [];
        this.isModalPreloaded = false;
    }

    /**
     * Initialize global UI components
     */
    initialize() {
        // Preload details modal
        this.preloadModal();
        
        // Setup global loading states
        this.setupLoadingStates();
        
        console.log('Global UI components initialized');
    }

    /**
     * Preload details modal for better UX
     */
    async preloadModal() {
        try {
            if (this.isModalPreloaded) return;
            
            // Create hidden container for modal
            const modalContainer = document.createElement('div');
            modalContainer.id = 'universalModalOverlay';
            modalContainer.style.display = 'none';
            modalContainer.style.position = 'fixed';
            modalContainer.style.top = '0';
            modalContainer.style.left = '0';
            modalContainer.style.width = '100%';
            modalContainer.style.height = '100%';
            modalContainer.style.zIndex = '9999';
            document.body.appendChild(modalContainer);

            // Load modal content
            const response = await fetch('../html/shared/details_modal.html');
            if (response.ok) {
                modalContainer.innerHTML = await response.text();
                this.isModalPreloaded = true;
                console.log('Details modal preloaded successfully');
            } else {
                console.error('Failed to preload modal');
            }
        } catch (error) {
            console.error('Error preloading modal:', error);
        }
    }

    /**
     * Setup loading states for all dynamic content
     */
    setupLoadingStates() {
        // Add global loading spinner styles
        if (!document.getElementById('globalLoadingStyles')) {
            const style = document.createElement('style');
            style.id = 'globalLoadingStyles';
            style.textContent = `
                .global-loading {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--primary-600);
                    border-radius: 50%;
                    border-top-color: var(--primary-600) transparent;
                    border-right-color: var(--primary-600) transparent;
                    border-bottom-color: var(--primary-600) transparent;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .global-loading-icon {
                    color: var(--primary-600);
                    font-size: 12px;
                }
            `;
            document.head.appendChild(style);
        }

        // Setup global modal styles
        if (!document.getElementById('globalModalStyles')) {
            const modalStyle = document.createElement('style');
            modalStyle.id = 'globalModalStyles';
            modalStyle.textContent = `
                .universalModalOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1050;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .universalModal {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    position: relative;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--border-color);
                }

                .modal-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--text-gray);
                    padding: 8px;
                    border-radius: 50%;
                    transition: background-color 0.3s ease;
                }

                .modal-close:hover {
                    background: var(--bg-gray);
                    color: white;
                }
            `;
            document.head.appendChild(modalStyle);
        }
    }

    /**
     * Show loading state
     */
    showLoading(elementId, loading = true) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (loading) {
            element.classList.add('global-loading');
            element.disabled = true;
        } else {
            element.classList.remove('global-loading');
            element.disabled = false;
        }
    }

    /**
     * Hide loading state
     */
    hideLoading(elementId) {
        this.showLoading(elementId, false);
    }

    /**
     * Show modal
     */
    showModal(content) {
        const modal = document.getElementById('universalModalOverlay');
        if (!modal) {
            console.error('Modal not found. Ensure globalUI.initialize() was called.');
            return;
        }

        const modalContent = modal.querySelector('.universalModal');
        if (modalContent) {
            modalContent.innerHTML = content;
            modal.style.display = 'flex';
        }
    }

    /**
     * Hide modal
     */
    hideModal() {
        const modal = document.getElementById('universalModalOverlay');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Create toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.global-toast');
        existingToasts.forEach(toast => toast.remove());

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `global-toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateX(100%);
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Remove after duration
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, duration);
    }
}

// Export for global use
window.GlobalUI = GlobalUI;
