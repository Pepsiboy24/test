import { supabase } from '../../core/config.js';
import { deleteSchoolAdmin } from './schooladminsFormDB.js'; // FIX #55: was exported but never imported
import { waitForUser, renderToFragment, debounce } from '/core/perf.js';

// FIX #52: Fetch only admins belonging to the current admin's school
async function fetchSchoolAdmins() {
    try {
        // Resolve the logged-in admin's school_id from JWT metadata
        const user = await waitForUser();
        if (!user?.user_metadata?.school_id) {
            console.error('fetchSchoolAdmins: cannot determine school_id', user);
            return [];
        }
        const schoolId = user.user_metadata.school_id;

        const { data, error } = await supabase
            .from('School_Admin')
            .select('*')
            .eq('school_id', schoolId); // was missing — returned ALL admins from ALL schools

        if (error) {
            console.error('Error fetching school admins:', error);
            return [];
        }

        return (data || []).map(admin => {
            const nameParts = (admin.full_name || '').split(' ');
            return {
                ...admin,
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                middle_name: '',
                personal_email: admin.email,
                mobile_phone: admin.phone_number,
                date_of_birth: null,
                gender: null,
                address: null,
                home_phone: null,
                emergency_contact_name: null,
                emergency_contact_phone: null
            };
        });
    } catch (err) {
        console.error('Unexpected error fetching school admins:', err);
        return [];
    }
}

function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 'N/A';

    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

function getInitials(firstName, lastName) {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '?';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '?';
    return firstInitial + lastInitial;
}

function getFullName(firstName, lastName, middleName) {
    const parts = [firstName, middleName, lastName].filter(Boolean);
    return parts.join(' ') || 'Unknown Admin';
}

