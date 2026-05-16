import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

/**
 * Attendance Manager - Automated Attendance Tracking
 * Handles bulk attendance entry, SMS/Email notifications, and attendance analytics
 */

class AttendanceManager {
    constructor() {
        this.schoolInfo = null;
        this.attendanceSession = null;
    }

    /**
     * Initialize attendance manager
     */
    async initialize() {
        try {
            // Get school information
            const user = await waitForUser();
            if (!user?.user_metadata?.school_id) {
                throw new Error('School ID not found in user metadata');
            }

            this.schoolInfo = {
                name: user.user_metadata?.school_name || 'Educational Institution',
                enableSMS: user.user_metadata?.enable_sms || false,
                enableEmail: user.user_metadata?.enable_email_notifications || true,
                smsProvider: user.user_metadata?.sms_provider || null,
                emailFrom: user.user_metadata?.school_email || null
            };

            console.log('Attendance Manager initialized for:', this.schoolInfo.name);
            return true;
        } catch (error) {
            console.error('Failed to initialize Attendance Manager:', error);
            return false;
        }
    }

    /**
     * Mark all students present (bulk entry)
     */
    async markAllPresent(classId, date, options = {}) {
        try {
            // Get all students in the class
            const { data: students, error } = await supabase
                .from('Students')
                .select('student_id, full_name, parent_email, parent_phone')
                .eq('class_id', classId);

            if (error) throw error;

            if (!students || students.length === 0) {
                return {
                    success: false,
                    error: 'No students found in this class'
                };
            }

            // Prepare attendance records
            const attendanceRecords = students.map(student => ({
                student_id: student.student_id,
                class_id: classId,
                date: date,
                status: 'present',
                marked_by: 'system',
                marked_at: new Date().toISOString(),
                notes: options.notes || 'Bulk marked present by system'
            }));

            // Insert all attendance records
            const { data: insertedRecords, error: insertError } = await supabase
                .from('Attendance')
                .insert(attendanceRecords);

            if (insertError) throw insertError;

            // Send notifications if enabled
            const notificationPromises = [];
            
            if (this.schoolInfo.enableEmail) {
                notificationPromises.push(
                    ...this.sendEmailNotifications(students, 'present', date)
                );
            }

            if (this.schoolInfo.enableSMS && this.schoolInfo.smsProvider) {
                notificationPromises.push(
                    ...this.sendSMSNotifications(students, 'present', date)
                );
            }

            await Promise.allSettled(notificationPromises);

            return {
                success: true,
                markedStudents: students.length,
                date,
                classId,
                notifications: {
                    email: this.schoolInfo.enableEmail,
                    sms: this.schoolInfo.enableSMS
                }
            };
        } catch (error) {
            console.error('Error marking all present:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Mark individual student attendance
     */
    async markStudentAttendance(studentId, classId, date, status, notes = '') {
        try {
            const { data: existingRecord } = await supabase
                .from('Attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('class_id', classId)
                .eq('date', date)
                .single();

            const attendanceRecord = {
                student_id: studentId,
                class_id: classId,
                date: date,
                status: status,
                marked_by: 'teacher',
                marked_at: new Date().toISOString(),
                notes: notes
            };

            let result;
            
            if (existingRecord) {
                // Update existing record
                const { data: updatedRecord, error: updateError } = await supabase
                    .from('Attendance')
                    .update(attendanceRecord)
                    .eq('id', existingRecord.id);

                if (updateError) throw updateError;
                result = updatedRecord;
            } else {
                // Insert new record
                const { data: insertedRecord, error: insertError } = await supabase
                    .from('Attendance')
                    .insert(attendanceRecord);

                if (insertError) throw insertError;
                result = insertedRecord;
            }

            // Send notification to parent
            if (status === 'absent') {
                await this.notifyParent(studentId, 'absent', date);
            }

            return {
                success: true,
                attendance: result,
                action: existingRecord ? 'updated' : 'inserted'
            };
        } catch (error) {
            console.error('Error marking student attendance:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send email notifications to parents
     */
    async sendEmailNotifications(students, status, date) {
        try {
            const notifications = students.map(async (student) => {
                const { data: studentData } = await supabase
                    .from('Students')
                    .select('full_name, parent_email')
                    .eq('student_id', student.student_id)
                    .single();

                if (!studentData?.parent_email) return null;

                return {
                    to: studentData.parent_email,
                    from: this.schoolInfo.emailFrom,
                    subject: `Attendance Alert - ${status.toUpperCase()} on ${new Date(date).toLocaleDateString()}`,
                    html: this.generateAttendanceEmailHTML(student, status, date),
                    text: `Your child ${student.full_name} was marked ${status} on ${new Date(date).toLocaleDateString()}. Please contact the school if you have any questions.`
                };
            });

            // Send emails (placeholder - would integrate with email service)
            for (const notification of notifications) {
                if (notification) {
                    console.log('Email notification prepared for:', notification.to);
                    // In production, this would use: await supabase.functions.invoke('send-email', { body: notification });
                }
            }

            return notifications;
        } catch (error) {
            console.error('Error sending email notifications:', error);
            return [];
        }
    }

    /**
     * Send SMS notifications to parents
     */
    async sendSMSNotifications(students, status, date) {
        try {
            const notifications = students.map(async (student) => {
                const { data: studentData } = await supabase
                    .from('Students')
                    .select('full_name, parent_phone')
                    .eq('student_id', student.student_id)
                    .single();

                if (!studentData?.parent_phone) return null;

                return {
                    to: studentData.parent_phone,
                    message: this.generateAttendanceSMS(student, status, date),
                    provider: this.schoolInfo.smsProvider
                };
            });

            // Send SMS (placeholder - would integrate with SMS service)
            for (const notification of notifications) {
                if (notification) {
                    console.log('SMS notification prepared for:', notification.to);
                    // In production, this would use: await supabase.functions.invoke('send-sms', { body: notification });
                }
            }

            return notifications;
        } catch (error) {
            console.error('Error sending SMS notifications:', error);
            return [];
        }
    }

    /**
     * Generate attendance email HTML
     */
    generateAttendanceEmailHTML(student, status, date) {
        const statusColors = {
            present: '#10b981',
            absent: '#ef4444',
            late: '#f59e0b'
        };

        const statusColor = statusColors[status] || '#6b7280';

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                    <h2 style="margin: 0 0 10px 0;">Attendance Alert</h2>
                    <p style="font-size: 16px; margin: 10px 0;">
                        Your child <strong>${student.full_name}</strong> was marked <strong>${status.toUpperCase()}</strong> 
                        on <strong>${new Date(date).toLocaleDateString()}</strong>
                    </p>
                    <p style="font-size: 14px; margin-top: 10px;">
                        Please contact the school if you have any questions about this attendance record.
                    </p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 12px; color: #6b7280; margin: 0;">
                        This is an automated message from ${this.schoolInfo.name}.
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Generate attendance SMS message
     */
    generateAttendanceSMS(student, status, date) {
        const statusMessages = {
            present: `Your child ${student.full_name} was marked PRESENT on ${new Date(date).toLocaleDateString()}. Great job!`,
            absent: `Your child ${student.full_name} was marked ABSENT on ${new Date(date).toLocaleDateString()}. Please contact the school immediately.`,
            late: `Your child ${student.full_name} was marked LATE on ${new Date(date).toLocaleDateString()}. Please ensure they arrive on time.`
        };

        return statusMessages[status] || `Your child ${student.full_name} attendance status updated for ${new Date(date).toLocaleDateString()}.`;
    }

    /**
     * Get attendance statistics
     */
    async getAttendanceStats(classId, startDate, endDate) {
        try {
            const { data: attendance, error } = await supabase
                .from('Attendance')
                .select('*')
                .eq('class_id', classId)
                .gte('date', startDate)
                .lte('date', endDate);

            if (error) throw error;

            // Calculate statistics
            const stats = {
                total: attendance.length,
                present: attendance.filter(a => a.status === 'present').length,
                absent: attendance.filter(a => a.status === 'absent').length,
                late: attendance.filter(a => a.status === 'late').length,
                excused: attendance.filter(a => a.status === 'excused').length
            };

            // Calculate attendance rate
            stats.attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

            return {
                success: true,
                stats,
                period: { startDate, endDate }
            };
        } catch (error) {
            console.error('Error getting attendance stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Notify parent of student status change
     */
    async notifyParent(studentId, status, date) {
        try {
            const { data: student } = await supabase
                .from('Students')
                .select('full_name, parent_email, parent_phone')
                .eq('student_id', studentId)
                .single();

            if (!student) return;

            const notifications = [];

            if (student.parent_email && this.schoolInfo.enableEmail) {
                notifications.push(
                    await this.sendEmailNotifications([student], status, date)
                );
            }

            if (student.parent_phone && this.schoolInfo.enableSMS && this.schoolInfo.smsProvider) {
                notifications.push(
                    await this.sendSMSNotifications([student], status, date)
                );
            }

            return notifications;
        } catch (error) {
            console.error('Error notifying parent:', error);
            return [];
        }
    }
}

// Export for global use
window.AttendanceManager = AttendanceManager;
