// Payment Configuration JavaScript
import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

// State Management
let paymentItems = [];
let currentSchoolId = null;

// DOM Elements
const totalItemsEl = document.getElementById('totalItems');
const compulsoryItemsEl = document.getElementById('compulsoryItems');
const itemsTableBody = document.getElementById('paymentItemsTableBody');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initializePaymentConfig();
});

async function initializePaymentConfig() {
    try {
        // Get authenticated user and school_id
        const user = await waitForUser();
        if (!user?.user_metadata?.school_id) {
            console.error('Cannot determine school_id from user metadata');
            showError('Authentication error - please log in again.');
            return;
        }
        currentSchoolId = user.user_metadata.school_id;

        // Load payment items
        await loadPaymentItems();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing payment config:', error);
        showError('Failed to load payment configuration.');
    }
}

async function loadPaymentItems() {
    try {
        console.log('Loading payment items for school_id:', currentSchoolId);
        
        const { data, error } = await supabase
            .from('Payment_Items')
            .select('*')
            .eq('school_id', currentSchoolId)
            .order('item_name');

        if (error) throw error;

        paymentItems = data || [];
        console.log('Loaded payment items:', paymentItems);
        
        updateStats();
        renderPaymentItems();
        
    } catch (error) {
        console.error('Error loading payment items:', error);
        showError('Failed to load payment items.');
    }
}

function updateStats() {
    const totalItems = paymentItems.length;
    const compulsoryItems = paymentItems.filter(item => item.is_compulsory).length;

    if (totalItemsEl) totalItemsEl.textContent = totalItems;
    if (compulsoryItemsEl) compulsoryItemsEl.textContent = compulsoryItems;
}

function renderPaymentItems(filteredItems = null) {
    const itemsToRender = filteredItems || paymentItems;
    
    console.log('Rendering payment items, table body found:', !!itemsTableBody);
    console.log('Payment items to render:', itemsToRender.length);
    
    if (!itemsTableBody) {
        console.error('Table body element not found!');
        return;
    }

    if (itemsToRender.length === 0) {
        const searchInput = document.getElementById('searchInput');
        const hasSearch = searchInput && searchInput.value.trim();
        const activeFilter = document.querySelector('.filter-btn.active');
        const isFiltered = activeFilter && activeFilter.dataset.filter !== 'all';
        
        console.log('No payment items to display, showing empty message');
        itemsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                    ${hasSearch || isFiltered ? 
                        'No items match your search/filter criteria.' : 
                        'No payment items found. Click "Add Item" to create your first payment item.'}
                </td>
            </tr>
        `;
        return;
    }

    itemsTableBody.innerHTML = itemsToRender.map(item => `
        <tr>
            <td>${item.item_name}</td>
            <td>${item.category || 'General'}</td>
            <td>¥${item.amount.toFixed(2)}</td>
            <td>
                <span class="badge ${item.is_compulsory ? 'badge-success' : 'badge-secondary'}">
                    ${item.is_compulsory ? 'Compulsory' : 'Optional'}
                </span>
            </td>
            <td>${item.description || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editItem('${item.item_id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.item_id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterPaymentItems(filterType = null) {
    let filtered = [...paymentItems];
    
    // Apply type filter
    if (filterType && filterType !== 'all') {
        filtered = filtered.filter(item => {
            if (filterType === 'compulsory') return item.is_compulsory;
            if (filterType === 'optional') return !item.is_compulsory;
            return true;
        });
    }
    
    // Apply search filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filtered = filtered.filter(item => 
            item.item_name.toLowerCase().includes(searchTerm) ||
            (item.category && item.category.toLowerCase().includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm))
        );
    }
    
    renderPaymentItems(filtered);
}

