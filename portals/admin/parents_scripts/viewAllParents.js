import { supabase } from '../../../core/config.js';
import { waitForUser, renderToFragment, debounce } from '/core/perf.js';

let allParents = [];
let currentSearchTerm = '';

async function fetchParents() {
    try {
        const user = await waitForUser();
        const userSchoolId = user?.user_metadata?.school_id;

        if (!userSchoolId) {
            console.error('User missing school_id in metadata');
            return [];
        }

        const { data, error } = await supabase
            .from('Parents')
            .select('*')
            .eq('school_id', userSchoolId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching parents:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching parents:', err);
        return [];
    }
}

function filterParents(parents, searchTerm) {
    if (!searchTerm) return parents;
    const term = searchTerm.toLowerCase();
    return parents.filter(p => {
        const fullName = (p.full_name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const phone = (p.phone_number || '').toLowerCase();
        return fullName.includes(term) || email.includes(term) || phone.includes(term);
    });
}

function getInitials(fullName) {
    if (!fullName) return '?';
    return fullName.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
}

function renderParents(parents) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (parents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:#6b7280;">No parents found.</td></tr>`;
        return;
    }

    const _rows = [];
    parents.forEach(parent => {
        const initials = getInitials(parent.full_name);
        const address = parent.address || 'N/A';
        const phone = parent.phone_number || 'N/A';
        
        const row = `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:16px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:50%; background:#f1f5f9; color:#475569; font-weight:600; display:flex; align-items:center; justify-content:center;">${initials}</div>
                        <div>
                            <h4 style="margin:0; font-size:14px; color:#0f172a; font-weight:600;">${parent.full_name || 'Unknown'}</h4>
                            <p style="margin:0; font-size:12px; color:#64748b;">${parent.occupation || 'Occupation Not Added'}</p>
                        </div>
                    </div>
                </td>
                <td style="padding:16px; font-size:14px; color:#334155;">${parent.email || 'N/A'}</td>
                <td style="padding:16px; font-size:14px; color:#334155;">${phone}</td>
                <td style="padding:16px; font-size:14px; color:#334155;">${address}</td>
                <td style="padding:16px; display:flex; gap:6px;">
                    <button class="action-btn view-btn" data-type="parent" data-id="${parent.parent_id}" style="background:#e0e7ff; color:#4f46e5; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">View</button>
                    <button class="action-btn" onclick="window.openEditModal('${parent.parent_id}')" style="background:#fef3c7; color:#d97706; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Edit</button>
                </td>
            </tr>
        `;
                _rows.push(row);
    });
    renderToFragment(tbody, _rows);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading parents...');
    allParents = await fetchParents();
    
    function applyFilters() {
        const filtered = filterParents(allParents, currentSearchTerm);
        renderParents(filtered);
    }
    
    applyFilters();

    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            currentSearchTerm = this.value.trim();
            applyFilters();
        }, 300));
    }

    // Modal Logistics
    window.openEditModal = function(parentId) {
        const parent = allParents.find(p => p.parent_id === parentId);
        if (!parent) return;

        document.getElementById('editParentId').value = parent.parent_id;
        document.getElementById('editParentName').value = parent.full_name || '';
        document.getElementById('editParentEmail').value = parent.email || '';
        document.getElementById('editParentPhone').value = parent.phone_number || '';
        document.getElementById('editParentOccupation').value = parent.occupation || '';
        document.getElementById('editParentAddress').value = parent.address || '';

        document.getElementById('editParentOverlay').style.display = 'block';
        document.getElementById('editParentModal').style.display = 'block';
    };

    window.closeEditModal = function() {
        document.getElementById('editParentOverlay').style.display = 'none';
        document.getElementById('editParentModal').style.display = 'none';
    };

    window.submitParentEdit = async function() {
        const id = document.getElementById('editParentId').value;
        const btn = document.getElementById('editSubmitBtn');

        if (!id) return;

        btn.disabled = true;
        btn.textContent = 'Saving...';

        const updates = {
            full_name: document.getElementById('editParentName').value.trim(),
            email: document.getElementById('editParentEmail').value.trim(),
            phone_number: document.getElementById('editParentPhone').value.trim(),
            occupation: document.getElementById('editParentOccupation').value.trim(),
            address: document.getElementById('editParentAddress').value.trim()
        };

        try {
            const { error } = await supabase
                .from('Parents')
                .update(updates)
                .eq('parent_id', id);

            if (error) throw error;

            if (typeof showToast === 'function') {
                showToast('Parent updated successfully!', 'success');
            } else {
                alert('Parent updated successfully!');
            }

            window.closeEditModal();
            
            // Refresh inline
            allParents = await fetchParents();
            applyFilters();
        } catch (err) {
            console.error('Error updating parent:', err);
            if (typeof showToast === 'function') {
                showToast('Failed to update parent: ' + err.message, 'error');
            } else {
                alert('Failed to update parent!');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Changes';
        }
    };
});

export { fetchParents };
