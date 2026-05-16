import { supabase } from '../../core/config.js';

class BillingSummary {
    constructor() {
        this.currentTerm = 'First Term 2026';
        this.ratePerStudent = 2500;
        this.metrics = null;
        this.init();
    }

    async init() {
        if (window.currentUser) {
            await this.loadBillingData(window.currentUser);
        } else {
            window.addEventListener('auth-ready', async (e) => {
                await this.loadBillingData(e.detail);
            }, { once: true });
        }
    }

    async loadBillingData(user) {
        try {
            const schoolId = user?.user_metadata?.school_id;
            if (!schoolId) return;

            const { data, error } = await supabase
                .from('Students')
                .select('student_id')
                .eq('school_id', schoolId)
                .eq('enrollment_status', 'active');

            if (error) throw error;

            this.calculateBillingMetrics(data || []);
            this.updateBillingDisplay();
        } catch (error) {
            console.error('Billing error:', error);
        }
    }

    calculateBillingMetrics(students) {
        const count = students.length;
        this.metrics = {
            activeStudents: count,
            totalOwed: count * this.ratePerStudent,
            paidStudents: 0,
            unpaidStudents: count,
            collectionRate: 0,
            nextDueDate: '2026-05-01'
        };
    }

    updateBillingDisplay() {
        if (!this.metrics) return; // CRITICAL SAFETY CHECK

        const map = {
            'active-students-count': this.metrics.activeStudents,
            'total-owed': `₦${this.metrics.totalOwed.toLocaleString()}`,
            'paid-students-count': this.metrics.paidStudents,
            'unpaid-students-count': this.metrics.unpaidStudents,
            'collection-rate': `${this.metrics.collectionRate}%`,
            'next-due-date': this.metrics.nextDueDate
        };

        for (const [id, val] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { new BillingSummary(); });