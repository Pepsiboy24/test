import { supabaseClient } from './supabase_client.js';
import { waitForUser, renderToFragment, debounce } from '/core/perf.js';

// ─── Module state ───────────────────────────────────────────────
let _offboardTeacherId   = null;
let _offboardTeacherName = null;
let _allTeachersCache    = [];   // used to populate successor dropdown

// ═══════════════════════════════════════════════════════════════
// 1. DATA FETCHING
// ═══════════════════════════════════════════════════════════════

async function fetchTeachers() {
    try {
        const user = await waitForUser();
        const userSchoolId = user?.user_metadata?.school_id;
        if (!userSchoolId) { console.error('User missing school_id'); return []; }

        const [teachersRes, employmentRes, qualificationsRes, workExpRes, emergencyRes] =
            await Promise.all([
                supabaseClient.from('Teachers').select('*').eq('school_id', userSchoolId).order('created_at', { ascending: false }),
                supabaseClient.from('school_employment').select('teacher_id, job_title, contract_type, salary, start_date'),
                supabaseClient.from('qualifications').select('teacher_id, school_name, certificate_name, feild_of_study, graduation_year'),
                supabaseClient.from('work_experience').select('teacher_id, professional_development, position_held, duration, total_experience, school_name'),
                supabaseClient.from('emergency_contact').select('teacher_id, name, relationship, phone_number, address'),
            ]);

        if (teachersRes.error) { console.error('Error fetching teachers:', teachersRes.error); return []; }

        const empMap = {}, qualMap = {}, expMap = {}, ecMap = {};
        (employmentRes.data  || []).forEach(r => { if (!empMap[r.teacher_id])  empMap[r.teacher_id]  = r; });
        (qualificationsRes.data || []).forEach(r => { if (!qualMap[r.teacher_id]) qualMap[r.teacher_id] = r; });
        (workExpRes.data     || []).forEach(r => { if (!expMap[r.teacher_id])  expMap[r.teacher_id]  = r; });
        (emergencyRes.data   || []).forEach(r => { if (!ecMap[r.teacher_id])   ecMap[r.teacher_id]   = r; });

        return (teachersRes.data || []).map(t => {
            const emp  = empMap[t.teacher_id]  || {};
            const qual = qualMap[t.teacher_id] || {};
            const exp  = expMap[t.teacher_id]  || {};
            const ec   = ecMap[t.teacher_id]   || {};
            return {
                ...t,
                id: t.teacher_id,
                personal_email: t.email,
                mobile_phone:   t.phone_number,
                job_title:    emp.job_title,    contract_type:   emp.contract_type,
                salary:       emp.salary,       start_date:      emp.start_date,
                total_experience:     exp.total_experience,  previous_school: exp.school_name,
                previous_position:    exp.position_held,     previous_duration: exp.duration,
                professional_development: exp.professional_development,
                highest_degree:  qual.certificate_name, degree_major: qual.feild_of_study,
                institution:     qual.school_name,      graduation_year: qual.graduation_year,
                emergency_contact_name:  ec.name,  emergency_contact_phone: ec.phone_number,
                emergency_contact_relation: ec.relationship,
                subjects: [], grade_levels: [],
            };
        });
    } catch (err) { console.error('Unexpected error fetching teachers:', err); return []; }
}

async function fetchTeacherClasses() {
    try {
        const { data, error } = await supabaseClient.from('Classes').select('teacher_id, class_name, section');
        if (error) { console.error('Error fetching classes:', error); return {}; }
        const classMap = {};
        // REMOVED: const _rows = []; (This was in the wrong place)
        data.forEach(cls => { classMap[cls.teacher_id] = `${cls.class_name} ${cls.section}`; });
        return classMap;
    } catch (err) { console.error('Unexpected error fetching classes:', err); return {}; }
}

// ═══════════════════════════════════════════════════════════════
// 2. LOAD CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * Returns the teacher's current class load.
 * Checks Classes (form teacher) + Class_Subjects (subject teacher).
 */
async function checkTeacherLoad(teacherId) {
    const [formRes, subjectRes] = await Promise.all([
        supabaseClient.from('Classes').select('class_id, class_name, section').eq('teacher_id', teacherId),
        supabaseClient.from('Class_Subjects').select('class_subjects__id, subject_id, class_id').eq('teacher_id', teacherId),
    ]);
    return {
        formClasses:    formRes.data    || [],
        subjectClasses: subjectRes.data || [],
    };
}

