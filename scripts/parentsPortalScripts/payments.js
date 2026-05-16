// Parents Portal Payments JavaScript
// Handles dynamic payment items from Payment_Items table

let currentStudentId = null;
let currentSchoolId = null;
let paymentItems = [];
let selectedItems = new Set();
let totalAmount = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await initializePayments();
});

async function initializePayments() {
    try {
        // Get current student info
        await getCurrentStudentInfo();
        
        // Load payment items
        await loadPaymentItems();
        
        // Load school info
        await loadSchoolInfo();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing payments:', error);
        showError('Failed to load payment information. Please refresh the page.');
    }
}

async function getCurrentStudentInfo() {
    try {
        // Get student ID from localStorage or auth
        currentStudentId = localStorage.getItem('student_id') || 
                          sessionStorage.getItem('student_id') ||
                          window.currentStudentId;
        
        if (!currentStudentId) {
            // Try to get from auth context
            const { data: { user } } = await window.supabase.auth.getUser();
            if (user) {
                // Find student record by auth user ID
                const { data: studentData } = await window.supabase
                    .from('Students')
                    .select('student_id, class_id')
                    .eq('student_id', user.id)
                    .single();
                
                if (studentData) {
                    currentStudentId = studentData.student_id;
                }
            }
        }
        
        if (!currentStudentId) {
            throw new Error('Unable to identify student. Please log in again.');
        }
        
        // Get school ID from student record
        const { data: studentData, error } = await window.supabase
            .from('Students')
            .select('class_id')
            .eq('student_id', currentStudentId)
            .single();

        if (error) throw error;
        
        // Get school ID from class
        const { data: classData, error: classError } = await window.supabase
            .from('Classes')
            .select('school_id')
            .eq('class_id', studentData.class_id)
            .single();

        if (classError) throw classError;
        
        currentSchoolId = classData.school_id;
        
    } catch (error) {
        console.error('Error getting student info:', error);
        throw error;
    }
}

async function loadPaymentItems() {
    try {
        showLoading(true);
        
        const { data, error } = await window.supabase
            .from('Payment_Items')
            .select('*')
            .eq('school_id', currentSchoolId)
            .eq('is_active', true)
            .order('is_compulsory', { ascending: false })
            .order('item_name');

        if (error) throw error;

        paymentItems = data || [];
        renderPaymentItems();
        
    } catch (error) {
        console.error('Error loading payment items:', error);
        showError('Failed to load payment items.');
        paymentItems = [];
        renderPaymentItems();
    } finally {
        showLoading(false);
    }
}

async function loadSchoolInfo() {
    try {
        const { data: schoolData, error } = await window.supabase
            .from('Schools')
            .select('school_name, logo_url')
            .eq('school_id', currentSchoolId)
            .single();

        if (error) throw error;
        
        // Update school info in header
        const schoolName = document.getElementById('schoolName');
        const schoolLogo = document.getElementById('schoolLogo');
        
        if (schoolName) {
            schoolName.textContent = schoolData.school_name || 'School Name';
        }
        
        if (schoolLogo && schoolData.logo_url) {
            schoolLogo.src = schoolData.logo_url;
        }
        
    } catch (error) {
        console.error('Error loading school info:', error);
        // Don't throw error, just use defaults
    }
}

function renderPaymentItems() {
    const loadingState = document.getElementById('loadingState');
    const paymentContent = document.getElementById('paymentContent');
    const emptyState = document.getElementById('emptyState');
    const compulsorySection = document.getElementById('compulsorySection');
    const optionalSection = document.getElementById('optionalSection');
    const summarySection = document.getElementById('summarySection');
    
    // Hide loading, show content
    loadingState.style.display = 'none';
    paymentContent.style.display = 'block';
    
    if (paymentItems.length === 0) {
        emptyState.style.display = 'block';
        compulsorySection.style.display = 'none';
        optionalSection.style.display = 'none';
        summarySection.style.display = 'none';
        return;
    }
    
    // Separate compulsory and optional items
    const compulsoryItems = paymentItems.filter(item => item.is_compulsory);
    const optionalItems = paymentItems.filter(item => !item.is_compulsory);
    
    // Render compulsory items
    const compulsoryContainer = document.getElementById('compulsoryItems');
    if (compulsoryItems.length > 0) {
        compulsorySection.style.display = 'block';
        compulsoryContainer.innerHTML = compulsoryItems.map(item => createPaymentItemHTML(item, true)).join('');
        
        // Automatically select all compulsory items
        compulsoryItems.forEach(item => {
            selectedItems.add(item.payment_item_id);
        });
    } else {
        compulsorySection.style.display = 'none';
    }
    
    // Render optional items
    const optionalContainer = document.getElementById('optionalItems');
    if (optionalItems.length > 0) {
        optionalSection.style.display = 'block';
        optionalContainer.innerHTML = optionalItems.map(item => createPaymentItemHTML(item, false)).join('');
    } else {
        optionalSection.style.display = 'none';
    }
    
    // Update summary
    updateSummary();
    
    // Show summary if there are any items
    if (paymentItems.length > 0) {
        summarySection.style.display = 'block';
    }
}

