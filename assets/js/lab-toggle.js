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
    const root = document.documentElement;
    const compactViewport = window.matchMedia('(max-width: 892px), (max-height: 500px) and (max-width: 950px)');

    const playbackBar = document.querySelector('.time-bar');
    let compact;
    let canvasWidth = 0;
    let sidebarSections;
    let drawerSections;

    function updatePlaybackLayout() {
        if (playbackBar) {
            lab.classList.toggle('desktop-playback-layout', !compact && (!embedded || canvasWidth >= 600));
        }
    }

    if (embedded && playbackBar) {
        const canvasFrame = workspace.querySelector('.canvas-frame');
        new ResizeObserver(([entry]) => {
            // The sidebar takes space from the canvas in a lesson iframe.
            canvasWidth = entry.contentRect.width;
            updatePlaybackLayout();
        }).observe(canvasFrame);
    }

    function setOpen(open) {
        const drawerOpen = open && compact;
        if (drawerOpen && !sidebarSections) {
            const sections = [...document.querySelectorAll('#controlsPanel details.panel-section')];
            sidebarSections = sections.map(section => [section, section.open]);
            drawerSections ??= sections.map(section => [section, section.hasAttribute('data-drawer-default-open')]);
            for (const [section, wasOpen] of drawerSections) section.open = wasOpen;
        }
        panel.hidden = !open;
        if (drawerOpen) panel.scrollTop = 0;
        panel.inert = !open;
        backdrop.hidden = !drawerOpen;
        header.inert = drawerOpen;
        workspace.inert = drawerOpen;
        lab.classList.toggle('controls-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        setLabCopy(toggle, compact ? 'Controls' : open ? 'Hide controls' : 'Show controls', [], 'aria-label');
        $('controlsToggleIcon').setAttribute('d', open && !compact
            ? 'M5 5l10 10M15 5L5 15'
            : 'M3 5h4m4 0h6M9 3v4M3 10h8m4 0h2m-4-2v4M3 15h2m4 0h8M7 13v4');
    }

    function close() {
        if (panel.hidden) return;
        setOpen(false);
        toggle.focus({ preventScroll: true });
    }

    function updateLayout(open) {
        const active = document.activeElement;
        const focusWasInPanel = panel.contains(active);
        if (compact) {
            dock.append(toggle);
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            toggle.setAttribute('aria-haspopup', 'dialog');
        } else {
            if (sidebarSections) {
                drawerSections = sidebarSections.map(([section]) => [section, section.open]);
                for (const [section, wasOpen] of sidebarSections) section.open = wasOpen;
                sidebarSections = undefined;
            }
            header.append(toggle);
            panel.removeAttribute('role');
            panel.removeAttribute('aria-modal');
            toggle.removeAttribute('aria-haspopup');
        }
        setOpen(open);
        if (active === toggle || active === closeButton || focusWasInPanel) {
            const target = !panel.hidden && active.getClientRects().length ? active : toggle;
            target.focus({ preventScroll: true });
        }
    }

    function updateDisplayMode() {
        const fullscreen = embedded && (root.hasAttribute('data-lesson-fullscreen') ||
            document.fullscreenElement || document.webkitFullscreenElement);
        const nextCompact = compactViewport.matches && (!embedded || Boolean(fullscreen));
        if (compact === nextCompact) return;
        compact = nextCompact;
        // Fullscreen embeds use the same compact layout rules as standalone labs.
        if (embedded) root.toggleAttribute('data-lab-embedded', !compact);
        updatePlaybackLayout();
        updateLayout(!embedded && !compact);
    }

    toggle.addEventListener('click', () => {
        if (!panel.hidden) {
            close();
            return;
        }
        setOpen(true);
        if (compact) closeButton.focus({ preventScroll: true });
    });
    closeButton.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    compactViewport.addEventListener('change', updateDisplayMode);
    if (embedded) {
        document.addEventListener('lesson-display-mode', updateDisplayMode);
        document.addEventListener('fullscreenchange', updateDisplayMode);
        document.addEventListener('webkitfullscreenchange', updateDisplayMode);
    }

    window.addEventListener('keydown', event => {
        if (!compact || panel.hidden || document.querySelector('dialog[open]')) return;
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

    updateDisplayMode();
    return {
        get compact() { return compact; },
        close,
        get open() { return !panel.hidden; },
        get drawerOpen() { return compact && !panel.hidden; }
    };
})();
