'use strict';

{
    const button = document.querySelector('.scrollToTop');
    const page = document.scrollingElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateButton = () => {
        const scrollableHeight = page.scrollHeight - page.clientHeight;
        button.hidden = scrollableHeight <= 0 ||
            page.scrollTop <= Math.min(500, scrollableHeight / 2);
    };

    button.addEventListener('click', event => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    });

    window.addEventListener('scroll', updateButton, { passive: true });
    window.addEventListener('resize', updateButton);
    updateButton();
}
