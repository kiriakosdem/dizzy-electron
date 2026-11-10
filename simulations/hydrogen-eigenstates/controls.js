(() => {
    'use strict';
    const embedded = window.self !== window.top;
    const $ = id => document.getElementById(id);
    const lab = $('lab'), panel = $('controlsPanel'), viewport = $('viewport');
    const compact = matchMedia('(max-width:750px), (max-height:500px) and (max-width:950px)');

    function setPanel(open, returnFocus = false) {
        panel.hidden = !open;
        lab.classList.toggle('controls-open', open);
        $('controlsBackdrop').hidden = !(open && compact.matches);
        $('controlsToggle').setAttribute('aria-expanded', String(open));
        $('controlsToggle').setAttribute('aria-label', open ? 'Hide controls' : 'Show controls');
        $('controlsToggleIcon').setAttribute('d', open ? 'M5 5l10 10M15 5L5 15' : 'M3 5h14M3 10h14M3 15h14');
        viewport.inert = compact.matches && open;
        if (returnFocus) $('controlsToggle').focus({preventScroll: true});
    }
    $('controlsToggle').addEventListener('click', () => setPanel(panel.hidden));
    $('controlsBackdrop').addEventListener('click', () => setPanel(false, true));
    compact.addEventListener('change', () => setPanel(embedded ? !panel.hidden : !compact.matches));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) setPanel(false, true);
        if (event.key === 'Tab' && compact.matches && !panel.hidden) {
            const targets = [$('controlsToggle'), ...panel.querySelectorAll('select, input, button, summary, details[open] a')].filter(element => element.getClientRects().length);
            const first = targets[0], last = targets[targets.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    setPanel(!embedded && !compact.matches);
})();