function createPaymentItemHTML(item, isCompulsory) {
    const icon = getCategoryIcon(item.category);
    const isSelected = isCompulsory || selectedItems.has(item.payment_item_id);
    
    return `
        <div class="payment-item ${isSelected ? 'selected' : ''} ${isCompulsory ? 'compulsory' : ''}" 
             data-item-id="${item.payment_item_id}"
             data-price="${item.price}"
             data-name="${item.item_name}"
             onclick="${isCompulsory ? '' : `toggleOptionalItem('${item.payment_item_id}')`}">
            <div class="item-left">
                <div class="item-checkbox ${isSelected ? 'checked' : ''} ${isCompulsory ? 'disabled' : ''}">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="item-info">
                    <div class="item-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="item-details">
                        <div class="item-name">${item.item_name}</div>
                        ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
                        ${isCompulsory ? '<div class="item-badge">Compulsory</div>' : ''}
                    </div>
                </div>
            </div>
            <div class="item-price">₦${parseFloat(item.price).toLocaleString()}</div>
        </div>
    `;
}

function getCategoryIcon(category) {
    const icons = {
        'tuition': 'fas fa-graduation-cap',
        'uniform': 'fas fa-tshirt',
        'books': 'fas fa-book',
        'fees': 'fas fa-file-invoice',
        'extracurricular': 'fas fa-palette',
        'transport': 'fas fa-bus',
        'accommodation': 'fas fa-home',
        'other': 'fas fa-receipt'
    };
    
    return icons[category] || icons.other;
}

function toggleOptionalItem(itemId) {
    const item = paymentItems.find(i => i.payment_item_id === itemId);
    if (!item || item.is_compulsory) return;
    
    const element = document.querySelector(`[data-item-id="${itemId}"]`);
    const checkbox = element.querySelector('.item-checkbox');
    
    if (selectedItems.has(itemId)) {
        // Unselect item
        selectedItems.delete(itemId);
        element.classList.remove('selected');
        checkbox.classList.remove('checked');
        checkbox.innerHTML = '';
    } else {
        // Select item
        selectedItems.add(itemId);
        element.classList.add('selected');
        checkbox.classList.add('checked');
        checkbox.innerHTML = '<i class="fas fa-check"></i>';
    }
    
    updateSummary();
}

function updateSummary() {
    const summaryItems = document.getElementById('summaryItems');
    const totalAmountElement = document.getElementById('totalAmount');
    
    // Clear current summary
    summaryItems.innerHTML = '';
    
    // Calculate total
    totalAmount = 0;
    
    paymentItems.forEach(item => {
        if (selectedItems.has(item.payment_item_id)) {
            totalAmount += parseFloat(item.price);
            
            // Add to summary
            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';
            summaryItem.innerHTML = `
                <span>${item.item_name}</span>
                <span>₦${parseFloat(item.price).toLocaleString()}</span>
            `;
            summaryItems.appendChild(summaryItem);
        }
    });
    
    // Update total
    totalAmountElement.textContent = `₦${totalAmount.toLocaleString()}`;
}

function proceedToPayment() {
    if (selectedItems.size === 0) {
        showError('Please select at least one payment item.');
        return;
    }
    
    // Get selected items details
    const selectedPaymentItems = paymentItems.filter(item => 
        selectedItems.has(item.payment_item_id)
    );
    
    // Store payment data for processing
    const paymentData = {
        student_id: currentStudentId,
        school_id: currentSchoolId,
        items: selectedPaymentItems,
        total_amount: totalAmount,
        created_at: new Date().toISOString()
    };
    
    // Store in sessionStorage for payment processing page
    sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    
    // Navigate to payment processing page
    // You can implement this based on your payment flow
    alert(`Proceeding to payment for ₦${totalAmount.toLocaleString()}\n\nItems: ${selectedPaymentItems.length}\n\nPayment processing would be implemented here.`);
    
    console.log('Payment data:', paymentData);
}

function setupEventListeners() {
    // Menu toggle
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
}

function showLoading(show) {
    const loadingState = document.getElementById('loadingState');
    const paymentContent = document.getElementById('paymentContent');
    
    if (loadingState && paymentContent) {
        loadingState.style.display = show ? 'flex' : 'none';
        paymentContent.style.display = show ? 'none' : 'block';
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

function getCategoryDisplayName(category) {
    const names = {
        'tuition': 'Tuition',
        'uniform': 'Uniform',
        'books': 'Books & Materials',
        'fees': 'School Fees',
        'extracurricular': 'Extracurricular',
        'transport': 'Transportation',
        'accommodation': 'Accommodation',
        'other': 'Other'
    };
    
    return names[category] || names.other;
}

// Export functions for global access
window.toggleOptionalItem = toggleOptionalItem;
window.proceedToPayment = proceedToPayment;
window.toggleSidebar = toggleSidebar;
