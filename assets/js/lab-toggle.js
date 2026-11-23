const labControls = (() => {
    const $ = id => document.getElementById(id);
    const lab = $('lab');
    const header = document.querySelector('.lab-header');
    const workspace = document.querySelector('.lab-workspace');
    const dock = document.querySelector('.canvas-dock, .orbital-controls');
    const toggle = $('controlsToggle');
    const closeButton = $('controlsClose');
    const panel = $('controlsPanel');
    const backdrop = $('controlsBackdrop');
    const embedded = window.self !== window.top;
    const compact = window.matchMedia(embedded ? 'not all' : '(max-width: 892px), (max-height: 500px) and (max-width: 950px)');

    const playbackBar = document.querySelector('.time-bar');
    const simulationReset = $('simulationReset');
    const reset = playbackBar?.querySelector('.playback-reset');
    const timer = playbackBar?.querySelector('[role="timer"]');
    let sidebarSections;

    if (embedded && playbackBar) {
        const canvasFrame = workspace.querySelector('.canvas-frame');
        new ResizeObserver(([entry]) => {
            // The sidebar takes space from the canvas in a lesson iframe.
            lab.classList.toggle('desktop-playback-layout', entry.contentRect.width >= 600);
        }).observe(canvasFrame);
    }

    function setOpen(open) {
        const drawerOpen = open && compact.matches;
        if (drawerOpen) {
            const sections = [...document.querySelectorAll('#controlsPanel details.panel-section')];
            sidebarSections ??= sections.map(section => [section, section.open]);
            for (const section of sections) section.open = section.hasAttribute('data-drawer-default-open');
        }
        panel.hidden = !open;
        if (drawerOpen) panel.scrollTop = 0;
        panel.inert = !open;
        backdrop.hidden = !drawerOpen;
        header.inert = drawerOpen;
        workspace.inert = drawerOpen;
        lab.classList.toggle('controls-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        setLabCopy(toggle, compact.matches ? 'Controls' : open ? 'Hide controls' : 'Show controls', [], 'aria-label');
        $('controlsToggleIcon').setAttribute('d', open && !compact.matches
            ? 'M5 5l10 10M15 5L5 15'
            : 'M3 5h4m4 0h6M9 3v4M3 10h8m4 0h2m-4-2v4M3 15h2m4 0h8M7 13v4');
    }

    function close() {
        if (panel.hidden) return;
        setOpen(false);
        toggle.focus({ preventScroll: true });
    }

    function updateLayout(open) {
        if (!embedded && playbackBar) lab.classList.toggle('desktop-playback-layout', !compact.matches);
        const active = document.activeElement;
        const focusWasInPanel = panel.contains(active);
        if (compact.matches) {
            dock.append(toggle);
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            toggle.setAttribute('aria-haspopup', 'dialog');
        } else {
            if (sidebarSections) {
                for (const [section, wasOpen] of sidebarSections) section.open = wasOpen;
                sidebarSections = undefined;
            }
            header.append(toggle);
            panel.removeAttribute('role');
            panel.removeAttribute('aria-modal');
            toggle.removeAttribute('aria-haspopup');
        }
        if (reset) {
            if (compact.matches) simulationReset.append(reset);
            else timer.before(reset);
        }

        setOpen(open);
        if (compact.matches && open) {
            closeButton.focus({ preventScroll: true });
        } else if (active === toggle || active === closeButton || focusWasInPanel) {
            const target = !panel.hidden && active.getClientRects().length ? active : toggle;
            target.focus({ preventScroll: true });
        }
    }

    toggle.addEventListener('click', () => {
        if (!panel.hidden) {
            close();
            return;
        }
        setOpen(true);
        if (compact.matches) closeButton.focus({ preventScroll: true });
    });
    closeButton.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    compact.addEventListener('change', () => updateLayout(embedded ? !panel.hidden : !compact.matches));

    window.addEventListener('keydown', event => {
        if (!compact.matches || panel.hidden || document.querySelector('dialog[open]')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
        }
        if (event.key !== 'Tab') return;
        const focusable = [...panel.querySelectorAll('button, input, select, summary, a[href]')]
            .filter(element => {
                if (element.disabled || !element.getClientRects().length) return false;
                const closedDetails = element.closest('details:not([open])');
                return !closedDetails || closedDetails.querySelector('summary') === element;
            });
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!panel.contains(active) || active === (event.shiftKey ? first : last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
    }, true);

    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) close();
        });
    });

    // A completed tap should work even before the lesson iframe has focus.
    for (const button of [toggle, closeButton]) {
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
            event.preventDefault();
            button.focus({ preventScroll: true });
            button.click();
        }, { passive: false });
    }

    updateLayout(!embedded && !compact.matches);
    return {
        compact,
        close,
        get open() { return !panel.hidden; },
        get drawerOpen() { return compact.matches && !panel.hidden; }
    };
})();
