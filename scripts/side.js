const sideBarOpen = document.querySelector("[data-sideBarOpen]");
const sideBarClose = document.querySelector("[data-sideBarClose]");
const sidebar = document.querySelector("[data-sidebar]");
// const sidebarBar = document.querySelector("[data-sidebarBar]");

console.log(sideBarOpen)
// console.log(sidebar)

sideBarOpen.addEventListener("click", () => {
    console.log("working")
    sidebar.classList.add("show")
    // sidebarBar.classList.add("display")
})
sideBarClose.addEventListener("click", () => {
    console.log("working")
    sidebar.classList.remove("show")
    // sidebarBar.classList.remove("display")
})