'use strict';

(() => {
    const carousel = document.querySelector('.welcome-carousel');
    if (!carousel) return;
    const slides = [...carousel.querySelectorAll('.welcome-slide')];
    const dots = [...carousel.querySelectorAll('.welcome-dot')];
    const track = carousel.querySelector('.welcome-slides');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const duration = 15000;
    let current = 0;
    let elapsed = 0;
    let previousTime = null;
    let frame;

    const paint = () => dots.forEach((dot, i) => {
        dot.setAttribute('aria-current', String(i === current));
        dot.style.setProperty('--progress', i === current ? (reducedMotion.matches ? 1 : elapsed / duration) : 0);
    });
    const show = (index) => {
        current = (index + slides.length) % slides.length;
        elapsed = 0;
        slides.forEach((slide, i) => { slide.inert = i !== current; });
        paint();
    };
    const tick = (time) => {
        if (previousTime !== null) elapsed += time - previousTime;
        previousTime = time;
        if (elapsed >= duration) show(current + 1);
        else paint();
        frame = requestAnimationFrame(tick);
    };
    const schedule = () => {
        cancelAnimationFrame(frame);
        previousTime = null;
        const playing = !reducedMotion.matches && !document.hidden;
        track.setAttribute('aria-live', playing ? 'off' : 'polite');
        if (playing) frame = requestAnimationFrame(tick);
        paint();
    };
    const choose = (index) => {
        show(index);
        schedule();
    };
    carousel.querySelector('.welcome-controls').hidden = false;
    carousel.querySelector('.welcome-previous').addEventListener('click', () => choose(current - 1));
    carousel.querySelector('.welcome-next').addEventListener('click', () => choose(current + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => choose(i)));
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', schedule);
    show(0);
    slides.forEach(slide => { slide.hidden = false; });
    schedule();
})();