function renderSchoolAdmins(admins) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) {
        console.error('School admins table tbody not found');
        return;
    }

    tbody.innerHTML = '';

    if (admins.length === 0) {
        const noDataRow = `
            <tr class="student-row">
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No school admins found. Add some administrators to get started.
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', noDataRow);
        return;
    }

    const _rows = [];
    admins.forEach(admin => {
        const age = calculateAge(admin.date_of_birth);
        const fullName = getFullName(admin.first_name, admin.last_name, admin.middle_name);
        const initials = getInitials(admin.first_name, admin.last_name);
        const status = 'Active';
        const statusClass = status.toLowerCase();

        const row = `
            <tr class="student-row">
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-details">
                            <h4>${fullName}</h4>
                            <p>Admin ID: #A${admin.admin_id || 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td>${age}</td>
                <td>
                    <div class="class-badge">School Administrator</div>
                </td>
                <td>
                    <div class="status-badge ${statusClass}">${status}</div>
                </td>
                <td>
                    <a href="#" class="action-btn view-admin-btn" data-admin-id="${admin.admin_id}">View</a>
                    <a href="#" class="action-btn delete-admin-btn" data-admin-id="${admin.admin_id}"
                       style="color: #dc2626; margin-left: 8px;">Delete</a>
                </td>
            </tr>
        `;

                _rows.push(row);
    });
    renderToFragment(tbody, _rows);
}

function filterSchoolAdmins(admins, searchTerm) {
    if (!searchTerm) return admins;

    const term = searchTerm.toLowerCase();
    return admins.filter(admin => {
        const fullName = getFullName(admin.first_name, admin.last_name, admin.middle_name).toLowerCase();
        const adminId = `a${admin.admin_id || ''}`.toLowerCase();
        const email = (admin.personal_email || '').toLowerCase();

        return fullName.includes(term) ||
            adminId.includes(term) ||
            email.includes(term);
    });
}

function filterSchoolAdminsByStatus(admins, statusFilter) {
    if (statusFilter === 'all') return admins;
    return admins.filter(() => statusFilter === 'active');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading school admins...');
    let allAdmins = await fetchSchoolAdmins();
    let currentSearchTerm = '';
    let currentStatusFilter = 'all';

    function applyFilters() {
        let filtered = [...allAdmins];
        if (currentSearchTerm) {
            filtered = filterSchoolAdmins(filtered, currentSearchTerm);
        }
        if (currentStatusFilter !== 'all') {
            filtered = filterSchoolAdminsByStatus(filtered, currentStatusFilter);
        }
        renderSchoolAdmins(filtered);
    }

    applyFilters();
    console.log(`Loaded ${allAdmins.length} school admins`);

    // Search
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function () {
            currentSearchTerm = this.value.trim();
            applyFilters();
        }, 300));
    }

    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    if (filterTabs.length > 0) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                filterTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                currentStatusFilter = this.textContent.toLowerCase();
                applyFilters();
            });
        });
    }

    // FIX #55 + #56: Wire up delete buttons with confirmation dialog
    // Uses event delegation so it works after re-renders
    const tbody = document.querySelector('.students-table tbody');
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-admin-btn');
            const deleteBtn = e.target.closest('.delete-admin-btn');

            if (viewBtn) {
                e.preventDefault();
                const adminId = viewBtn.dataset.adminId;
                const admin = allAdmins.find(a => String(a.admin_id) === String(adminId));
                if (admin) showAdminDetailsPopup(admin);
            }

            if (deleteBtn) {
                e.preventDefault();
                const adminId = deleteBtn.dataset.adminId;
                const admin = allAdmins.find(a => String(a.admin_id) === String(adminId));
                if (!admin) return;

                const fullName = getFullName(admin.first_name, admin.last_name, admin.middle_name);

                // FIX #56: Require explicit confirmation before any destructive action
                const confirmed = window.showConfirm
                    ? await window.showConfirm(`Permanently delete admin "${fullName}"? This cannot be undone.`, 'Delete Admin')
                    : confirm(`Permanently delete admin "${fullName}"? This cannot be undone.`);

                if (!confirmed) return;

                const result = await deleteSchoolAdmin(adminId);
                if (result.success) {
                    allAdmins = allAdmins.filter(a => String(a.admin_id) !== String(adminId));
                    applyFilters();
                    showToast(`Admin "${fullName}" deleted successfully.`, 'success');
                } else {
                    showToast(`Failed to delete admin: ${result.error}`, 'error');
                }
            }
        });
    }
});

// Admin details popup helpers
function populateAdminDetails(admin) {
    const fullName = getFullName(admin.first_name, admin.last_name, admin.middle_name);
    const initials = getInitials(admin.first_name, admin.last_name);
    const age = calculateAge(admin.date_of_birth);

    document.getElementById('adminAvatarLarge').textContent = initials;
    document.getElementById('adminFullName').textContent = fullName;
    document.getElementById('adminId').textContent = `Admin ID: #A${admin.admin_id || 'N/A'}`;
    document.getElementById('adminRole').textContent = 'School Administrator';

    document.getElementById('detailFirstName').textContent = admin.first_name || 'N/A';
    document.getElementById('detailMiddleName').textContent = admin.middle_name || 'N/A';
    document.getElementById('detailLastName').textContent = admin.last_name || 'N/A';
    document.getElementById('detailDateOfBirth').textContent = admin.date_of_birth ? new Date(admin.date_of_birth).toLocaleDateString() : 'N/A';
    document.getElementById('detailAge').textContent = age;
    document.getElementById('detailGender').textContent = admin.gender ? admin.gender.charAt(0).toUpperCase() + admin.gender.slice(1) : 'N/A';

    document.getElementById('detailAddress').textContent = admin.address || 'N/A';
    document.getElementById('detailMobilePhone').textContent = admin.mobile_phone || 'N/A';
    document.getElementById('detailHomePhone').textContent = admin.home_phone || 'N/A';
    document.getElementById('detailPersonalEmail').textContent = admin.personal_email || 'N/A';
    document.getElementById('detailEmergencyContact').textContent = admin.emergency_contact_name || 'N/A';
    document.getElementById('detailEmergencyPhone').textContent = admin.emergency_contact_phone || 'N/A';
}

function showAdminDetailsPopup(admin) {
    populateAdminDetails(admin);
    const popup = document.getElementById('adminDetailsPopup');
    if (popup) popup.style.display = 'flex';
}

function hideAdminDetailsPopup() {
    const popup = document.getElementById('adminDetailsPopup');
    if (popup) popup.style.display = 'none';
}

export {
    fetchSchoolAdmins, renderSchoolAdmins, calculateAge, getInitials, getFullName,
    filterSchoolAdmins, filterSchoolAdminsByStatus, populateAdminDetails,
    showAdminDetailsPopup, hideAdminDetailsPopup
};
