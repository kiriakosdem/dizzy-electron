(() => {
    'use strict';

    const navbar = document.getElementById('NavigationBar');
    const menuToggle = navbar.querySelector('.navbar-toggler');
    const homeHeading = document.querySelector('.home-heading');
    const page = document.scrollingElement;
    const getScrollY = () => Math.max(0, Math.min(window.scrollY, page.scrollHeight - page.clientHeight));
    let directionEdge = getScrollY();
    let scrollingDown = false;
    let frame = 0;

    function updateNavbar() {
        frame = 0;
        const scrollY = getScrollY();
        const navbarHeight = navbar.offsetHeight;
        // Ignore small reversals from trackpads and touch scrolling.
        if (scrollY > directionEdge + 6) scrollingDown = true;
        if (scrollY < directionEdge - 6) scrollingDown = false;
        directionEdge = scrollingDown ? Math.max(directionEdge, scrollY) : Math.min(directionEdge, scrollY);

        const menuOpen = menuToggle.offsetWidth > 0 && menuToggle.getAttribute('aria-expanded') === 'true';
        const hide = scrollY >= navbarHeight && scrollingDown && !menuOpen && !navbar.querySelector(':focus-visible');
        navbar.classList.toggle('is-offscreen', hide);
        navbar.inert = hide;

        if (homeHeading) {
            const pastHero = homeHeading.getBoundingClientRect().bottom <= navbarHeight;
            navbar.classList.toggle('has-page-underlay', pastHero);
        }
    }

    function scheduleUpdate() {
        if (!frame) frame = requestAnimationFrame(updateNavbar);
    }

    navbar.classList.add('site-nav-scroll');
    const navResizeObserver = new ResizeObserver(() => {
        document.documentElement.style.setProperty('--site-navbar-height', navbar.offsetHeight + 'px');
        scheduleUpdate();
    });
    navResizeObserver.observe(navbar);
    if (homeHeading) navResizeObserver.observe(homeHeading);
    navbar.addEventListener('focusout', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
})();
