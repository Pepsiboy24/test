import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

/**
 * Global Details Modal System
 */
class DetailsModal {
    constructor() {
        // 1. THE ULTIMATE LOCK: If lock exists, stop immediately.
        if (window.DETAILS_MODAL_INITIALIZED) {
            console.log("🚫 [DetailsModal] Duplicate instance blocked by Global Lock.");
            return;
        }

        // 2. DOM CHECK: In case the lock failed but the HTML exists
        if (document.getElementById('detailsModal')) {
            console.log("🚫 [DetailsModal] Duplicate instance blocked by DOM Check.");
            return;
        }

        // 3. SET THE LOCK
        window.DETAILS_MODAL_INITIALIZED = true;

        this.modal = null;
        this.currentType = null;
        this.currentId = null;

        this.init();
    }

    init() {
        this.createModalStructure();
        this.bindEvents();
    }

    createModalStructure() {
        const modalHTML = `
            <div id="detailsModal" class="details-modal" style="display: none;">
                <div class="modal-overlay" id="modalOverlay"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title" id="modalTitle">Details</h2>
                        <button class="modal-close" id="modalCloseX">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-tabs">
                        <button class="tab-btn active" data-tab="overview">
                            <i class="fas fa-info-circle"></i> Overview
                        </button>
                        <button class="tab-btn" data-tab="academic">
                            <i class="fas fa-graduation-cap"></i> <span id="academicTabLabel">Academic</span>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="tab-content active" id="overviewTab">
                            <div class="overview-grid" id="overviewContent"></div>
                        </div>
                        <div class="tab-content" id="academicTab">
                            <div class="academic-content" id="academicContent"></div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="modalCloseBtn">Close</button>
                        <div class="modal-actions" id="modalActions"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('detailsModal');
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('detailsModalStyles')) return;
        const styles = `
            <style id="detailsModalStyles">
                .details-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; display: flex; align-items: center; justify-content: center; }
                .modal-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); }
                .modal-content { position: relative; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); max-width: 800px; width: 95%; max-height: 90vh; overflow: hidden; z-index: 10000; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .modal-tabs { display: flex; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
                .tab-btn { flex: 1; padding: 15px; border: none; background: transparent; cursor: pointer; font-weight: 500; color: #64748b; }
                .tab-btn.active { color: #667eea; border-bottom: 2px solid #667eea; background: white; }
                .modal-body { padding: 30px; max-height: 60vh; overflow-y: auto; }
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
                .detail-card { background: #f8fafc; border-radius: 10px; padding: 15px; border: 1px solid #e5e7eb; }
                .detail-card h4 { margin: 0 0 8px; font-size: 12px; color: #64748b; text-transform: uppercase; }
                .detail-value { font-weight: 600; color: #1e293b; }
                .loading-spinner { display: flex; justify-content: center; padding: 40px; }
                .spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            const target = e.target;

            // 1. Trigger Modal
            const viewBtn = target.closest('.view-btn');
            if (viewBtn) {
                e.preventDefault();
                this.showDetails(viewBtn.dataset.type, viewBtn.dataset.id);
                return;
            }

            // 2. Close Modal (ID based to prevent duplication confusion)
            if (target.id === 'modalCloseBtn' || target.id === 'modalCloseX' || target.id === 'modalOverlay') {
                this.close();
            }

            // 3. Switch Tabs
            const tabBtn = target.closest('.tab-btn');
            if (tabBtn) {
                this.switchTab(tabBtn.dataset.tab);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    async showDetails(type, id) {
        this.currentType = type;
        this.currentId = id;

        const content = document.getElementById('overviewContent');
        if (!content) return;

        this.showLoading();
        this.modal.style.display = 'flex';

        try {
            const user = await waitForUser();
            const schoolId = user.user_metadata.school_id;

            let data;
            if (type === 'student') {
                const res = await supabase.from('Students').select('*, Classes(class_name), Parent_Student_Links(Parents(*))').eq('student_id', id).maybeSingle();
                data = res.data;
                if (data?.Parent_Student_Links) {
                    data.Parents = data.Parent_Student_Links.map(l => l.Parents).filter(p => p);
                }
            } else if (type === 'teacher') {
                const res = await supabase.from('Teachers').select('*').eq('teacher_id', id).maybeSingle();
                data = res.data;
            }

            this.displayData(data, type);
        } catch (err) {
            console.error("Fetch Error:", err);
        }
    }

    displayData(data, type) {
        document.getElementById('modalTitle').textContent = data?.full_name || 'Details';
        const container = document.getElementById('overviewContent');

        if (type === 'student') {
            const p = data.Parents?.[0] || {};
            container.innerHTML = `
                <div class="detail-card"><h4>Full Name</h4><div class="detail-value">${data.full_name}</div></div>
                <div class="detail-card"><h4>Class</h4><div class="detail-value">${data.Classes?.class_name || 'N/A'}</div></div>
                <div class="detail-card"><h4>Guardian</h4><div class="detail-value">${p.full_name || 'None'}</div></div>
                <div class="detail-card"><h4>Guardian Phone</h4><div class="detail-value">${p.phone_number || 'N/A'}</div></div>
                <div class="detail-card"><h4>Student ID</h4><div class="detail-value">${data.student_id}</div></div>
            `;
        } else {
            container.innerHTML = `<div class="detail-card"><h4>Name</h4><div class="detail-value">${data.full_name}</div></div>`;
        }
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tab}Tab`));
    }

    showLoading() {
        const el = document.getElementById('overviewContent');
        if (el) el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    }

    close() {
        if (this.modal) this.modal.style.display = 'none';
    }
}

// 4. INSTANTIATE ONLY ONCE
if (!window.detailsModalInstance) {
    window.detailsModalInstance = new DetailsModal();
}
export const detailsModal = window.detailsModalInstance;