import { supabase as supabaseClient } from '../../config.js';

// --- Utility: Debounce Function ---
// Prevents the API from being called 100 times if you type fast
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('teacherSearchInput');
  const dropdownOptions = document.getElementById('teacherDropdownOptions');

  // Track the currently highlighted item index (-1 means nothing selected)
  let currentFocus = -1;

  if (!searchInput || !dropdownOptions) return;

  // 1. INPUT EVENT (With Debounce)
  // ---------------------------------------------------------
  const handleSearch = async (e) => {
    const searchTerm = e.target.value.trim();

    // Reset focus when typing
    currentFocus = -1;

    if (searchTerm === '') {
      closeDropdown();
      return;
    }

    try {
      const { data: teachers, error } = await supabaseClient
        .from('Teachers')
        .select('first_name')
        .ilike('first_name', `%${searchTerm}%`)
        .limit(10); // Good practice to limit results

      if (error) throw error;

      // Clear current list
      dropdownOptions.innerHTML = '';

      if (teachers && teachers.length > 0) {
        // Show the dropdown
        dropdownOptions.style.display = 'block';

        teachers.forEach((teacher) => {
          const optionEl = document.createElement('div');
          optionEl.textContent = teacher.first_name;
          optionEl.classList.add('dropdown-item'); // Add class for styling

          // Handle Mouse Click Selection
          optionEl.addEventListener('click', function () {
            selectItem(teacher.first_name);
          });

          dropdownOptions.appendChild(optionEl);
        });
      } else {
        renderNoResults();
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
    }
  };

  // Attach the debounced search (waits 300ms after typing stops)
  searchInput.addEventListener('input', debounce(handleSearch, 300));


  // 2. KEYBOARD NAVIGATION
  // ---------------------------------------------------------
  searchInput.addEventListener('keydown', function (e) {
    let items = dropdownOptions.getElementsByTagName('div');
    if (e.key === 'ArrowDown') {
      currentFocus++;
      addActive(items);
      // Scroll into view if needed
      if (items[currentFocus]) items[currentFocus].scrollIntoView({ block: 'nearest' });
    }
    else if (e.key === 'ArrowUp') {
      currentFocus--;
      addActive(items);
      if (items[currentFocus]) items[currentFocus].scrollIntoView({ block: 'nearest' });
    }
    else if (e.key === 'Enter') {
      e.preventDefault(); // Stop form submission if inside a form
      if (currentFocus > -1 && items) {
        items[currentFocus].click(); // Simulate a click on the active item
      }
    }
    else if (e.key === 'Escape') {
      closeDropdown();
    }
  });


  // 3. HELPER FUNCTIONS
  // ---------------------------------------------------------
  function addActive(items) {
    if (!items) return false;
    removeActive(items);

    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);

    // Add "active" class to the current item
    items[currentFocus].classList.add('dropdown-active');
  }

  function removeActive(items) {
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('dropdown-active');
    }
  }

  function selectItem(name) {
    searchInput.value = name;
    closeDropdown();
    // Optional: Trigger a custom event or callback here if you need to do something with the selection
    console.log("Selected:", name);
  }

  function closeDropdown() {
    dropdownOptions.innerHTML = '';
    dropdownOptions.style.display = 'none';
    currentFocus = -1;
  }

  function renderNoResults() {
    dropdownOptions.innerHTML = '<div style="padding:10px; color:#888;">No teachers found</div>';
    dropdownOptions.style.display = 'block';
  }

  // 4. CLICK OUTSIDE TO CLOSE
  // ---------------------------------------------------------
  document.addEventListener('click', function (e) {
    if (e.target !== searchInput && e.target !== dropdownOptions) {
      closeDropdown();
    }
  });
});