// ═══════════════════════════════════════════════════════════════
// 3. OFFBOARDING ENTRY POINT
// ═══════════════════════════════════════════════════════════════

window.initiateOffboard = async function (teacherId, teacherName) {
    _offboardTeacherId   = teacherId;
    _offboardTeacherName = teacherName;

    // Show a loading state on the button
    const btn = document.querySelector(`[data-offboard-id="${teacherId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }

    try {
        const load = await checkTeacherLoad(teacherId);
        const hasLoad = load.formClasses.length > 0 || load.subjectClasses.length > 0;

        if (hasLoad) {
            openOffboardWizard(teacherId, teacherName, load);
        } else {
            openQuickDeactivate(teacherId, teacherName);
        }
    } catch (err) {
        console.error('Load check failed:', err);
        showToast('Could not check teacher assignments. Please try again.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '⏏ Deactivate'; }
    }
};

// ═══════════════════════════════════════════════════════════════
// 4. PATH A — WIZARD (teacher has active load)
// ═══════════════════════════════════════════════════════════════

function openOffboardWizard(teacherId, teacherName, load) {
    const modal   = document.getElementById('offboardWizardModal');
    const overlay = document.getElementById('offboardOverlay');

    // Populate name
    const nameEl = document.getElementById('wizardTeacherName');
    if (nameEl) nameEl.textContent = teacherName;

    // Populate load summary
    const summaryEl = document.getElementById('wizardLoadSummary');
    if (summaryEl) {
        const formList    = load.formClasses.map(c => `<li>Form teacher: ${c.class_name} ${c.section || ''}</li>`).join('');
        const subjectList = load.subjectClasses.map(c => `<li>Subject teacher: class_id ${c.class_id}</li>`).join('');
        summaryEl.innerHTML = `<ul>${formList}${subjectList}</ul>`;
    }

    // Populate successor dropdown — all active teachers except this one
    const successorSel = document.getElementById('wizardSuccessorSelect');
    if (successorSel) {
        successorSel.innerHTML = '<option value="">Select successor teacher...</option>';
        _allTeachersCache
            .filter(t => t.teacher_id !== teacherId && (t.employment_status || 'active') === 'active')
            .forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.teacher_id;
                opt.textContent = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email;
                successorSel.appendChild(opt);
            });
    }

    if (modal)   modal.style.display   = 'block';
    if (overlay) overlay.style.display = 'block';
}

window.closeOffboardWizard = function () {
    document.getElementById('offboardWizardModal').style.display  = 'none';
    document.getElementById('offboardOverlay').style.display      = 'none';
    _offboardTeacherId   = null;
    _offboardTeacherName = null;
};

window.confirmWizardOffboard = async function () {
    const statusSel    = document.getElementById('wizardStatusSelect');
    const successorSel = document.getElementById('wizardSuccessorSelect');
    const confirmBtn   = document.getElementById('wizardConfirmBtn');

    const status      = statusSel?.value;
    const successorId = successorSel?.value;

    if (!status) { showToast('Please select a status (resigned / terminated).', 'warning'); return; }
    if (!successorId) { showToast('Please select a successor teacher.', 'warning'); return; }

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Processing...'; }

    await executeOffboard(_offboardTeacherId, status, successorId);

    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Offboarding'; }
    window.closeOffboardWizard();
};

// ═══════════════════════════════════════════════════════════════
// 5. PATH B — QUICK DEACTIVATE (no load)
// ═══════════════════════════════════════════════════════════════

function openQuickDeactivate(teacherId, teacherName) {
    const modal   = document.getElementById('quickDeactivateModal');
    const overlay = document.getElementById('offboardOverlay');
    const nameEl  = document.getElementById('quickDeactivateName');
    if (nameEl) nameEl.textContent = teacherName;
    if (modal)   modal.style.display   = 'block';
    if (overlay) overlay.style.display = 'block';
}

window.closeQuickDeactivate = function () {
    document.getElementById('quickDeactivateModal').style.display = 'none';
    document.getElementById('offboardOverlay').style.display      = 'none';
    _offboardTeacherId   = null;
    _offboardTeacherName = null;
};

window.confirmQuickDeactivate = async function () {
    const statusSel   = document.getElementById('quickStatusSelect');
    const confirmBtn  = document.getElementById('quickConfirmBtn');
    const status      = statusSel?.value || 'resigned';

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Archiving...'; }
    await executeOffboard(_offboardTeacherId, status, null);
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Archive Now'; }
    window.closeQuickDeactivate();
};

// ═══════════════════════════════════════════════════════════════
// 6. UNIFIED EXECUTION
// ═══════════════════════════════════════════════════════════════

async function executeOffboard(teacherId, status, successorId) {
    try {
        // A. Update teacher's employment status
        const { error: updateErr } = await supabaseClient
            .from('Teachers')
            .update({ employment_status: status, offboarded_at: new Date().toISOString() })
            .eq('teacher_id', teacherId);
        if (updateErr) throw updateErr;

        // B. If successor chosen — reassign form classes and subject classes
        if (successorId) {
            const [classErr, subjectErr] = await Promise.all([
                supabaseClient.from('Classes')
                    .update({ teacher_id: successorId })
                    .eq('teacher_id', teacherId)
                    .then(r => r.error),
                supabaseClient.from('Class_Subjects')
                    .update({ teacher_id: successorId })
                    .eq('teacher_id', teacherId)
                    .then(r => r.error),
            ]);
            if (classErr)   console.warn('Classes reassignment warning:', classErr.message);
            if (subjectErr) console.warn('Class_Subjects reassignment warning:', subjectErr.message);
        }

        showToast(`${_offboardTeacherName || 'Teacher'} has been archived (${status}).`, 'success');

        // C. Refresh table
        if (window.refreshTeacherList) await window.refreshTeacherList();

    } catch (err) {
        console.error('Offboard execution error:', err);
        showToast('Offboarding failed: ' + err.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// 7. RENDER
// ═══════════════════════════════════════════════════════════════

function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 'N/A';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
}

function getJobTitleDisplay(jobTitle) {
    const map = { teacher: 'Teacher', lead_teacher: 'Lead Teacher', department_head: 'Department Head', assistant_principal: 'Assistant Principal', substitute: 'Substitute Teacher', other: 'Other' };
    return map[jobTitle] || jobTitle || 'Teacher';
}

function getInitials(first, last) {
    return (first ? first.charAt(0).toUpperCase() : '?') + (last ? last.charAt(0).toUpperCase() : '?');
}

function getFullName(first, last, middle) {
    return [first, middle, last].filter(Boolean).join(' ') || 'Unknown Teacher';
}

function getPrimarySubject(subjects) {
    if (!subjects) return 'General';
    if (Array.isArray(subjects) && subjects.length > 0) return subjects[0];
    if (typeof subjects === 'string') return subjects.split(',')[0].trim() || 'General';
    return 'General';
}

function getEmploymentBadge(status) {
    const map = {
        active:     { label: 'Active',     bg: '#dcfce7', color: '#16a34a' },
        resigned:   { label: 'Resigned',   bg: '#fef9c3', color: '#ca8a04' },
        terminated: { label: 'Terminated', bg: '#fee2e2', color: '#dc2626' },
    };
    const s = map[status] || map.active;
    return `<span style="background:${s.bg}; color:${s.color}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">${s.label}</span>`;
}

function renderTeachers(teachers, classMap = {}) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) { console.error('Teachers table tbody not found'); return; }
    tbody.innerHTML = '';

    const _rows = []; 

    if (teachers.length === 0) {
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="student-row">
                <td colspan="6" style="text-align:center; padding:2rem; color:#6b7280;">
                    No teachers found. Add some teachers to get started.
                </td>
            </tr>`);
        return;
    }

    teachers.forEach(teacher => {
        const fullName = getFullName(teacher.first_name, teacher.last_name, teacher.middle_name);
        const initials = getInitials(teacher.first_name, teacher.last_name);
        const age = calculateAge(teacher.date_of_birth);
        const jobTitle = getJobTitleDisplay(teacher.job_title);
        const className = classMap[teacher.teacher_id] || 'Not Assigned';
        const attendancePercent = 92; // Placeholder
        const safeName = fullName.replace(/'/g, "\\'");

        const row = `
            <tr class="student-row">
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-details">
                            <h4>${fullName}</h4>
                            <p>ID: #T${teacher.teacher_id ? teacher.teacher_id.toString().substr(0, 8) : 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="experience-badge">
                        <span>${teacher.total_experience || 'New'}</span>
                    </div>
                </td>
                <td>
                    <div class="class-badge">${className}</div>
                </td>
                <td>
                    <div class="attendance-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${attendancePercent}%;"></div>
                        </div>
                        <span class="attendance-percent">${attendancePercent}%</span>
                    </div>
                </td>
                <td>${getEmploymentBadge(teacher.employment_status || 'active')}</td>
                <td style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <button class='view-btn' data-type='teacher' data-id='${teacher.teacher_id}'>View</button>
                    <button
                        class="action-btn"
                        style="background:#fef3c7; color:#d97706; border:none; cursor:pointer; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;"
                        data-offboard-id="${teacher.teacher_id}"
                        onclick="window.initiateOffboard('${teacher.teacher_id}', '${safeName}')">
                        <i class="fas fa-user-minus"></i> Deactivate
                    </button>
                </td>
            </tr>
        `;
            
        _rows.push(row);
    });
    
    renderToFragment(tbody, _rows);
}

