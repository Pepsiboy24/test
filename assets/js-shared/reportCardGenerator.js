import { supabase } from '../../core/config.js';
import { ResultsEngine } from './resultsEngine.js';
import { waitForUser } from '/core/perf.js';

/**
 * Report Card Generator - Professional Academic Reports
 * Generates and manages student report cards with PDF export capability
 */

class ReportCardGenerator {
    constructor() {
        this.resultsEngine = new ResultsEngine();
        this.schoolInfo = null;
    }

    /**
     * Initialize with school information
     */
    async initialize() {
        try {
            // Get school information for branding
            const user = await waitForUser();
            if (!user?.user_metadata?.school_id) {
                throw new Error('School ID not found in user metadata');
            }

            this.schoolInfo = {
                name: user.user_metadata?.school_name || 'Educational Institution',
                logo: user.user_metadata?.school_logo || null,
                address: user.user_metadata?.school_address || null,
                phone: user.user_metadata?.school_phone || null,
                email: user.user_metadata?.school_email || null
            };

            console.log('Report Card Generator initialized for:', this.schoolInfo.name);
            return true;
        } catch (error) {
            console.error('Failed to initialize Report Card Generator:', error);
            return false;
        }
    }

    /**
     * Generate comprehensive report card for a student
     */
    async generateStudentReportCard(studentId, options = {}) {
        try {
            const { data: student } = await supabase
                .from('Students')
                .select(`
                    student_id, 
                    full_name, 
                    admission_date, 
                    class_id, 
                    date_of_birth,
                    gender,
                    parent_email,
                    parent_phone
                `)
                .eq('student_id', studentId)
                .single();

            if (error) throw error;

            const reportCard = await this.resultsEngine.generateReportCard(studentId, options.term || 'First Term');
            
            return {
                success: true,
                reportCard,
                downloadUrl: () => this.downloadReportCard(reportCard),
                studentInfo: {
                    id: student.student_id,
                    name: student.full_name,
                    class: student.class_id
                }
            };
        } catch (error) {
            console.error('Error generating student report card:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate class performance report
     */
    async generateClassReportCard(classId, options = {}) {
        try {
            const reportCard = await this.resultsEngine.generateReportCard(null, options.term || 'First Term');
            const classData = await this.getClassDetails(classId);
            
            const classReport = {
                ...reportCard,
                title: `${classData.class_name} ${classData.section || ''} - Class Performance Report`,
                type: 'class',
                classInfo: classData
            };

            return {
                success: true,
                reportCard: classReport,
                downloadUrl: () => this.downloadReportCard(classReport),
                classInfo: classData
            };
        } catch (error) {
            console.error('Error generating class report card:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate batch report cards for multiple students
     */
    async generateBatchReportCards(studentIds, options = {}) {
        try {
            const reportCards = await Promise.all(
                studentIds.map(studentId => this.generateStudentReportCard(studentId, options))
            );

            return {
                success: true,
                reportCards,
                downloadAll: () => this.downloadBatchReports(reportCards),
                count: reportCards.length
            };
        } catch (error) {
            console.error('Error generating batch report cards:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get class details
     */
    async getClassDetails(classId) {
        try {
            const { data: classData } = await supabase
                .from('Classes')
                .select('class_name, section, teacher_id')
                .eq('class_id', classId)
                .single();

            if (error) throw error;

            // Get teacher information
            let teacherInfo = null;
            if (classData.teacher_id) {
                const { data: teacher } = await supabase
                    .from('Teachers')
                    .select('full_name, email')
                    .eq('teacher_id', classData.teacher_id)
                    .single();

                if (!error) {
                    teacherInfo = {
                        name: teacher.full_name,
                        email: teacher.email
                    };
                }
            }

            return {
                ...classData,
                teacherInfo
            };
        } catch (error) {
            console.error('Error getting class details:', error);
            return null;
        }
    }

    /**
     * Download report card with enhanced formatting
     */
    downloadReportCard(reportCard) {
        const content = this.formatReportCard(reportCard);
        const filename = this.generateFilename(reportCard);
        
        // Create download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show success message
        this.showNotification('Report downloaded successfully', 'success');
    }

    /**
     * Download batch reports as ZIP (placeholder)
     */
    downloadBatchReports(reportCards) {
        reportCards.forEach((reportCard, index) => {
            setTimeout(() => {
                this.downloadReportCard(reportCard);
            }, index * 500); // Stagger downloads
        });

        this.showNotification(`${reportCards.length} reports downloaded`, 'success');
    }

    /**
     * Format professional report card
     */
    formatReportCard(reportCard) {
        const isStudent = reportCard.studentInfo;
        const schoolName = this.schoolInfo?.name || 'Educational Institution';

        return `
╔══════════════════════════════════════════════════════════╗
║                    ${schoolName} - ACADEMIC REPORT CARD                    ║
╠══════════════════════════════════════════════════════╣
║                                                              ║
║  STUDENT ACADEMIC RECORD                                       ║
║                                                              ║
╠══════════════════════════════════════════════════════╣
║ Name: ${isStudent ? isStudent.name?.padEnd(35) : 'N/A'.padEnd(35)}                    ║
║ ID: ${isStudent ? isStudent.id?.toString().padEnd(25) : 'N/A'.padEnd(25)}                        ║
║ Class: ${reportCard.classInfo?.class_name || 'N/A'.padEnd(30)}                    ║
║ Admission: ${isStudent ? new Date(reportCard.studentInfo?.admissionDate).toLocaleDateString() : 'N/A'}          ║
║                                                              ║
╠══════════════════════════════════════════════════════╣
║                    ACADEMIC PERFORMANCE                                   ║
║                                                              ║
╠════════════════════════════════════════════════════╣
║ Term: ${reportCard.academicPerformance?.term || 'N/A'}                           ║
║ Overall GPA: ${reportCard.academicPerformance?.overallGPA?.toFixed(2) || 'N/A'}               ║
║ Overall Grade: ${reportCard.academicPerformance?.overallGrade || 'N/A'}                     ║
║ Total Assignments: ${reportCard.academicPerformance?.totalAssignments || 0}                   ║
║                                                              ║
╠══════════════════════════════════════════════════╣
║                    SUBJECT PERFORMANCE BREAKDOWN                           ║
║                                                              ║
${Object.entries(reportCard.academicPerformance?.subjectAverages || {})
    .map(([subject, data]) => {
        const subjectName = subject?.padEnd(25) || 'Unknown'.padEnd(25);
        const percentage = data?.averagePercentage || 0;
        const grade = data?.letterGrade || 'N/A';
        const assignments = data?.assignmentCount || 0;
        
        return `║ ${subjectName}: ${percentage}% (${grade}) - ${assignments} assignments${' '.padEnd(35)}║`;
    }).join('\n')}
╠══════════════════════════════════════════════════╣
║                                                              ║
║                    ADDITIONAL INFORMATION                                   ║
║                                                              ║
╠════════════════════════════════════════════════╣
║ Generated: ${new Date(reportCard.generatedAt).toLocaleString()}                    ║
║ Generated By: ${this.schoolInfo?.name || 'System'}                           ║
║                                                              ║
╚══════════════════════════════════════════════════════╝
        `;
    }

    /**
     * Generate filename for report
     */
    generateFilename(reportCard) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const studentName = reportCard.studentInfo?.name || 'student';
        const cleanName = studentName.replace(/[^a-zA-Z0-9]/g, '-');
        
        if (reportCard.type === 'class') {
            return `${cleanName}-class-report-${timestamp}.txt`;
        }
        
        return `${cleanName}-report-card-${timestamp}.txt`;
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateX(100%);
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Export for global use
window.ReportCardGenerator = ReportCardGenerator;
