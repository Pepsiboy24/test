const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Function to fetch all school admins from Supabase
async function fetchSchoolAdmins() {
    try {
        const { data, error } = await supabaseClient
            .from('School_Admin')
            .select('*')
        // .order('created_at', { ascending: false }); // Order by creation date, newest first

        if (error) {
            console.error('Error fetching school admins:', error);
            return [];
        }
        console.log('Fetched school admins:', data);
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

// Function to calculate age from date of birth
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

// Function to get initials for avatar
function getInitials(firstName, lastName) {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '?';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '?';

    return firstInitial + lastInitial;
}

// Function to get full name
function getFullName(firstName, lastName, middleName) {
    const parts = [firstName, middleName, lastName].filter(Boolean);
    return parts.join(' ') || 'Unknown Admin';
}

// Function to render school admins in the table
function renderSchoolAdmins(admins) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) {
        console.error('School admins table tbody not found');
        return;
    }

    tbody.innerHTML = ''; // Clear existing rows

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

    admins.forEach(admin => {
        const age = calculateAge(admin.date_of_birth);
        const fullName = getFullName(admin.first_name, admin.last_name, admin.middle_name);
        const initials = getInitials(admin.first_name, admin.last_name);

        // Default status for school admins
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
                    <a href="#" class="action-btn" data-admin-id="${admin.admin_id}">View</a>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Function to filter school admins based on search term
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

// Function to filter school admins by status
function filterSchoolAdminsByStatus(admins, statusFilter) {
    if (statusFilter === 'all') return admins;

    return admins.filter(admin => {
        // For now, all admins are considered active
        // In a real implementation, you might have a status field
        return statusFilter === 'active';
    });
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

    // Set up search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            currentSearchTerm = this.value.trim();
            applyFilters();
        });
    }

    // Set up filter tabs functionality
    const filterTabs = document.querySelectorAll('.filter-tab');
    if (filterTabs.length > 0) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                // Remove active class from all tabs
                filterTabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                this.classList.add('active');

                currentStatusFilter = this.textContent.toLowerCase();
                applyFilters();
            });
        });
    }
});

// Function to populate admin details popup
function populateAdminDetails(admin) {
    // Basic info
    const fullName = getFullName(admin.first_name, admin.last_name, admin.middle_name);
    const initials = getInitials(admin.first_name, admin.last_name);
    const age = calculateAge(admin.date_of_birth);

    document.getElementById('adminAvatarLarge').textContent = initials;
    document.getElementById('adminFullName').textContent = fullName;
    document.getElementById('adminId').textContent = `Admin ID: #A${admin.admin_id || 'N/A'}`;
    document.getElementById('adminRole').textContent = 'School Administrator';

    // Personal Information
    document.getElementById('detailFirstName').textContent = admin.first_name || 'N/A';
    document.getElementById('detailMiddleName').textContent = admin.middle_name || 'N/A';
    document.getElementById('detailLastName').textContent = admin.last_name || 'N/A';
    document.getElementById('detailDateOfBirth').textContent = admin.date_of_birth ? new Date(admin.date_of_birth).toLocaleDateString() : 'N/A';
    document.getElementById('detailAge').textContent = age;
    document.getElementById('detailGender').textContent = admin.gender ? admin.gender.charAt(0).toUpperCase() + admin.gender.slice(1) : 'N/A';

    // Contact Information
    document.getElementById('detailAddress').textContent = admin.address || 'N/A';
    document.getElementById('detailMobilePhone').textContent = admin.mobile_phone || 'N/A';
    document.getElementById('detailHomePhone').textContent = admin.home_phone || 'N/A';
    document.getElementById('detailPersonalEmail').textContent = admin.personal_email || 'N/A';
    document.getElementById('detailEmergencyContact').textContent = admin.emergency_contact_name || 'N/A';
    document.getElementById('detailEmergencyPhone').textContent = admin.emergency_contact_phone || 'N/A';
}

// Function to show admin details popup
function showAdminDetailsPopup(admin) {
    populateAdminDetails(admin);
    const popup = document.getElementById('adminDetailsPopup');
    if (popup) {
        popup.style.display = 'flex';
    }
}

// Function to hide admin details popup
function hideAdminDetailsPopup() {
    const popup = document.getElementById('adminDetailsPopup');
    if (popup) {
        popup.style.display = 'none';
    }
}

// Export functions for potential use in other modules
export { fetchSchoolAdmins, renderSchoolAdmins, calculateAge, getInitials, getFullName, filterSchoolAdmins, filterSchoolAdminsByStatus, populateAdminDetails, showAdminDetailsPopup, hideAdminDetailsPopup };
