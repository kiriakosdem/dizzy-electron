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

if (menuToggle && navigation) {
    menuToggle.addEventListener('click', () => {
        const open = menuToggle.getAttribute('aria-expanded') !== 'true';
        menuToggle.setAttribute('aria-expanded', String(open));
        navigation.classList.toggle('show', open);
        if (!open) closeDropdowns();
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
        navigation.classList.remove('show');
        menuToggle.setAttribute('aria-expanded', 'false');
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

document.querySelectorAll('[data-fullscreen]').forEach((button) => {
    const frame = document.getElementById(button.dataset.fullscreen);
    if (!frame || !frame.requestFullscreen || !document.fullscreenEnabled) return;

    button.hidden = false;
    button.addEventListener('click', async () => {
        const status = button.closest('section').querySelector('.simulation-status');
        status.textContent = '';
        try {
            await frame.requestFullscreen();
        } catch {
            status.textContent = 'Η πλήρης οθόνη δεν είναι διαθέσιμη. Μπορείς να ανοίξεις το εργαστήριο σε νέα καρτέλα.';
        }
    });
});
