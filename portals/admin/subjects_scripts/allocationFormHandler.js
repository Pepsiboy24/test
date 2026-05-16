document.addEventListener('DOMContentLoaded', function () {
import { waitForUser } from '/core/perf.js';
    const allocationForm = document.getElementById('allocationForm');
    const clearBtn = document.getElementById('clearAllocationBtn');
    const allocateBtn = document.getElementById('allocateBtn');
    const allocationsTableBody = document.getElementById('allocationsTableBody');
    
    // Initialize subject allocation manager
    const allocationManager = new SubjectAllocationManager();
    
    // Initialize when page loads
    initializeAllocationForm();

    async function initializeAllocationForm() {
        try {
            const user = await waitForUser();
            if (!user?.user_metadata?.school_id) {
                console.warn('Strict Guard: No school_id found. Execution blocked.');
                return;
            }

            await allocationManager.initialize();
            
            // Setup form submission
            allocationForm.addEventListener('submit', handleAllocationSubmit);
            
            // Setup clear button
            clearBtn.addEventListener('click', clearAllocationForm);
            
            // Populate dropdowns
            allocationManager.populateDropdowns(
                document.getElementById('allocationSubject'),
                document.getElementById('allocationClass'),
                document.getElementById('allocationTeacher')
            );
            
            // Load existing allocations
            await loadAllocations();
            
            console.log('Allocation form initialized');
        } catch (error) {
            console.error('Failed to initialize allocation form:', error);
            showToast('Failed to initialize allocation form', 'error');
        }
    }

    async function handleAllocationSubmit(e) {
        e.preventDefault();
        
        const formData = {
            subjectId: document.getElementById('allocationSubject').value,
            classId: document.getElementById('allocationClass').value,
            teacherId: document.getElementById('allocationTeacher').value
        };

        // Validate form
        if (!formData.subjectId || !formData.classId || !formData.teacherId) {
            showToast('Please select subject, class, and teacher', 'error');
            return;
        }

        // Show loading state
        const originalText = allocateBtn.textContent;
        allocateBtn.disabled = true;
        allocateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Allocating...';

        try {
            // Allocate subject using allocation manager
            const result = await allocationManager.allocateSubject(formData);
            
            if (result.success) {
                showToast(result.message, 'success');
                clearAllocationForm();
                await loadAllocations(); // Refresh allocations table
            } else {
                showToast(result.error, 'error');
            }
        } catch (error) {
            console.error('Error allocating subject:', error);
            showToast('Failed to allocate subject. Please try again.', 'error');
        } finally {
            // Restore button state
            allocateBtn.disabled = false;
            allocateBtn.textContent = originalText;
        }
    }

    function clearAllocationForm() {
        allocationForm.reset();
        // Re-populate dropdowns to reset to default state
        allocationManager.populateDropdowns(
            document.getElementById('allocationSubject'),
            document.getElementById('allocationClass'),
            document.getElementById('allocationTeacher')
        );
    }

    async function loadAllocations() {
        try {
            const result = await allocationManager.getAllocations();
            
            if (result.success) {
                renderAllocationsTable(result.allocations);
            } else {
                console.error('Error loading allocations:', result.error);
                showToast('Failed to load allocations', 'error');
            }
        } catch (error) {
            console.error('Error loading allocations:', error);
            showToast('Failed to load allocations', 'error');
        }
    }

    function renderAllocationsTable(allocations) {
        allocationsTableBody.innerHTML = '';
        
        if (allocations.length === 0) {
            allocationsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">
                        No subject allocations found
                    </td>
                </tr>
            `;
            return;
        }

        allocations.forEach(allocation => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${allocation.Subjects?.subject_name || 'N/A'}</td>
                <td>${allocation.Classes?.class_name || 'N/A'} ${allocation.Classes?.section || ''}</td>
                <td>${allocation.Teachers?.first_name || 'N/A'} ${allocation.Teachers?.last_name || ''}</td>
                <td>
                    <span class="badge ${allocation.Subjects?.is_core ? 'badge-core' : 'badge-elective'}">
                        ${allocation.Subjects?.is_core ? 'Core' : 'Elective'}
                    </span>
                </td>
                <td>
                    <button class="btn-action btn-danger" onclick="removeAllocation('${allocation.allocation_id}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </td>
            `;
            allocationsTableBody.appendChild(row);
        });
    }

    // Make removeAllocation available globally
    window.removeAllocation = async function(allocationId) {
        if (!confirm('Are you sure you want to remove this allocation?')) {
            return;
        }

        try {
            const result = await allocationManager.removeAllocation(allocationId);
            
            if (result.success) {
                showToast(result.message, 'success');
                await loadAllocations(); // Refresh table
            } else {
                showToast(result.error, 'error');
            }
        } catch (error) {
            console.error('Error removing allocation:', error);
            showToast('Failed to remove allocation', 'error');
        }
    };
});
