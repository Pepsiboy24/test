/**
 * Parents Portal Payments - Full working version (2026)
 * Aligned with Supabase Schema: Payment_Items(item_id, amount, is_compulsory)
 */
import { waitForUser } from '/core/perf.js';

let currentStudentId = null;
let currentSchoolId = null;
let paymentItems = [];
let selectedItems = new Set();
let totalAmount = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await initializePayments();
});

// --- INITIALIZATION ---

async function initializePayments() {
    try {
        showLoading(true);

        // 1. Establish Identity & School Context
        await getCurrentStudentInfo();

        if (!currentSchoolId) {
            throw new Error('No school linked to this student profile.');
        }

        // 2. Load Data from Supabase
        await loadPaymentItems();

        try {
            await loadSchoolInfo();
        } catch (e) {
            console.warn('Minor: School branding failed to load', e);
        }

        // 3. Bind UI Events
        setupEventListeners();

    } catch (error) {
        console.error('Initialization Failed:', error);
        showError(error.message || 'Failed to load payment information.');
    } finally {
        showLoading(false);
    }
}

async function getCurrentStudentInfo() {
    try {
        // Priority 1: Sidebar Switcher
        let id = localStorage.getItem('active_student_id');

        // Priority 2: Self-Healing (Auth -> Parent -> Link -> Student)
        if (!id) {
            const user = await waitForUser();
            if (!user) throw new Error('No active session found.');

            const { data: parentData } = await window.supabase
                .from('Parents')
                .select('parent_id')
                .eq('user_id', user.id)
                .single();

            if (!parentData) throw new Error('Parent profile not found.');

            const { data: linkData } = await window.supabase
                .from('Parent_Student_Links')
                .select('student_id')
                .eq('parent_id', parentData.parent_id)
                .limit(1);

            if (linkData && linkData.length > 0) {
                id = linkData[0].student_id;
                localStorage.setItem('active_student_id', id);
            }
        }

        if (!id) throw new Error('No students linked to this account.');
        currentStudentId = id;

        // Get school_id via Class Join
        const { data: student, error } = await window.supabase
            .from('Students')
            .select('class_id, Classes(school_id)')
            .eq('student_id', currentStudentId)
            .single();

        if (error || !student?.Classes?.school_id) {
            throw new Error('Student is not assigned to a class with a valid school.');
        }

        currentSchoolId = student.Classes.school_id;
        console.log("Context Set:", { student: currentStudentId, school: currentSchoolId });

    } catch (error) {
        console.error('Identity Resolution Error:', error);
        throw error;
    }
}

// --- DATA LOADING ---

async function loadPaymentItems() {
    try {
        const { data, error } = await window.supabase
            .from('Payment_Items')
            .select('*')
            .eq('school_id', currentSchoolId)
            .eq('is_active', true)
            .order('is_compulsory', { ascending: false });

        if (error) throw error;

        paymentItems = data || [];
        renderPaymentItems();

    } catch (error) {
        console.error('Error loading payment items:', error);
        showError('Failed to load payment items.');
    }
}

async function loadSchoolInfo() {
    const { data: schoolData } = await window.supabase
        .from('Schools')
        .select('school_name, school_logo_url')
        .eq('school_id', currentSchoolId)
        .single();

    if (schoolData) {
        const nameEl = document.getElementById('schoolName');
        const logoEl = document.getElementById('schoolLogo');
        if (nameEl) nameEl.textContent = schoolData.school_name;
        if (logoEl && schoolData.school_logo_url) logoEl.src = schoolData.school_logo_url;
    }
}

// --- UI RENDERING ---

function renderPaymentItems() {
    const compulsoryContainer = document.getElementById('compulsoryItems');
    const optionalContainer = document.getElementById('optionalItems');

    // Reset Selections: Clear set then add all compulsory items
    selectedItems.clear();
    paymentItems.forEach(item => {
        if (item.is_compulsory) selectedItems.add(item.item_id);
    });

    const compulsoryItems = paymentItems.filter(item => item.is_compulsory);
    const optionalItems = paymentItems.filter(item => !item.is_compulsory);

    if (compulsoryContainer) {
        compulsoryContainer.innerHTML = compulsoryItems.length
            ? compulsoryItems.map(item => createPaymentItemHTML(item, true)).join('')
            : '<p class="empty-msg">No compulsory items for this term.</p>';
    }

    if (optionalContainer) {
        optionalContainer.innerHTML = optionalItems.length
            ? optionalItems.map(item => createPaymentItemHTML(item, false)).join('')
            : '<p class="empty-msg">No optional items available.</p>';
    }

    // This updates the summary and total immediately on load
    updateSummary();
}

function createPaymentItemHTML(item, isCompulsory) {
    const icon = getCategoryIcon(item.category);
    const isSelected = selectedItems.has(item.item_id);

    return `
        <div class="payment-item ${isSelected ? 'selected' : ''} ${isCompulsory ? 'compulsory' : ''}" 
             data-item-id="${item.item_id}"
             onclick="${isCompulsory ? '' : `toggleOptionalItem('${item.item_id}')`}">
            <div class="item-left">
                <div class="item-checkbox ${isSelected ? 'checked' : ''} ${isCompulsory ? 'disabled' : ''}">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="item-info">
                    <div class="item-icon"><i class="${icon}"></i></div>
                    <div class="item-details">
                        <div class="item-name">${item.item_name}</div>
                        ${isCompulsory ? '<div class="item-badge">Required</div>' : ''}
                    </div>
                </div>
            </div>
            <div class="item-price">₦${parseFloat(item.amount || 0).toLocaleString()}</div>
        </div>
    `;
}

