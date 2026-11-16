'use strict';

const homeFilm = document.querySelector('.home-film');
const reducedFilmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (!reducedFilmMotion.matches) {
    // Native controls remain available if the browser declines muted autoplay.
    homeFilm.play().catch(() => {});
}
reducedFilmMotion.addEventListener('change', event => {
    if (event.matches) homeFilm.pause();
});
