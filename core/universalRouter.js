import { supabase } from './config.js';

class UniversalRouter {
    constructor() {
        this.cache = {};
        this.init();
    }

    async init() {
        try {
            // After restructuring, these are the most reliable absolute paths.
            // Using an array allows us to handle different deployment environments.
            const possiblePaths = [
                '/portals/student/details_modal.html', // Student portal location
                '/portals/parent/details_modal.html',  // Parent portal location  
                '/portals/teacher/details_modal.html', // Teacher portal location
                '/portals/shared/details_modal.html'   // Best practice for a "Universal" component
            ];

            let modalLoaded = false;
            
            for (const path of possiblePaths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        const html = await response.text();
                        
                        // Check if a container already exists to prevent duplicate modals
                        let container = document.getElementById('universal-modal-container');
                        if (!container) {
                            container = document.createElement('div');
                            container.id = 'universal-modal-container';
                            document.body.appendChild(container);
                        }
                        
                        container.innerHTML = html;
                        this.setupModalListeners();
                        modalLoaded = true;
                        console.log(`✅ Modal loaded successfully from: ${path}`);
                        break;
                    }
                } catch (e) { 
                    // Silently fail to try the next path in the loop
                    continue; 
                }
            }

            if (!modalLoaded) {
                console.error('❌ Critical: universalRouter could not load details_modal.html from any known path.');
            }
        } catch (error) { 
            console.error('❌ Modal Load Error:', error); 
        }

        // Global Event Delegation for ".view-btn"
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            if (btn) {
                const type = btn.getAttribute('data-type');
                const id = btn.getAttribute('data-id');
                if (type && id) {
                    console.log(`🔍 Opening modal for ${type} (ID: ${id})`);
                    this.handleView(type, id);
                }
            }
        });
    }

    setupModalListeners() {
        const closeBtn = document.getElementById('universalModalClose');
        const overlay = document.getElementById('universalModalOverlay');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeModal(); });

        // Tab switching with event delegation for dynamically loaded content
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('universal-modal-tab')) {
                // Remove active class from all tabs and content areas
                document.querySelectorAll('.universal-modal-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.universal-modal-content-area').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab
                e.target.classList.add('active');
                
                // Show corresponding content area
                const targetId = e.target.getAttribute('data-target');
                const targetContent = document.getElementById(targetId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });
    }

    openModal() {
        const overlay = document.getElementById('universalModalOverlay');
        if (overlay) overlay.classList.add('active');
    }

    closeModal() {
        const overlay = document.getElementById('universalModalOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    async handleView(type, id) {
        this.openModal();
        const loader = document.getElementById('umLoader');
        if (loader) loader.classList.add('active');

        try {
            const { data: auth } = await supabase.auth.getUser();
            const school_id = auth?.user?.user_metadata?.school_id;

            const tabs = document.querySelectorAll('.universal-modal-tab');
            tabs.forEach(tab => {
                const target = tab.getAttribute('data-target');
                if (type === 'parent' && target !== 'um-overview') {
                    tab.style.display = 'none';
                } else {
                    tab.style.display = '';
                }
            });

            // Ensure overview matches initial state securely
            document.querySelectorAll('.universal-modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.universal-modal-content-area').forEach(c => c.classList.remove('active'));
            const defaultTab = document.querySelector('.universal-modal-tab[data-target="um-overview"]');
            if (defaultTab) defaultTab.classList.add('active');
            const defaultContent = document.getElementById('um-overview');
            if (defaultContent) defaultContent.classList.add('active');

            let data;
            if (type === 'student') {
                data = await this.fetchStudentData(id, school_id);
                this.renderStudent(data);
            } else if (type === 'teacher') {
                data = await this.fetchTeacherData(id, school_id);
                this.renderTeacher(data);
            } else if (type === 'parent') {
                data = await this.fetchParentData(id, school_id);
                this.renderParent(data);
            }
        } catch (error) {
            console.error('Fetch Error:', error);
        } finally {
            if (loader) loader.classList.remove('active');
        }
    }

    async fetchStudentData(id, school_id) {
        let query = supabase
            .from('Students')
            .select(`
            *,
            Classes (class_name),
            Parent_Student_Links (
                Parents (*)
            )
        `)
            .eq('student_id', id);

        if (school_id) query = query.eq('school_id', school_id);

        const { data: student, error } = await query.single();
        if (error) throw error;

        // Flatten parents logic remains the same
        if (student && student.Parent_Student_Links) {
            student.Parents = student.Parent_Student_Links.map(l => l.Parents).filter(p => p);
        }

        return student;
    }

    renderStudent(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');
        const academicEl = document.getElementById('um-academic');
        const contactsEl = document.getElementById('um-contacts');
        const administrativeEl = document.getElementById('um-administrative');

        // Capture email from the fetched record
        const studentEmail = data.email || 'No student email found';

        if (nameEl) nameEl.textContent = data.full_name || 'Student';

        // Update Header
        if (roleEl) {
            roleEl.innerHTML = `Student <span style="margin-left: 10px; opacity: 0.85; font-size: 0.85em;"><i class="fa fa-envelope"></i> ${studentEmail}</span>`;
        }

        const guardian = (data.Parents && data.Parents.length > 0) ? data.Parents[0] : null;

        // Overview Tab
        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Full Name</div>
                        <div class="um-value">${data.full_name}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Student Email</div>
                        <div class="um-value" style="word-break:break-all">${studentEmail}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Guardian Name</div>
                        <div class="um-value">${guardian ? guardian.full_name : 'Not Assigned'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Guardian Phone</div>
                        <div class="um-value">${guardian ? guardian.phone_number : 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Class</div>
                        <div class="um-value">${data.Classes?.class_name || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Student ID</div>
                        <div class="um-value" style="font-size:10px">${data.student_id}</div>
                    </div>
                </div>
            `;
        }

        // Academic/Records Tab
        if (academicEl) {
            academicEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Current Class</div>
                        <div class="um-value">${data.Classes?.class_name || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Date of Birth</div>
                        <div class="um-value">${data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Admission Date</div>
                        <div class="um-value">${data.admission_date ? new Date(data.admission_date).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Enrollment Status</div>
                        <div class="um-value">${data.enrollment_status || 'Active'}</div>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h3 style="margin-bottom: 15px; color: #1e293b;">Academic Performance</h3>
                    <p style="color: #64748b;">Academic records and performance metrics will be displayed here.</p>
                </div>
            `;
        }

        // Contacts Tab
        if (contactsEl) {
            contactsEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Student Email</div>
                        <div class="um-value" style="word-break:break-all">${studentEmail}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Phone Number</div>
                        <div class="um-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Home Address</div>
                        <div class="um-value">${data.address || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Guardian Email</div>
                        <div class="um-value" style="word-break:break-all">${guardian?.email || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Guardian Phone</div>
                        <div class="um-value">${guardian ? guardian.phone_number : 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Guardian Address</div>
                        <div class="um-value">${guardian?.address || 'N/A'}</div>
                    </div>
                </div>
            `;
        }

        // Administrative Tab
        if (administrativeEl) {
            administrativeEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Student ID</div>
                        <div class="um-value" style="font-size:12px; font-family:monospace">${data.student_id}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">School ID</div>
                        <div class="um-value" style="font-size:12px; font-family:monospace">${data.school_id || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Enrollment Status</div>
                        <div class="um-value">${data.enrollment_status || 'Active'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Created Date</div>
                        <div class="um-value">${data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'}</div>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h3 style="margin-bottom: 15px; color: #1e293b;">Administrative Actions</h3>
                    <p style="color: #64748b;">Administrative actions and history will be displayed here.</p>
                </div>
            `;
        }
    }

    async fetchTeacherData(id, sid) {
        const { data } = await supabase.from('Teachers').select('*').eq('teacher_id', id).single();
        return data;
    }

    renderTeacher(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');
        const academicEl = document.getElementById('um-academic');
        const contactsEl = document.getElementById('um-contacts');
        const administrativeEl = document.getElementById('um-administrative');

        // Capture email from the fetched record
        const teacherEmail = data.email || 'No teacher email found';
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.full_name || 'Teacher';

        if (nameEl) nameEl.textContent = fullName;

        // Update Header
        if (roleEl) {
            roleEl.innerHTML = `Teacher <span style="margin-left: 10px; opacity: 0.85; font-size: 0.85em;"><i class="fa fa-envelope"></i> ${teacherEmail}</span>`;
        }

        // Overview Tab
        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Full Name</div>
                        <div class="um-value">${fullName}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Teacher Email</div>
                        <div class="um-value" style="word-break:break-all">${teacherEmail}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Phone Number</div>
                        <div class="um-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Job Title</div>
                        <div class="um-value">${data.job_title || 'Teacher'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Teacher ID</div>
                        <div class="um-value" style="font-size:10px; font-family:monospace">${data.teacher_id}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Employment Status</div>
                        <div class="um-value">${data.employment_status || 'Active'}</div>
                    </div>
                </div>
            `;
        }

        // Academic/Records Tab
        if (academicEl) {
            academicEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Highest Degree</div>
                        <div class="um-value">${data.highest_degree || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Field of Study</div>
                        <div class="um-value">${data.degree_major || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Institution</div>
                        <div class="um-value">${data.institution || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Graduation Year</div>
                        <div class="um-value">${data.graduation_year || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Teaching License</div>
                        <div class="um-value">${data.teaching_license || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Total Experience</div>
                        <div class="um-value">${data.total_experience || 'New Teacher'}</div>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h3 style="margin-bottom: 15px; color: #1e293b;">Teaching Assignments</h3>
                    <p style="color: #64748b;">Current teaching assignments and class responsibilities will be displayed here.</p>
                </div>
            `;
        }

        // Contacts Tab
        if (contactsEl) {
            contactsEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Work Email</div>
                        <div class="um-value" style="word-break:break-all">${teacherEmail}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Phone Number</div>
                        <div class="um-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Home Phone</div>
                        <div class="um-value">${data.home_phone || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Address</div>
                        <div class="um-value">${data.address || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Emergency Contact</div>
                        <div class="um-value">${data.emergency_contact_name || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Emergency Phone</div>
                        <div class="um-value">${data.emergency_contact_phone || 'N/A'}</div>
                    </div>
                </div>
            `;
        }

        // Administrative Tab
        if (administrativeEl) {
            administrativeEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Teacher ID</div>
                        <div class="um-value" style="font-size:12px; font-family:monospace">${data.teacher_id}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">School ID</div>
                        <div class="um-value" style="font-size:12px; font-family:monospace">${data.school_id || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Employment Status</div>
                        <div class="um-value">${data.employment_status || 'Active'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Contract Type</div>
                        <div class="um-value">${data.contract_type || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Start Date</div>
                        <div class="um-value">${data.start_date ? new Date(data.start_date).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Created Date</div>
                        <div class="um-value">${data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'}</div>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h3 style="margin-bottom: 15px; color: #1e293b;">Administrative Actions</h3>
                    <p style="color: #64748b;">Administrative actions and employment history will be displayed here.</p>
                </div>
            `;
        }
    }

    async fetchParentData(id, school_id) {
        let query = supabase
            .from('Parents')
            .select(`
            *,
            Parent_Student_Links (
                Students (full_name, student_id)
            )
        `)
            .eq('parent_id', id);

        if (school_id) query = query.eq('school_id', school_id);

        const { data: parent, error } = await query.single();
        if (error) throw error;
        return parent;
    }

    renderParent(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');

        const parentEmail = data.email || 'No email found';

        if (nameEl) nameEl.textContent = data.full_name || 'Parent';

        if (roleEl) {
            roleEl.innerHTML = `Parent/Guardian <span style="margin-left: 10px; opacity: 0.85; font-size: 0.85em;"><i class="fa fa-envelope"></i> ${parentEmail}</span>`;
        }

        const linkedStudents = (data.Parent_Student_Links || []).map(l => l.Students?.full_name).filter(Boolean).join(', ');

        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Full Name</div>
                        <div class="um-value">${data.full_name || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Email</div>
                        <div class="um-value" style="word-break:break-all">${parentEmail}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Phone Number</div>
                        <div class="um-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Occupation</div>
                        <div class="um-value">${data.occupation || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Address</div>
                        <div class="um-value">${data.address || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Linked Students</div>
                        <div class="um-value" style="font-size:12px">${linkedStudents || 'None'}</div>
                    </div>
                </div>
            `;
        }
    }
}

const router = new UniversalRouter();