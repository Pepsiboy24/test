// Payment Configuration JavaScript
import { waitForUser, debounce } from '/core/perf.js';
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
        currentAdminId = await getCurrentAdminId();

        if (!currentAdminId) {
            showError('Unable to identify admin user. Please log in again.');
            return;
        }

        setupEventListeners();
        await getSchoolId();
        if (!currentSchoolId) {
            console.warn('Strict Guard: No school_id found. Execution blocked.');
            return;
        }
        await loadPaymentItems();

    } catch (error) {
        console.error('Error initializing payment config:', error);
        showError('Failed to load payment configuration.');
    }
}

async function getCurrentAdminId() {
    try {
        const user = await waitForUser();
        return user?.id;
    } catch (error) {
        console.error('Error getting admin ID:', error);
        return null;
    }
}

async function getSchoolId() {
    try {
        const user = await waitForUser();
        currentSchoolId = user?.user_metadata?.school_id;

        if (!currentSchoolId) {
            const { data: adminData } = await window.supabase
                .from('School_Admin')
                .select('school_id')
                .eq('admin_id', currentAdminId)
                .maybeSingle();
            currentSchoolId = adminData?.school_id;
        }
    } catch (error) {
        console.warn('Note: No specific school linked.');
        currentSchoolId = null;
    }
}

function setupEventListeners() {
    const form = document.getElementById('paymentItemForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', debounce( handleSearch, 300));

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', handleFilter);
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
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
    } finally {
        showLoading(false);
    }
}

function renderPaymentItems() {
    const tbody = document.getElementById('paymentItemsTableBody');
    const emptyState = document.getElementById('emptyState');
    const filteredItems = getFilteredItems();

    if (paymentItems.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = filteredItems.map(item => `
        <tr>
            <td>
                <div class="item-name">${item.item_name}</div>
                ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
            </td>
            <td><span class="item-category">${item.category || 'other'}</span></td>
            <td><div class="item-price">₦${parseFloat(item.amount || 0).toLocaleString()}</div></td>
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
                    <button class="action-btn edit" onclick="editPaymentItem('${item.item_id}')"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deletePaymentItem('${item.item_id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    try {
        showLoading(true, 'Saving payment item...');

        const formData = {
            item_name: document.getElementById('itemName').value.trim(),
            category: document.getElementById('itemCategory').value,
            amount: parseFloat(document.getElementById('itemPrice').value),
            description: document.getElementById('itemDescription').value.trim(),
            is_compulsory: document.getElementById('isCompulsory').checked,
            is_active: document.getElementById('isActive').checked,
            school_id: currentSchoolId
        };

        if (!formData.item_name || !formData.category || isNaN(formData.amount)) {
            showError('Please fill in all required fields.');
            return;
        }

        const itemId = document.getElementById('itemId').value;
        let result;

        if (itemId) {
            // Update using item_id
            result = await window.supabase
                .from('Payment_Items')
                .update(formData)
                .eq('item_id', itemId);
        } else {
            // Insert new item
            result = await window.supabase
                .from('Payment_Items')
                .insert([formData]);
        }

        if (result.error) throw result.error;

        showSuccess('Payment item saved successfully!');
        closeModal();
        await loadPaymentItems();

    } catch (error) {
        console.error('Error saving payment item:', error);
        showError('Failed to save payment item: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function editPaymentItem(itemId) {
    const item = paymentItems.find(i => String(i.item_id) === String(itemId));
    if (!item) return;

    document.getElementById('modalTitle').textContent = 'Edit Payment Item';
    document.getElementById('itemId').value = item.item_id;
    document.getElementById('itemName').value = item.item_name;
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemPrice').value = item.amount;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('isCompulsory').checked = item.is_compulsory;
    document.getElementById('isActive').checked = item.is_active;

    document.getElementById('paymentItemModal').style.display = 'flex';
}

function deletePaymentItem(itemId) {
    const item = paymentItems.find(i => String(i.item_id) === String(itemId));
    if (!item) return;
    document.getElementById('deleteItemName').textContent = item.item_name;
    document.getElementById('deleteModal').style.display = 'flex';
    window.itemToDelete = itemId;
}

async function confirmDelete() {
    try {
        showLoading(true, 'Deleting...');
        const { error } = await window.supabase
            .from('Payment_Items')
            .delete()
            .eq('item_id', window.itemToDelete);

        if (error) throw error;
        showSuccess('Deleted successfully!');
        closeDeleteModal();
        await loadPaymentItems();
    } catch (error) {
        showError('Failed to delete item.');
    } finally {
        showLoading(false);
    }
}

// UI Helpers
function getFilteredItems() {
    let filtered = [...paymentItems];
    if (currentFilter !== 'all') {
        filtered = filtered.filter(item => {
            if (currentFilter === 'compulsory') return item.is_compulsory;
            if (currentFilter === 'optional') return !item.is_compulsory;
            return true;
        });
    }
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(item =>
            item.item_name.toLowerCase().includes(searchTerm) ||
            (item.description && item.description.toLowerCase().includes(searchTerm))
        );
    }
    return filtered;
}

function updateStats() {
    const totalItemsEl = document.getElementById('totalItems');
    const compulsoryItemsEl = document.getElementById('compulsoryItems');
    if (totalItemsEl) totalItemsEl.textContent = paymentItems.length;
    if (compulsoryItemsEl) compulsoryItemsEl.textContent = paymentItems.filter(item => item.is_compulsory).length;
}

function handleSearch() { renderPaymentItems(); }

function handleFilter(e) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    renderPaymentItems();
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add Payment Item';
    document.getElementById('paymentItemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('paymentItemModal').style.display = 'flex';
}

function closeModal() { document.getElementById('paymentItemModal').style.display = 'none'; }
function closeDeleteModal() { document.getElementById('deleteModal').style.display = 'none'; }

function showLoading(show, text) {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = show ? 'flex' : 'none';
}
function showSuccess(msg) { alert(msg); }
function showError(msg) { alert(msg); }

window.openAddModal = openAddModal;
window.editPaymentItem = editPaymentItem;
window.deletePaymentItem = deletePaymentItem;
window.confirmDelete = confirmDelete;
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;