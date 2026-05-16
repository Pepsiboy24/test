// Modal functionality for creating new classes
document.addEventListener('DOMContentLoaded', function() {
    const createClassBtn = document.getElementById('createClassBtn');
    const modal = document.getElementById('createClassModal');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const overlay = document.getElementById('overlay');

    // Open modal when "Create New Class" is clicked
    if (createClassBtn) {
        createClassBtn.addEventListener('click', function() {
            if (modal) {
                modal.style.display = 'block';
                overlay.style.display = 'block';
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            }
        });
    }

    // Close modal functions
    function closeModal() {
        if (modal) {
            modal.style.display = 'none';
            overlay.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scrolling
            document.getElementById('createClassForm').reset(); // Reset form
        }
    }

    // Close modal when close button is clicked
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    // Close modal when cancel button is clicked
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    // Close modal when clicking on overlay
    if (overlay) {
        overlay.addEventListener('click', closeModal);
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.style.display === 'block') {
            closeModal();
        }
    });
});

// mobileMenuBtn.addEventListener("click", () => {
//   sidebar.classList.add("active");
//   overlay.classList.add("active");
// });

// menuToggle.addEventListener("click", () => {
//   sidebar.classList.remove("active");
//   overlay.classList.remove("active");
// });

// overlay.addEventListener("click", () => {
//   sidebar.classList.remove("active");
// });
