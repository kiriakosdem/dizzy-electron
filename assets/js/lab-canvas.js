function labText(source, ...values) {
    const translated = window.siteLanguage?.translate(source) ?? source;
    return translated.replace(/\{(\d+)\}/g, (placeholder, index) => values[index] ?? placeholder);
}

// Keep generated labels in sync with the language without resetting the lab.
const labCopyBindings = new WeakMap();
let labCopyListenerAdded = false;
function setLabCopy(element, source, values = [], attribute) {
    if (window.siteLanguage && !labCopyListenerAdded) {
        labCopyListenerAdded = true;
        window.siteLanguage.onChange(() => {
            for (const target of document.querySelectorAll('[data-lab-copy]')) {
                labCopyBindings.get(target)?.forEach(update => update());
            }
        });
    }

    const update = () => {
        const value = typeof source === 'function' ? source() : labText(source, ...values);
        if (attribute) element.setAttribute(attribute, value);
        else element.textContent = value;
    };
    if (window.siteLanguage) {
        if (!labCopyBindings.has(element)) {
            labCopyBindings.set(element, new Map());
            element.setAttribute('data-lab-copy', '');
        }
        labCopyBindings.get(element).set(attribute, update);
    }
    update();
}


function setLabLabel(element, source) {
    setLabCopy(element, source, [], 'title');
    setLabCopy(element, source, [], 'aria-label');
}

const labCanvasStyle = document.documentElement && getComputedStyle(document.documentElement);
const labCanvasTheme = {
    background: labCanvasStyle?.getPropertyValue('--lab-scene-base').trim() || '#08182b',
    glow: labCanvasStyle?.getPropertyValue('--lab-scene-glow').trim() || 'rgb(29 51 74 / 48%)',
    glass: '#2c4056',
    accent: '#00bed0',
    grid: ['rgba(132,166,222,.055)', 'rgba(143,185,237,.14)', 'rgba(155,195,242,.23)'],
    point: '#fff',
    electric: '#ff7a1a',
    magnetic: '#50b8f0',
    ink: '#f6f3ed',
    secondary: '#b8c7d6',
    muted: '#9fafbf'
};

function paintLabBackdrop(context, width, height) {
    context.fillStyle = labCanvasTheme.background;
    context.fillRect(0, 0, width, height);
    const x = width * .58, y = height * .48;
    const glow = context.createRadialGradient(x, y, 0, x, y, Math.max(width, height) * .75);
    glow.addColorStop(0, labCanvasTheme.glow);
    glow.addColorStop(1, 'transparent');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
}

function paintLabSelection(context, x, y, radius, haloRadius = 0) {
    context.save();
    if (haloRadius) {
        const halo = context.createRadialGradient(x, y, radius / 2, x, y, haloRadius);
        halo.addColorStop(0, labCanvasTheme.accent);
        halo.addColorStop(1, 'transparent');
        context.globalAlpha = .25;
        context.fillStyle = halo;
        context.beginPath();
        context.arc(x, y, haloRadius, 0, Math.PI * 2);
        context.fill();
    }
    context.globalAlpha = .85;
    context.strokeStyle = labCanvasTheme.accent;
    context.lineWidth = 1.25;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
}

// Each lab supplies the frame it wants to export. Capture synchronously so a
// WebGL renderer can copy its drawing buffer before the browser clears it.
function setupLabCanvasTools(capture, filename) {
    const snapshot = document.getElementById('snapshotButton');
    const fullscreen = document.getElementById('fullscreenButton');
    const message = document.getElementById('canvasToolsMessage');
    let messageTimeout;

    function notify(text) {
        clearTimeout(messageTimeout);
        setLabCopy(message, text);
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
        setLabLabel(fullscreen, active ? 'Exit full screen' : 'Full screen');
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
    document.documentElement.setAttribute('data-lab-embedded', '');
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
