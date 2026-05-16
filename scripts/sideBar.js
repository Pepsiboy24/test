document.addEventListener("click", (e) => {
    // 1. Check if the click was on the OPEN button
    if (e.target.closest("[data-sideBarOpen]")) {
        const sidebar = document.querySelector("[data-sideBar]");
        if (sidebar) {
            sidebar.classList.add("show");
            console.log("Sidebar opened");
        }
    }

    // 2. Check if the click was on the CLOSE button
    // Using "Event Delegation" because this button is added dynamically
    if (e.target.closest("[data-sideBarClose]")) {
        const sidebar = document.querySelector("[data-sideBar]");
        if (sidebar) {
            sidebar.classList.remove("show");
            console.log("Sidebar closed");
        }
    }
});