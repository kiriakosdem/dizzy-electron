'use strict';

// Use the reference navbar's Bootstrap classes without requiring jQuery.
const menuToggle = document.querySelector('[data-lesson-menu]');
const navigation = document.getElementById('RightBox');
const dropdownButtons = [...document.querySelectorAll('[data-lesson-dropdown]')];

const setDropdown = (button, open) => {
    button.setAttribute('aria-expanded', String(open));
    document.getElementById(button.getAttribute('aria-controls')).classList.toggle('show', open);
};

const closeDropdowns = () => dropdownButtons.forEach((button) => setDropdown(button, false));

const setMenu = open => {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Σύμπτυξη πλοήγησης' : 'Εμφάνιση πλοήγησης');
    navigation.classList.toggle('show', open);
    if (!open) closeDropdowns();
};

if (menuToggle && navigation) {
    menuToggle.addEventListener('click', () => {
        setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
}

dropdownButtons.forEach((button) => {
    const dropdown = button.closest('.dropdown');
    dropdown.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        closeDropdowns();
        setDropdown(button, true);
    });
    dropdown.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'touch') return;
        setDropdown(button, false);
    });
    dropdown.addEventListener('focusout', (event) => {
        if (!dropdown.contains(event.relatedTarget)) setDropdown(button, false);
    });
    button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        closeDropdowns();
        setDropdown(button, true);
        dropdown.querySelector('.dropdown-item').focus();
    });
    // Parent links navigate normally; buttons remain available for touch menus.
    if (button.tagName === 'BUTTON') {
        button.addEventListener('click', () => {
            const open = button.getAttribute('aria-expanded') !== 'true';
            closeDropdowns();
            setDropdown(button, open);
        });
    }
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown')) closeDropdowns();
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openDropdown = dropdownButtons.find((button) => button.getAttribute('aria-expanded') === 'true');
    if (openDropdown) {
        closeDropdowns();
        openDropdown.focus();
    } else if (menuToggle && navigation && menuToggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuToggle.focus();
    }
});

const scrollToTop = document.querySelector('.scrollToTop');
if (scrollToTop) {
    scrollToTop.addEventListener('click', (event) => {
        event.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
        });
    });
    const updateScrollButton = () => {
        scrollToTop.style.display = window.scrollY > 500 ? 'block' : 'none';
    };
    window.addEventListener('scroll', updateScrollButton, { passive: true });
    updateScrollButton();
}

// Keep the same iframe mounted in a native modal: closing restores the lesson
// position and preserves the experiment. The viewport-sized modal also works on
// mobile browsers that do not support the Fullscreen API.
document.querySelectorAll('iframe.simulation-frame').forEach(frame => {
    const compact = matchMedia('(pointer: coarse), (max-width: 767px)');
    const shell = document.createElement('dialog');
    shell.className = 'lesson-lab-view';
    shell.setAttribute('aria-label', frame.title);
    const bar = document.createElement('div');
    bar.className = 'lesson-lab-bar';
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'lesson-interaction-toggle';
    exit.textContent = '← Επιστροφή στο μάθημα';
    bar.append(exit);
    const preview = document.createElement('div');
    preview.className = 'lesson-lab-preview';
    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'lesson-interaction-toggle';
    launch.textContent = 'Άνοιγμα σε πλήρη οθόνη';
    launch.setAttribute('aria-haspopup', 'dialog');
    launch.setAttribute('aria-controls', frame.id + '-view');
    shell.id = frame.id + '-view';
    preview.append(launch);
    const slot = document.createElement('div');
    frame.before(slot);
    slot.append(shell);
    shell.append(bar, frame, preview);
    let savedY = 0;
    let oldOverflow = '';
    const notifyLab = () => frame.contentWindow.postMessage({
        type: 'lesson-display-mode', fullscreen: shell.open
    }, location.origin);
    const update = () => {
        const reading = compact.matches && !shell.open;
        shell.classList.toggle('is-preview', reading);
        bar.hidden = !shell.open;
        preview.hidden = !reading;
        frame.inert = reading;
        notifyLab();
    };
    const open = () => {
        if (shell.open) return;
        savedY = window.scrollY;
        slot.style.height = shell.getBoundingClientRect().height + 'px';
        oldOverflow = document.documentElement.style.overflow;
        // Clear inert before opening so the iframe is usable in the top layer.
        frame.inert = false;
        shell.showModal();
        document.documentElement.style.overflow = 'hidden';
        update();
        exit.focus({ preventScroll: true });
    };
    const close = () => { if (shell.open) shell.close(); };
    shell.addEventListener('close', () => {
        document.documentElement.style.overflow = oldOverflow;
        slot.style.height = '';
        update();
        window.scrollTo({ top: savedY, behavior: 'instant' });
        if (compact.matches) launch.focus({ preventScroll: true });
    });
    launch.addEventListener('click', open);
    exit.addEventListener('click', close);
    compact.addEventListener('change', update);
    frame.addEventListener('load', notifyLab);
    window.addEventListener('message', event => {
        if (event.origin === location.origin && event.source === frame.contentWindow &&
            event.data?.type === 'lesson-return-reading') close();
    });
    update();
});

// Animate native disclosures while keeping keyboard and no-JavaScript behavior.
const lessonPanelTransitions = new WeakMap();
const panelReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('.lesson-panel-disclosure, .lesson-mobile-contents').forEach(panel => {
    const summary = panel.querySelector('summary');
    let animation;
    let expanded = panel.open;
    const settle = open => {
        animation?.cancel();
        animation = null;
        expanded = open;
        panel.open = open;
        panel.style.height = '';
        panel.style.overflow = '';
    };
    lessonPanelTransitions.set(panel, settle);
    summary.addEventListener('click', event => {
        event.preventDefault();
        const start = panel.getBoundingClientRect().height;
        expanded = animation ? !expanded : !panel.open;
        animation?.cancel();
        if (panelReducedMotion.matches || !panel.animate) {
            settle(expanded);
            return;
        }
        panel.style.height = '';
        panel.open = false;
        const collapsedHeight = panel.getBoundingClientRect().height;
        panel.open = true;
        const expandedHeight = panel.getBoundingClientRect().height;
        panel.style.overflow = 'hidden';
        animation = panel.animate([
            { height: start + 'px' },
            { height: (expanded ? expandedHeight : collapsedHeight) + 'px' }
        ], { duration: 240, easing: 'ease-in-out' });
        animation.onfinish = () => settle(expanded);
    });
    panelReducedMotion.addEventListener('change', () => {
        if (animation) settle(expanded);
    });
});

// Contents links reveal the requested panel, including direct bookmarked links.
const revealLessonPanel = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    const disclosure = target?.closest('.lesson-panel-disclosure') || target?.querySelector('.lesson-panel-disclosure');
    if (disclosure) {
        const settle = lessonPanelTransitions.get(disclosure);
        if (settle) settle(true);
        else disclosure.open = true;
    }
};
window.addEventListener('hashchange', revealLessonPanel);
revealLessonPanel();
document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealLessonPanel();
});
