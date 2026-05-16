// Payment Configuration JavaScript
// Handles CRUD operations for Payment_Items table

let currentSchoolId = null;
let currentAdminId = null;
let paymentItems = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    await initializePaymentConfig();
});

async function initializePaymentConfig() {
    try {
        // Get current admin info
        currentAdminId = await getCurrentAdminId();
        
        if (!currentAdminId) {
            showError('Unable to identify admin user. Please log in again.');
            return;
        }

        // Setup event listeners
        setupEventListeners();
        
        // Get school ID
        await getSchoolId();
        
        // Load payment items
        await loadPaymentItems();
        
    } catch (error) {
        console.error('Error initializing payment config:', error);
        showError('Failed to load payment configuration. Please refresh the page.');
    }
}

async function getCurrentAdminId() {
    try {
        const adminId = localStorage.getItem('admin_id') || 
                       sessionStorage.getItem('admin_id') ||
                       window.currentAdminId;
        
        if (!adminId) {
            const { data: { user } } = await window.supabase.auth.getUser();
            return user?.id;
        }
        
        return adminId;
    } catch (error) {
        console.error('Error getting admin ID:', error);
        return null;
    }
}

async function getSchoolId() {
    try {
        const { data: adminData, error } = await window.supabase
            .from('School_Admin')
            .select('school_id')
            .eq('admin_id', currentAdminId)
            .maybeSingle(); // Use maybeSingle to prevent errors if no row exists

        // If the column was deleted or is empty, we set it to null instead of crashing
        currentSchoolId = adminData?.school_id || null;
        
        console.log('[Payment Config] Operating in Global/Aggregator mode:', !currentSchoolId);
        
    } catch (error) {
        console.warn('Note: No specific school linked. Admin will see global items.');
        currentSchoolId = null;
    }
}

function setupEventListeners() {
    // Form submission
    const form = document.getElementById('paymentItemForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', handleFilter);
    });

    // Modal close on outside click
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
                closeDeleteModal();
            }
        });
    });
}

