// Keep native focus and keyboard navigation, including when an input is already focused.
(() => {
    const root = document.documentElement;
    const clearPointerFocus = () => root.removeAttribute('data-pointer-focus');

    window.addEventListener('pointerdown', () => root.setAttribute('data-pointer-focus', ''), true);
    window.addEventListener('keydown', clearPointerFocus, true);
    window.addEventListener('blur', clearPointerFocus);
})();
