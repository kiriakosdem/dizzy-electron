// Each lab supplies the frame it wants to export. Capture synchronously so a
// WebGL renderer can copy its drawing buffer before the browser clears it.
function setupLabCanvasTools(capture, filename) {
    const snapshot = document.getElementById('snapshotButton');
    const fullscreen = document.getElementById('fullscreenButton');
    const message = document.getElementById('canvasToolsMessage');
    let messageTimeout;

    function notify(text) {
        clearTimeout(messageTimeout);
        message.textContent = text;
        message.hidden = false;
        messageTimeout = setTimeout(() => { message.hidden = true; }, 4000);
    }

    snapshot.addEventListener('click', () => {
        try {
            const frame = capture();
            if (!frame || !frame.width || !frame.height) {
                notify('The simulation needs a rendered frame to save a snapshot.');
                return;
            }
            const name = filename();
            frame.toBlob(blob => {
                if (!blob) {
                    notify('The snapshot could not be saved.');
                    return;
                }
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = name;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 'image/png');
        } catch {
            notify('The snapshot could not be saved.');
        }
    });

    function isFullscreen() {
        return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function updateFullscreenButton() {
        const active = isFullscreen();
        fullscreen.title = active ? 'Exit full screen' : 'Full screen';
        fullscreen.setAttribute('aria-label', fullscreen.title);
        fullscreen.setAttribute('aria-pressed', String(active));
    }

    fullscreen.addEventListener('click', async () => {
        const active = isFullscreen();
        const target = active ? document : document.documentElement;
        const toggle = active ? document.exitFullscreen || document.webkitExitFullscreen
                              : target.requestFullscreen || target.webkitRequestFullscreen;
        try {
            if (toggle) await toggle.call(target);
            else notify('Full screen is unavailable in this browser.');
        } catch {
            notify('Full screen is unavailable here.');
        }
    });
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    updateFullscreenButton();
}

// The electric and gravitational canvases extend behind the desktop drawer.
function visibleFieldSnapshot(canvas, panel) {
    if (panel.hidden) return canvas;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.round(canvas.width * (panel.getBoundingClientRect().left - bounds.left) / bounds.width);
    if (width <= 0) return null;
    if (width >= canvas.width) return canvas;
    const frame = document.createElement('canvas');
    frame.width = width;
    frame.height = canvas.height;
    frame.getContext('2d').drawImage(canvas, 0, 0);
    return frame;
}

// In a lesson, wheel gestures belong to the reading page. Capture before the
// canvas/OrbitControls handlers, but keep the browser's native scroll chaining.
(() => {
    if (window.parent === window) return;
    const fullscreen = () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) return true;
        try {
            if (window.frameElement?.closest('dialog[open]')) return true;
            const active = parent.document.fullscreenElement || parent.document.webkitFullscreenElement;
            return Boolean(active && active.contains(window.frameElement));
        } catch {
            return false;
        }
    };
    window.addEventListener('message', event => {
        if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'lesson-display-mode') return;
        document.documentElement.toggleAttribute('data-lesson-fullscreen', event.data.fullscreen === true);
    });
    window.addEventListener('wheel', event => {
        if (!fullscreen() && event.target instanceof Element && event.target.closest('canvas')) {
            event.stopImmediatePropagation();
        }
    }, { capture: true, passive: true });
    window.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
        // Let an open controls drawer handle Escape first.
        if (document.querySelector('#controlsToggle[aria-expanded="true"]')) return;
        parent.postMessage({ type: 'lesson-return-reading' }, location.origin);
    });
})();