async function loadPaymentItems() {
    try {
        showLoading(true, 'Loading payment items...');
        
        let query = window.supabase.from('Payment_Items').select('*');

        // Only filter if a specific school ID exists
        if (currentSchoolId) {
            query = query.eq('school_id', currentSchoolId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        paymentItems = data || [];
        renderPaymentItems();
        updateStats();
        
    } catch (error) {
        console.error('Error loading payment items:', error);
        showError('Failed to load payment items.');
    } finally {
        showLoading(false);
    }
}

function renderPaymentItems() {
    const tbody = document.getElementById('paymentItemsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (paymentItems.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    const filteredItems = getFilteredItems();
    
    if (filteredItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state" style="padding: 32px;">
                        <i class="fas fa-search" style="font-size: 32px; color: var(--text-muted); margin-bottom: 16px;"></i>
                        <h4>No items found</h4>
                        <p>Try adjusting your search or filter criteria.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredItems.map(item => createPaymentItemRow(item)).join('');
}

function createPaymentItemRow(item) {
    return `
        <tr>
            <td>
                <div class="item-name">${item.item_name}</div>
                ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
            </td>
            <td>
                <span class="item-category">${item.category || 'other'}</span>
            </td>
            <td>
                <div class="item-price">₦${parseFloat(item.price).toLocaleString()}</div>
            </td>
            <td>
                <span class="item-type ${item.is_compulsory ? 'type-compulsory' : 'type-optional'}">
                    ${item.is_compulsory ? 'Compulsory' : 'Optional'}
                </span>
            </td>
            <td>
                <span class="item-status ${item.is_active ? 'status-active' : 'status-inactive'}">
                    ${item.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editPaymentItem('${item.payment_item_id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deletePaymentItem('${item.payment_item_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function getFilteredItems() {
    let filtered = [...paymentItems];
    
    // Apply filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(item => {
            if (currentFilter === 'compulsory') return item.is_compulsory;
            if (currentFilter === 'optional') return !item.is_compulsory;
            return true;
        });
    }
    
    // Apply search
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.item_name.toLowerCase().includes(searchTerm) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );
    }
    
    return filtered;
}

function updateStats() {
    const totalItems = paymentItems.length;
    const compulsoryItems = paymentItems.filter(item => item.is_compulsory).length;
    
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('compulsoryItems').textContent = compulsoryItems;
}

function handleSearch() {
    renderPaymentItems();
}

function handleFilter(e) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    currentFilter = e.target.dataset.filter;
    renderPaymentItems();
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add Payment Item';
    document.getElementById('paymentItemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('isCompulsory').checked = false;
    document.getElementById('isActive').checked = true;
    document.getElementById('paymentItemModal').style.display = 'flex';
}

function editPaymentItem(itemId) {
    const item = paymentItems.find(i => i.payment_item_id === itemId);
    if (!item) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Payment Item';
    document.getElementById('itemId').value = item.payment_item_id;
    document.getElementById('itemName').value = item.item_name;
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('isCompulsory').checked = item.is_compulsory;
    document.getElementById('isActive').checked = item.is_active;
    
    document.getElementById('paymentItemModal').style.display = 'flex';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    try {
        showLoading(true, 'Saving payment item...');
        
        const formData = {
            item_name: document.getElementById('itemName').value.trim(),
            category: document.getElementById('itemCategory').value,
            price: parseFloat(document.getElementById('itemPrice').value),
            description: document.getElementById('itemDescription').value.trim(),
            is_compulsory: document.getElementById('isCompulsory').checked,
            is_active: document.getElementById('isActive').checked,
            school_id: currentSchoolId
        };
        
        // Validate required fields
        if (!formData.item_name || !formData.category || isNaN(formData.price) || formData.price < 0) {
            showError('Please fill in all required fields with valid values.');
            return;
        }
        
        const itemId = document.getElementById('itemId').value;
        
        if (itemId) {
            // Update existing item
            const { error } = await window.supabase
                .from('Payment_Items')
                .update(formData)
                .eq('payment_item_id', itemId);
            
            if (error) throw error;
            
            showSuccess('Payment item updated successfully!');
        } else {
            // Create new item
            const { error } = await window.supabase
                .from('Payment_Items')
                .insert([formData]);
            
            if (error) throw error;
            
            showSuccess('Payment item added successfully!');
        }
        
        closeModal();
        await loadPaymentItems();
        
    } catch (error) {
        console.error('Error saving payment item:', error);
        showError('Failed to save payment item. Please try again.');
    } finally {
        showLoading(false);
    }
}

function deletePaymentItem(itemId) {
    const item = paymentItems.find(i => i.payment_item_id === itemId);
    if (!item) return;
    
    document.getElementById('deleteItemName').textContent = item.item_name;
    document.getElementById('deleteModal').style.display = 'flex';
    
    // Store item ID for deletion
    window.itemToDelete = itemId;
}

async function confirmDelete() {
    try {
        showLoading(true, 'Deleting payment item...');
        
        const { error } = await window.supabase
            .from('Payment_Items')
            .delete()
            .eq('payment_item_id', window.itemToDelete);
        
        if (error) throw error;
        
        showSuccess('Payment item deleted successfully!');
        closeDeleteModal();
        await loadPaymentItems();
        
    } catch (error) {
        console.error('Error deleting payment item:', error);
        showError('Failed to delete payment item. Please try again.');
    } finally {
        showLoading(false);
        delete window.itemToDelete;
    }
}

function closeModal() {
    document.getElementById('paymentItemModal').style.display = 'none';
    document.getElementById('paymentItemForm').reset();
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    delete window.itemToDelete;
}

function showLoading(show, text = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
    
    if (loadingText) {
        loadingText.textContent = text;
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

// Export functions for global access
window.openAddModal = openAddModal;
window.editPaymentItem = editPaymentItem;
window.deletePaymentItem = deletePaymentItem;
window.confirmDelete = confirmDelete;
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;
