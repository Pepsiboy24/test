import { supabase } from '../../core/config.js';

/**
 * Results Engine - Academic Performance Analytics
 * Calculates student averages, class positions, and generates professional report cards
 */

class ResultsEngine {
    constructor() {
        this.gradingScale = {
            'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 
            'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 
            'D-': 0.7, 'E': 0.0, 'F': 0.0
        };
    }

    /**
     * Calculate GPA from grade points
     */
    calculateGPA(gradePoints, totalPoints = 100) {
        return (gradePoints / totalPoints) * 4.0;
    }

    /**
     * Convert letter grade to points
     */
    gradeToPoints(grade) {
        return this.gradingScale[grade] || 0.0;
    }

    /**
     * Calculate class average for a specific subject
     */
    async calculateSubjectAverage(studentId, subjectId, term = 'First Term') {
        try {
            const { data: grades, error } = await supabase
                .from('Grades')
                .select('score, max_score')
                .eq('student_id', studentId)
                .eq('subject_id', subjectId)
                .eq('term', term);

            if (error) throw error;

            if (!grades || grades.length === 0) return null;

            const totalScore = grades.reduce((sum, grade) => sum + grade.score, 0);
            const totalMaxScore = grades.reduce((sum, grade) => sum + grade.max_score, 0);
            const averagePercentage = (totalScore / totalMaxScore) * 100;

            return {
                averagePercentage: Math.round(averagePercentage * 100) / 100,
                letterGrade: this.getLetterGrade(averagePercentage),
                totalAssignments: grades.length,
                averageScore: Math.round(totalScore / grades.length * 100) / 100
            };
        } catch (error) {
            console.error('Error calculating subject average:', error);
            return null;
        }
    }

    /**
     * Get letter grade from percentage
     */
    getLetterGrade(percentage) {
        if (percentage >= 97) return 'A+';
        if (percentage >= 93) return 'A';
        if (percentage >= 90) return 'A-';
        if (percentage >= 87) return 'B+';
        if (percentage >= 83) return 'B';
        if (percentage >= 80) return 'B-';
        if (percentage >= 77) return 'C+';
        if (percentage >= 73) return 'C';
        if (percentage >= 70) return 'C-';
        if (percentage >= 67) return 'D+';
        if (percentage >= 60) return 'D';
        return `
╔════════════════════════════════════════════════════╗
║                    ${schoolName} - ACADEMIC REPORT CARD                    ║
╠════════════════════════════════════════════════╣
║                                                              ║
║  STUDENT ACADEMIC RECORD                                       ║
║                                                              ║
╠══════════════════════════════════════════════╣
║ Name: ${isStudent ? isStudent.name?.padEnd(35) : 'N/A'.padEnd(35)}                    ║
║ ID: ${isStudent ? isStudent.id?.toString().padEnd(25) : 'N/A'.padEnd(25)}                        ║
║ Class: ${reportCard.classInfo?.class_name || 'N/A'.padEnd(30)}                    ║
║ Admission: ${isStudent ? new Date(reportCard.studentInfo?.admissionDate).toLocaleDateString() : 'N/A'}          ║
║                                                              ║
╠══════════════════════════════════════════════╣
║                    ACADEMIC PERFORMANCE                                   ║
║                                                              ║
╠════════════════════════════════════════════╣
║ Term: ${reportCard.academicPerformance?.term || 'N/A'}                           ║
║ Overall GPA: ${reportCard.academicPerformance?.overallGPA?.toFixed(2) || 'N/A'}               ║
║ Overall Grade: ${reportCard.academicPerformance?.overallGrade || 'N/A'}                     ║
║ Total Assignments: ${reportCard.academicPerformance?.totalAssignments || 0}                   ║
║                                                              ║
╠════════════════════════════════════════════╣
║                    SUBJECT PERFORMANCE BREAKDOWN                           ║
║                                                              ║
${Object.entries(reportCard.academicPerformance?.subjectAverages || {})
    .map(([subjectId, data]) => {
        const subjectName = subjectId?.padEnd(25) || 'Unknown'.padEnd(25);
        const percentage = data?.averagePercentage || 0;
        const grade = data?.letterGrade || 'N/A';
        const assignments = data?.assignmentCount || 0;
        
        return `║ ${subjectName}: ${percentage}% (${grade}) - ${assignments} assignments${' '.padEnd(35)}║`;
    }).join('\n')}
╠════════════════════════════════════════════╣
║                                                              ║
║                    ADDITIONAL INFORMATION                                   ║
║                                                              ║
╠════════════════════════════════════════════╣
║ Generated: ${new Date(reportCard.generatedAt).toLocaleString()}                    ║
║ Generated By: ${this.schoolInfo?.name || 'System'}                           ║
║                                                              ║
╚════════════════════════════════════════════════════╝
        `;
    }

    /**
     * Calculate overall class performance
     */
    async calculateClassPerformance(classId, term = 'First Term') {
        try {
            // Get all students in the class
            const { data: students, error } = await supabase
                .from('Students')
                .select('student_id, full_name')
                .eq('class_id', classId);

            if (error) throw error;

            if (!students || students.length === 0) {
                return {
                    totalStudents: 0,
                    classAverage: 0,
                    gradeDistribution: {},
                    topPerformers: []
                };
            }

            // Calculate performance for each student
            const studentPerformances = await Promise.all(
                students.map(async (student) => {
                    const performance = await this.calculateStudentPerformance(student.student_id, term);
                    return {
                        studentId: student.student_id,
                        studentName: student.full_name,
                        ...performance
                    };
                })
            );

            const classAverage = studentPerformances.reduce((sum, student) => {
                const avg = student.studentPerformance?.averagePercentage || 0;
                return sum + avg;
            }, 0) / studentPerformances.length;

            // Calculate grade distribution
            const gradeDistribution = {};
            studentPerformances.forEach(student => {
                const grade = student.studentPerformance?.letterGrade || 'F';
                gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
            });

            // Get top performers
            const topPerformers = studentPerformances
                .filter(student => student.studentPerformance?.letterGrade && ['A+', 'A', 'A-', 'B+'].includes(student.studentPerformance.letterGrade))
                .sort((a, b) => (b.studentPerformance?.averagePercentage || 0) - (a.studentPerformance?.averagePercentage || 0))
                .slice(0, 5);

            return {
                totalStudents: students.length,
                classAverage: Math.round(classAverage * 100) / 100,
                gradeDistribution,
                topPerformers,
                studentPerformances
            };
        } catch (error) {
            console.error('Error calculating class performance:', error);
            return null;
        }
    }

