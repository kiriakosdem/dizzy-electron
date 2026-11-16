'use strict';

(() => {
    const carousel = document.querySelector('.quote-carousel');
    if (!carousel) return;

    const track = carousel.querySelector('.quote-track');
    const slides = [...track.querySelectorAll('figure')];
    const controls = carousel.querySelector('.quote-controls');
    const dots = [...controls.querySelectorAll('.quote-pagination span')];
    const status = carousel.querySelector('.quote-status');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let current = 0;
    let timer;

    function schedule() {
        clearTimeout(timer);
        if (visible && !document.hidden) {
            timer = setTimeout(() => show(current + 1, false), 15000);
        }
    }

    function show(index, manual = true) {
        const next = (index + slides.length) % slides.length;
        if (next !== current) {
            const outgoing = slides[current];
            const incoming = slides[next];
            const direction = Math.sign(index - current);
            track.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
            outgoing.inert = true;
            incoming.inert = false;
            if (!reducedMotion.matches) {
                outgoing.animate([
                    { opacity: 1, transform: 'none' },
                    { opacity: 0, transform: `translateX(${direction * -12}px)` }
                ], { duration: 170, easing: 'ease-in' });
                incoming.animate([
                    { opacity: 0, transform: `translateX(${direction * 18}px)` },
                    { opacity: 1, transform: 'none' }
                ], { duration: 380, delay: 110, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' });
            }
            dots[current].removeAttribute('aria-current');
            dots[next].setAttribute('aria-current', 'true');
            current = next;
            if (manual) status.textContent = `${next + 1} από ${slides.length} · ${dots[next].getAttribute('aria-label')}`;
        }
        schedule();
    }

    slides.forEach((slide, index) => {
        slide.inert = index !== current;
        slide.hidden = false;
    });
    controls.hidden = false;
    controls.querySelectorAll('[data-step]').forEach(button => {
        button.addEventListener('click', () => show(current + Number(button.dataset.step)));
    });
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        schedule();
    }).observe(carousel);
    document.addEventListener('visibilitychange', schedule);
    schedule();
})();