// ═══════════════════════════════════════════════════════════════
// 8. FILTER HELPERS
// ═══════════════════════════════════════════════════════════════

function filterTeachers(teachers, searchTerm) {
    if (!searchTerm) return teachers;
    const term = searchTerm.toLowerCase();
    return teachers.filter(t => {
        const name  = getFullName(t.first_name, t.last_name, t.middle_name).toLowerCase();
        const id    = `t${t.id || ''}`.toLowerCase();
        const email = (t.personal_email || '').toLowerCase();
        return name.includes(term) || id.includes(term) || email.includes(term);
    });
}

function filterTeachersByGrade(teachers, gradeFilter, classMap) {
    if (gradeFilter === 'all') return teachers;
    return teachers.filter(t => {
        const cls = (classMap[t.teacher_id] || '').toLowerCase();
        if (gradeFilter === 'primary')   return cls.includes('primary');
        if (gradeFilter === 'secondary') return cls.includes('jss') || cls.includes('ss');
        return false;
    });
}

// ═══════════════════════════════════════════════════════════════
// 9. INIT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading teachers...');
    let allTeachers = await fetchTeachers();
    let classMap    = await fetchTeacherClasses();
    _allTeachersCache = allTeachers; // used by wizard successor dropdown

    let currentSearchTerm  = '';
    let currentGradeFilter = 'all';

    function applyFilters() {
        let filtered = [...allTeachers];
        if (currentSearchTerm)           filtered = filterTeachers(filtered, currentSearchTerm);
        if (currentGradeFilter !== 'all') filtered = filterTeachersByGrade(filtered, currentGradeFilter, classMap);
        renderTeachers(filtered, classMap);
    }

    applyFilters();
    console.log(`Loaded ${allTeachers.length} teachers`);

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
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentGradeFilter = this.textContent.toLowerCase();
            applyFilters();
        });
    });

    // Overlay click closes any open offboard modal
    const overlay = document.getElementById('offboardOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            window.closeOffboardWizard?.();
            window.closeQuickDeactivate?.();
        });
    }

    // Global refresh
    window.refreshTeacherList = async () => {
        allTeachers       = await fetchTeachers();
        classMap          = await fetchTeacherClasses();
        _allTeachersCache = allTeachers;
        applyFilters();
    };
});