    /**
     * Calculate individual student performance
     */
    async calculateStudentPerformance(studentId, term = 'First Term') {
        try {
            // Get all grades for the student
            const { data: grades, error } = await supabase
                .from('Grades')
                .select('subject_id, score, max_score')
                .eq('student_id', studentId)
                .eq('term', term);

            if (error) throw error;

            if (!grades || grades.length === 0) {
                return {
                    averagePercentage: 0,
                    letterGrade: 'F',
                    subjectAverages: {},
                    totalAssignments: 0
                };
            }

            // Group grades by subject
            const subjectGrades = {};
            grades.forEach(grade => {
                if (!subjectGrades[grade.subject_id]) {
                    subjectGrades[grade.subject_id] = [];
                }
                subjectGrades[grade.subject_id].push(grade);
            });

            // Calculate average for each subject
            const subjectAverages = {};
            for (const [subjectId, subjectGradesList] of Object.entries(subjectGrades)) {
                const totalScore = subjectGradesList.reduce((sum, grade) => sum + grade.score, 0);
                const totalMaxScore = subjectGradesList.reduce((sum, grade) => sum + grade.max_score, 0);
                const averagePercentage = (totalScore / totalMaxScore) * 100;

                subjectAverages[subjectId] = {
                    averagePercentage: Math.round(averagePercentage * 100) / 100,
                    letterGrade: this.getLetterGrade(averagePercentage),
                    assignmentCount: subjectGradesList.length
                };
            }

            // Calculate overall average
            const totalScore = grades.reduce((sum, grade) => sum + grade.score, 0);
            const totalMaxScore = grades.reduce((sum, grade) => sum + grade.max_score, 0);
            const overallAveragePercentage = (totalScore / totalMaxScore) * 100;

            return {
                averagePercentage: Math.round(overallAveragePercentage * 100) / 100,
                letterGrade: this.getLetterGrade(overallAveragePercentage),
                subjectAverages,
                totalAssignments: grades.length
            };
        } catch (error) {
            console.error('Error calculating student performance:', error);
            return null;
        }
    }

    /**
     * Generate professional report card
     */
    async generateReportCard(studentId, term = 'First Term') {
        try {
            const { data: student } = await supabase
                .from('Students')
                .select('full_name, admission_date, class_id')
                .eq('student_id', studentId)
                .single();

            if (error) throw error;

            const { data: performance } = await this.calculateStudentPerformance(studentId, term);
            if (!performance) throw new Error('Unable to calculate performance data');

            const { data: classData } = await supabase
                .from('Classes')
                .select('class_name, section')
                .eq('class_id', student.class_id)
                .single();

            const reportCard = {
                studentInfo: {
                    name: student.full_name,
                    admissionNumber: student.student_id,
                    admissionDate: student.admission_date,
                    class: `${classData?.class_name || 'N/A'} ${classData?.section || ''}`.trim()
                },
                academicPerformance: {
                    term,
                    overallGPA: this.calculateGPA(performance.averagePercentage),
                    overallGrade: performance.letterGrade,
                    subjectAverages: performance.subjectAverages
                },
                generatedAt: new Date().toISOString()
            };

            return reportCard;
        } catch (error) {
            console.error('Error generating report card:', error);
            return null;
        }
    }

    /**
     * Export report card as PDF (placeholder - would need PDF library)
     */
    exportReportCardToPDF(reportCard) {
        // This would integrate with a PDF library like jsPDF
        console.log('PDF export feature - placeholder implementation');
        console.log('Report Card:', reportCard);
        
        // For now, return formatted text for download
        const reportText = this.formatReportCardForText(reportCard);
        this.downloadReport(reportText, `report-card-${reportCard.studentInfo.admissionNumber}.txt`);
    }

    /**
     * Format report card for text download
     */
    formatReportCardForText(reportCard) {
        return `
ACADEMIC REPORT CARD
========================

Student Information:
-------------------
Name: ${reportCard.studentInfo.name}
Admission Number: ${reportCard.studentInfo.admissionNumber}
Admission Date: ${new Date(reportCard.studentInfo.admissionDate).toLocaleDateString()}
Class: ${reportCard.studentInfo.class}

Academic Performance:
-------------------
Term: ${reportCard.academicPerformance.term}
Overall GPA: ${reportCard.academicPerformance.overallGPA.toFixed(2)}
Overall Grade: ${reportCard.academicPerformance.overallGrade}

Subject Breakdown:
-------------------
${Object.entries(reportCard.academicPerformance.subjectAverages)
    .map(([subjectId, data]) => 
        `${subjectId}: ${data.averagePercentage}% (${data.letterGrade}) - ${data.assignmentCount} assignments`
    ).join('\n')

Generated: ${reportCard.generatedAt}
        `;
    }

    /**
     * Download report file
     */
    downloadReport(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Export the ResultsEngine
export { ResultsEngine };
