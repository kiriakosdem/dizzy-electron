'use strict';

(() => {
    const carousel = document.querySelector('.welcome-carousel');
    if (!carousel) return;
    const slides = [...carousel.querySelectorAll('.welcome-slide')];
    const dots = [...carousel.querySelectorAll('.welcome-dot')];
    const playback = carousel.querySelector('.welcome-playback');
    const track = carousel.querySelector('.welcome-slides');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let playing = !reducedMotion.matches;
    let timer;
    let hovering = false;
    let playbackAtPointerDown = null;

    const show = (index) => {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => { slide.hidden = i !== current; });
        dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
    };
    const schedule = () => {
        clearInterval(timer);
        playback.textContent = playing ? 'Ⅱ' : '▶';
        playback.setAttribute('aria-label', playing ? 'Παύση εναλλαγής διαφανειών' : 'Έναρξη εναλλαγής διαφανειών');
        track.setAttribute('aria-live', playing ? 'off' : 'polite');
        if (playing && !hovering && !document.hidden) timer = setInterval(() => show(current + 1), 5000);
    };
    const choose = (index) => {
        playing = false;
        schedule();
        show(index);
    };
    carousel.querySelector('.welcome-controls').hidden = false;
    carousel.querySelector('.welcome-previous').addEventListener('click', () => choose(current - 1));
    carousel.querySelector('.welcome-next').addEventListener('click', () => choose(current + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => choose(i)));
    playback.addEventListener('pointerdown', () => { playbackAtPointerDown = playing; });
    playback.addEventListener('pointercancel', () => { playbackAtPointerDown = null; });
    playback.addEventListener('click', (event) => {
        playing = !(event.detail && playbackAtPointerDown !== null ? playbackAtPointerDown : playing);
        playbackAtPointerDown = null;
        schedule();
    });
    carousel.addEventListener('mouseenter', () => { hovering = true; schedule(); });
    carousel.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    // Keyboard focus stops rotation until the visitor explicitly starts it again.
    carousel.addEventListener('focusin', () => { playing = false; schedule(); });
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) playing = false; schedule(); });
    schedule();
})();
