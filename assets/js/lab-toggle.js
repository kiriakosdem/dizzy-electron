// Handle a completed touch tap directly, even before the iframe has focus.
// Mouse and keyboard activation continue through the button's native click.
(() => {
    const button = document.getElementById('controlsToggle');
    let start;
    button.addEventListener('touchstart', event => {
        start = event.touches.length === 1 ? event.touches[0] : null;
    }, { passive: true });
    button.addEventListener('touchcancel', () => { start = null; });
    button.addEventListener('touchend', event => {
        const touch = event.changedTouches[0];
        const first = start;
        start = null;
        if (!first || !event.cancelable || event.touches.length || first.identifier !== touch.identifier) return;
        if (Math.hypot(touch.clientX - first.clientX, touch.clientY - first.clientY) > 10) return;
        if (!button.contains(document.elementFromPoint(touch.clientX, touch.clientY))) return;
        event.preventDefault(); // Suppress the follow-up compatibility click.
        button.focus({ preventScroll: true });
        button.click();
    }, { passive: false });
})();