// --- LOGIC & CALCULATIONS ---

function toggleOptionalItem(itemId) {
    const item = paymentItems.find(i => i.item_id === itemId);
    if (!item || item.is_compulsory) return;

    if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
    } else {
        selectedItems.add(itemId);
    }

    // UI Update
    const element = document.querySelector(`[data-item-id="${itemId}"]`);
    if (element) {
        const checkbox = element.querySelector('.item-checkbox');
        element.classList.toggle('selected');
        checkbox.classList.toggle('checked');
        checkbox.innerHTML = selectedItems.has(itemId) ? '<i class="fas fa-check"></i>' : '';
    }

    updateSummary();
}

function updateSummary() {
    const summaryItems = document.getElementById('summaryItems');
    const totalAmountElement = document.getElementById('totalAmount');
    const summarySection = document.getElementById('summarySection'); // The wrapper
    const payBtn = document.getElementById('proceedPayBtn');

    // 1. Safety Check: If HTML elements are missing, stop here
    if (!summaryItems || !totalAmountElement) {
        console.error("Summary elements missing from HTML. Check IDs 'summaryItems' and 'totalAmount'.");
        return;
    }

    // 2. Clear previous and reset total
    summaryItems.innerHTML = '';
    totalAmount = 0;

    // 3. Count selected items
    let selectedCount = 0;

    paymentItems.forEach(item => {
        if (selectedItems.has(item.item_id)) {
            selectedCount++;
            const price = parseFloat(item.amount) || 0;
            totalAmount += price;

            const row = document.createElement('div');
            row.className = 'summary-item';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.marginBottom = '8px';

            row.innerHTML = `
                <span>${item.item_name} ${item.is_compulsory ? '<small style="color:gray;">(Required)</small>' : ''}</span>
                <span style="font-weight:bold;">₦${price.toLocaleString()}</span>
            `;
            summaryItems.appendChild(row);
        }
    });

    // 4. Update the Numbers
    totalAmountElement.textContent = `₦${totalAmount.toLocaleString()}`;
    if (payBtn) payBtn.innerText = `Pay Total: ₦${totalAmount.toLocaleString()}`;

    // 5. Visibility Logic: If no items, hide the whole section
    if (summarySection) {
        summarySection.style.display = selectedCount > 0 ? 'block' : 'none';
    }
}

async function proceedToPayment() {
    // 1. SDK Check
    if (typeof window.MonnifySDK === 'undefined') {
        alert("Payment system is loading. Please wait 3 seconds.");
        return;
    }

    if (selectedItems.size === 0) {
        alert('Please select at least one item.');
        return;
    }

    try {
        const { data: school } = await window.supabase
            .from('Schools')
            .select('sub_account_code, school_name')
            .eq('school_id', currentSchoolId)
            .single();

        const user = await waitForUser();

        // 2. Data Formatting
        const cleanAmount = Number(parseFloat(totalAmount).toFixed(2));
        const customerName = (user?.user_metadata?.full_name || "Parent User").trim();

        console.log("Starting Monnify with SubAccount:", school?.sub_account_code);

        // 3. Initialize Transaction
        window.MonnifySDK.initialize({
            amount: cleanAmount,
            currency: "NGN",
            currencyCode: "NGN",    // Send both to be safe
            customerFullName: customerName,
            customerName: customerName, // Send both to be safe
            customerEmail: user?.email || "test@example.com",
            apiKey: "MK_TEST_R5D350D27T", // USE YOUR ACTUAL MK_TEST KEY
            contractCode: "8390473251",     // USE YOUR ACTUAL CONTRACT CODE
            paymentReference: "REF-" + Date.now(),
            paymentDescription: `${school?.school_name || 'School'} Fees`,
            isTestMode: true,
            metadata: {
                student_id: currentStudentId,
                school_id: currentSchoolId
            },
            // Logic: Only use split if the code is NOT null
            incomeSplitConfig: (school?.sub_account_code) ? [{
                subAccountCode: school.sub_account_code,
                feePercentage: 100,
                splitPercentage: 100
            }] : [],
            onComplete: function (response) {
                if (response.status === 'SUCCESS') {
                    window.location.href = "payment_success.html";
                }
            },
            onClose: function (data) {
                console.log("Modal closed");
            }
        });
    } catch (err) {
        console.error("Payment Error:", err);
    }
}

// --- UTILS & SIDEBAR ---

function setupEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);

    const payBtn = document.getElementById('proceedPayBtn');
    if (payBtn) payBtn.addEventListener('click', proceedToPayment);
}

function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('active');
    document.querySelector('.main-content')?.classList.toggle('sidebar-collapsed');
}

function getCategoryIcon(category) {
    const icons = {
        'tuition': 'fas fa-graduation-cap',
        'uniform': 'fas fa-tshirt',
        'books': 'fas fa-book',
        'fees': 'fas fa-file-invoice',
        'extracurricular': 'fas fa-palette',
        'transport': 'fas fa-bus',
        'accommodation': 'fas fa-home'
    };
    return icons[category] || 'fas fa-receipt';
}

function showLoading(show) {
    const ls = document.getElementById('loadingState');
    const pc = document.getElementById('paymentContent');
    if (ls) ls.style.display = show ? 'flex' : 'none';
    if (pc) pc.style.display = show ? 'none' : 'block';
}

function showError(msg) {
    alert(msg);
}

// Global Exports
window.toggleOptionalItem = toggleOptionalItem;
window.proceedToPayment = proceedToPayment;
window.toggleSidebar = toggleSidebar;