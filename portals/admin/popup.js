const singleReg = document.querySelector('[data-singleReg]');
const popup = document.querySelector("[data-popup]");
const closeIcon = popup.querySelector("[data-closeIcon]");

singleReg.addEventListener("click", () => {
    popup.style.display = "flex";
})
closeIcon.addEventListener("click", () => {
    popup.style.display = "none";
})