function setupEventListeners() {
    // Payment item form submission
    const form = document.getElementById('paymentItemForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            e.target.classList.add('active');
            
            const filterType = e.target.dataset.filter;
            filterPaymentItems(filterType);
        });
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterPaymentItems();
        });
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    try {
        const itemId = document.getElementById('itemId').value;
        const formData = {
            school_id: currentSchoolId,
            item_name: document.getElementById('itemName').value,
            category: document.getElementById('itemCategory').value,
            amount: parseFloat(document.getElementById('itemPrice').value),
            is_compulsory: document.getElementById('isCompulsory').checked,
            description: document.getElementById('itemDescription').value
        };

        let result;
        if (itemId) {
            // Update existing item
            result = await supabase
                .from('Payment_Items')
                .update(formData)
                .eq('item_id', itemId);
        } else {
            // Add new item
            result = await supabase
                .from('Payment_Items')
                .insert([formData]);
        }

        if (result.error) throw result.error;

        showSuccess(`Payment item ${itemId ? 'updated' : 'added'} successfully!`);
        closeModal();
        await loadPaymentItems();
        
    } catch (error) {
        console.error('Error saving payment item:', error);
        showError(`Failed to ${itemId ? 'update' : 'add'} payment item.`);
    }
}

window.deleteItem = function(itemId) {
    try {
        // Find the item in our local array to get name instantly (no DB call needed)
        const item = paymentItems.find(item => item.item_id === itemId);
        
        // Populate delete modal immediately
        const modal = document.getElementById('deleteModal');
        const itemNameEl = document.getElementById('deleteItemName');
        const deleteItemIdEl = document.getElementById('deleteItemId');
        
        if (modal && itemNameEl && deleteItemIdEl) {
            itemNameEl.textContent = item ? item.item_name : 'Unknown Item';
            deleteItemIdEl.value = itemId;
            modal.style.display = 'flex';
        }
        
    } catch (error) {
        console.error('Error preparing delete modal:', error);
        showError('Failed to prepare delete confirmation.');
    }
}

// Modal Functions
window.openAddModal = function() {
    const modal = document.getElementById('paymentItemModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('paymentItemForm');
    
    if (modal && modalTitle && form) {
        modalTitle.textContent = 'Add Payment Item';
        form.reset();
        document.getElementById('itemId').value = '';
        modal.style.display = 'flex';
    }
};

window.closeModal = function() {
    const modal = document.getElementById('paymentItemModal');
    if (modal) modal.style.display = 'none';
};

window.editItem = async function(itemId) {
    try {
        const { data, error } = await supabase
            .from('Payment_Items')
            .select('*')
            .eq('item_id', itemId)
            .single();

        if (error) throw error;

        // Populate edit form
        const modal = document.getElementById('paymentItemModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('paymentItemForm');
        
        if (modal && modalTitle && form) {
            modalTitle.textContent = 'Edit Payment Item';
            document.getElementById('itemId').value = data.item_id;
            document.getElementById('itemName').value = data.item_name;
            document.getElementById('itemCategory').value = data.category || 'General';
            document.getElementById('itemPrice').value = data.amount;
            document.getElementById('isCompulsory').checked = data.is_compulsory;
            document.getElementById('itemDescription').value = data.description || '';
            
            modal.style.display = 'flex';
        }
        
    } catch (error) {
        console.error('Error loading item for edit:', error);
        showError('Failed to load item details.');
    }
};

// Delete Modal Functions
window.confirmDelete = async function() {
    const itemId = document.getElementById('deleteItemId').value;
    if (!itemId) return;

    try {
        const { error } = await supabase
            .from('Payment_Items')
            .delete()
            .eq('item_id', itemId);

        if (error) throw error;

        showSuccess('Payment item deleted successfully!');
        closeDeleteModal();
        await loadPaymentItems();
        
    } catch (error) {
        console.error('Error deleting payment item:', error);
        showError('Failed to delete payment item.');
    }
};

window.closeDeleteModal = function() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
};

// Utility Functions
function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    if (successEl && successText) {
        successText.textContent = message;
        successEl.style.display = 'flex';
        
        setTimeout(() => {
            successEl.style.display = 'none';
        }, 3000);
    }
}

function showError(message) {
    // You can implement an error display similar to showSuccess
    console.error(message);
    alert(message); // Fallback to alert for now
}