// ═══════════════════════════════════════════════════════════════
// 10. TEACHER DETAILS POPUP (unchanged)
// ═══════════════════════════════════════════════════════════════

function populateTeacherDetails(teacher, classMap = {}) {
    const fullName  = getFullName(teacher.first_name, teacher.last_name, teacher.middle_name);
    const initials  = getInitials(teacher.first_name, teacher.last_name);
    const age       = calculateAge(teacher.date_of_birth);
    const jobTitle  = getJobTitleDisplay(teacher.job_title);
    const className = classMap[teacher.teacher_id] || jobTitle;

    document.getElementById('teacherAvatarLarge').textContent = initials;
    document.getElementById('teacherFullName').textContent    = fullName;
    document.getElementById('teacherId').textContent          = `Teacher ID: #T${teacher.id || 'N/A'}`;
    document.getElementById('teacherJobTitle').textContent    = jobTitle;
    document.getElementById('teacherClass').textContent       = className;

    document.getElementById('detailFirstName').textContent   = teacher.first_name  || 'N/A';
    document.getElementById('detailMiddleName').textContent  = teacher.middle_name || 'N/A';
    document.getElementById('detailLastName').textContent    = teacher.last_name   || 'N/A';
    document.getElementById('detailDateOfBirth').textContent = teacher.date_of_birth ? new Date(teacher.date_of_birth).toLocaleDateString() : 'N/A';
    document.getElementById('detailAge').textContent         = age;
    document.getElementById('detailGender').textContent      = teacher.gender ? teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1) : 'N/A';
    document.getElementById('detailAddress').textContent     = teacher.address      || 'N/A';
    document.getElementById('detailMobilePhone').textContent = teacher.mobile_phone || 'N/A';
    document.getElementById('detailHomePhone').textContent   = teacher.home_phone   || 'N/A';
    document.getElementById('detailPersonalEmail').textContent      = teacher.personal_email           || 'N/A';
    document.getElementById('detailEmergencyContact').textContent   = teacher.emergency_contact_name   || 'N/A';
    document.getElementById('detailEmergencyPhone').textContent     = teacher.emergency_contact_phone  || 'N/A';
    document.getElementById('detailHighestDegree').textContent      = teacher.highest_degree   || 'N/A';
    document.getElementById('detailDegreeMajor').textContent        = teacher.degree_major     || 'N/A';
    document.getElementById('detailInstitution').textContent        = teacher.institution      || 'N/A';
    document.getElementById('detailGraduationYear').textContent     = teacher.graduation_year  || 'N/A';
    document.getElementById('detailTeachingLicense').textContent    = teacher.teaching_license || 'N/A';
    document.getElementById('detailLicenseExpiry').textContent      = teacher.license_expiry ? new Date(teacher.license_expiry).toLocaleDateString() : 'N/A';

    const subjectsEl = document.getElementById('detailSubjects');
    subjectsEl.innerHTML = (teacher.subjects?.length)
        ? teacher.subjects.map(s => `<span>${s}</span>`).join('') : '<span>N/A</span>';

    const gradesEl = document.getElementById('detailGradeLevels');
    gradesEl.innerHTML = (teacher.grade_levels?.length)
        ? teacher.grade_levels.map(l => `<span>${l}</span>`).join('') : '<span>N/A</span>';

    document.getElementById('detailTotalExperience').textContent      = teacher.total_experience      || 'N/A';
    document.getElementById('detailPreviousSchool').textContent       = teacher.previous_school       || 'N/A';
    document.getElementById('detailPreviousPosition').textContent     = teacher.previous_position     || 'N/A';
    document.getElementById('detailPreviousDuration').textContent     = teacher.previous_duration     || 'N/A';
    document.getElementById('detailProfessionalDevelopment').textContent = teacher.professional_development || 'N/A';
    document.getElementById('detailStartDate').textContent    = teacher.start_date ? new Date(teacher.start_date).toLocaleDateString() : 'N/A';
    document.getElementById('detailJobTitle').textContent     = jobTitle;
    document.getElementById('detailContractType').textContent = teacher.contract_type || 'N/A';
    document.getElementById('detailSalary').textContent       = teacher.salary ? `₦${Number(teacher.salary).toLocaleString()}` : 'N/A';

    const rolesEl = document.getElementById('detailSpecializedRoles');
    rolesEl.innerHTML = (teacher.specialized_roles?.length)
        ? teacher.specialized_roles.map(r => `<span>${r}</span>`).join('') : '<span>N/A</span>';

    document.getElementById('detailWorkAuthorization').textContent = teacher.work_authorization || 'N/A';
    document.getElementById('detailBackgroundCheck').textContent   = teacher.background_check   || 'N/A';
    document.getElementById('detailReferences').textContent        = teacher.references         || 'N/A';
    document.getElementById('detailAllergies').textContent         = teacher.allergies          || 'N/A';
    document.getElementById('detailMedicalConditions').textContent = teacher.medical_conditions || 'N/A';
    document.getElementById('detailMedications').textContent       = teacher.medications        || 'N/A';
}

function showTeacherDetailsPopup(teacher, classMap) {
    populateTeacherDetails(teacher, classMap);
    const popup = document.getElementById('teacherDetailsPopup');
    if (popup) popup.style.display = 'flex';
}

function hideTeacherDetailsPopup() {
    const popup = document.getElementById('teacherDetailsPopup');
    if (popup) popup.style.display = 'none';
}

export {
    fetchTeachers, fetchTeacherClasses, renderTeachers,
    calculateAge, getJobTitleDisplay, getInitials, getFullName,
    getPrimarySubject, filterTeachers, filterTeachersByGrade,
    populateTeacherDetails, showTeacherDetailsPopup, hideTeacherDetailsPopup,
    checkTeacherLoad,
};
