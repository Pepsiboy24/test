// EduHub Landing Page JavaScript

class LandingPage {
    constructor() {
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupSmoothScrolling();
        this.setupMobileMenu();
        this.setupAnimations();
        this.setupFormHandling();
    }

    setupNavigation() {
        // Handle scroll effects
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(255, 255, 255, 0.98)';
                navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.95)';
                navbar.style.boxShadow = 'none';
            }
        });

        // Highlight active section in navigation
        this.setupActiveNavigation();
    }

    setupActiveNavigation() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-menu a[href^="#"]');

        const observerOptions = {
            rootMargin: '-50% 0px -50% 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${entry.target.id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    const offsetTop = target.offsetTop - 70; // Account for fixed navbar
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    setupMobileMenu() {
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });

            // Close mobile menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                }
            });

            // Close mobile menu when clicking on a link
            navMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                });
            });
        }
    }

    setupAnimations() {
        // Animate elements on scroll
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                }
            });
        }, observerOptions);

        // Observe feature categories, pricing cards, and about features
        document.querySelectorAll('.feature-category, .pricing-card, .about-feature').forEach(el => {
            observer.observe(el);
        });

        // Animate stats counter
        this.setupStatsCounter();
    }

    setupStatsCounter() {
        const stats = document.querySelectorAll('.stat-number');
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                    this.animateCounter(entry.target);
                    entry.target.classList.add('counted');
                }
            });
        }, { threshold: 0.5 });

        stats.forEach(stat => statsObserver.observe(stat));
    }

    animateCounter(element) {
        const target = element.textContent;
        const number = parseInt(target.replace(/\D/g, ''));
        const suffix = target.replace(/\d/g, '');
        let current = 0;
        const increment = number / 50;
        const timer = setInterval(() => {
            current += increment;
            if (current >= number) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current) + suffix;
            }
        }, 30);
    }

    setupFormHandling() {
        // Handle plan selection from URL parameters
        this.handlePlanSelection();
        
        // Setup contact forms if they exist
        this.setupContactForms();
    }

    handlePlanSelection() {
        const urlParams = new URLSearchParams(window.location.search);
        const plan = urlParams.get('plan');
        
        if (plan) {
            // Store selected plan in sessionStorage for signup page
            sessionStorage.setItem('selectedPlan', plan);
            
            // Highlight the selected pricing card
            document.querySelectorAll('.pricing-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            const planMap = {
                'admin-core': 'Admin Core',
                'student-engagement': 'Student Engagement',
                'full-connect': 'Full Connect'
            };
            
            const planName = planMap[plan];
            if (planName) {
                const selectedCard = document.querySelector(`.pricing-card h3:contains("${planName}")`)?.closest('.pricing-card');
                if (selectedCard) {
                    selectedCard.classList.add('selected');
                }
            }
        }
    }

    setupContactForms() {
        // Contact form handling (if contact form exists)
        const contactForm = document.querySelector('#contactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleContactSubmission(e.target);
            });
        }

        // Newsletter signup (if exists)
        const newsletterForm = document.querySelector('#newsletterForm');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNewsletterSubmission(e.target);
            });
        }
    }

    async handleContactSubmission(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Here you would typically send this to your backend
            console.log('Contact form submission:', data);
            
            // Show success message
            this.showMessage('Thank you for your message! We\'ll get back to you soon.', 'success');
            form.reset();
            
        } catch (error) {
            console.error('Contact form error:', error);
            this.showMessage('Sorry, there was an error sending your message. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async handleNewsletterSubmission(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Subscribing...';
            
            const formData = new FormData(form);
            const email = formData.get('email');
            
            // Here you would typically send this to your backend
            console.log('Newsletter signup:', email);
            
            // Show success message
            this.showMessage('Thank you for subscribing to our newsletter!', 'success');
            form.reset();
            
        } catch (error) {
            console.error('Newsletter signup error:', error);
            this.showMessage('Sorry, there was an error subscribing. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    showMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessage = document.querySelector('.message-toast');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message-toast ${type}`;
        messageEl.textContent = message;
        
        // Add styles
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(messageEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                messageEl.remove();
                style.remove();
            }, 300);
        }, 5000);
    }

    // Utility method to check if user is authenticated
    async checkAuthStatus() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            return { user, error };
        } catch (error) {
            console.error('Auth check error:', error);
            return { user: null, error };
        }
    }

    // Update UI based on auth status
    async updateAuthUI() {
        const { user } = await this.checkAuthStatus();
        
        const signInBtn = document.querySelector('a[href="login.html"]');
        const signUpBtn = document.querySelector('a[href="signup.html"]');
        
        if (user) {
            // User is authenticated, show dashboard link
            if (signInBtn) {
                signInBtn.textContent = 'Dashboard';
                signInBtn.href = this.getDashboardUrl(user);
            }
            if (signUpBtn) {
                signUpBtn.textContent = 'Sign Out';
                signUpBtn.href = '#';
                signUpBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleSignOut();
                });
            }
        }
    }

    getDashboardUrl(user) {
        const userType = user.user_metadata?.user_type;
        const schoolId = user.user_metadata?.school_id;
        
        switch (userType) {
            case 'school_admin':
                return schoolId ? '../../html/schoolAdmin/schoolAdminDashboard.html' : 'onboarding.html';
            case 'teacher':
                return '../../html/teachersPortal/teachersPortalDashboard.html';
            case 'student':
                return '../../html/studentsPortal/studentsPortalDashboard.html';
            case 'parent':
                return '../../html/parentsPortal/parentsPortalDashboard.html';
            default:
                return 'onboarding.html';
        }
    }

    async handleSignOut() {
        try {
            await supabase.auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error('Sign out error:', error);
            this.showMessage('Error signing out. Please try again.', 'error');
        }
    }
}

// Initialize landing page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new LandingPage();
});

// Add CSS for animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    .feature-category,
    .pricing-card,
    .about-feature {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }
    
    .feature-category.animate,
    .pricing-card.animate,
    .about-feature.animate {
        opacity: 1;
        transform: translateY(0);
    }
    
    .pricing-card.selected {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(98, 0, 234, 0.1);
    }
    
    .nav-menu.active {
        display: flex !important;
        flex-direction: column;
        position: absolute;
        top: 70px;
        left: 0;
        right: 0;
        background: white;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 20px;
        gap: 15px;
    }
    
    .nav-toggle.active {
        color: var(--primary-color);
    }
    
    .nav-menu a.active {
        color: var(--primary-color);
        font-weight: 600;
    }
    
    @media (max-width: 768px) {
        .nav-menu {
            display: none;
        }
    }
`;
document.head.appendChild(animationStyles);
