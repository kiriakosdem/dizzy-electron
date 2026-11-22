(() => {
    'use strict';

    const navbar = document.getElementById('NavigationBar');
    const menuToggle = navbar.querySelector('.navbar-toggler');
    const page = document.scrollingElement;
    const getScrollY = () => Math.max(0, Math.min(window.scrollY, page.scrollHeight - page.clientHeight));
    let directionEdge = getScrollY();
    let scrollingDown = false;
    let frame = 0;

    function updateNavbar() {
        frame = 0;
        const scrollY = getScrollY();
        // Ignore small reversals from trackpads and touch scrolling.
        if (scrollY > directionEdge + 6) scrollingDown = true;
        if (scrollY < directionEdge - 6) scrollingDown = false;
        directionEdge = scrollingDown ? Math.max(directionEdge, scrollY) : Math.min(directionEdge, scrollY);

        const menuOpen = menuToggle.offsetWidth > 0 && menuToggle.getAttribute('aria-expanded') === 'true';
        const hide = scrollY > 6 && scrollingDown && !menuOpen && !navbar.querySelector(':focus-visible');
        navbar.classList.toggle('is-offscreen', hide);
        navbar.inert = hide;
    }

    function scheduleUpdate() {
        if (!frame) frame = requestAnimationFrame(updateNavbar);
    }

    navbar.classList.add('site-nav-scroll');
    new ResizeObserver(() => {
        document.documentElement.style.setProperty('--site-navbar-height', navbar.offsetHeight + 'px');
        scheduleUpdate();
    }).observe(navbar);
    navbar.addEventListener('focusout', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
})();
