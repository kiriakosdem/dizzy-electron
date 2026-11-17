'use strict';

const homeFilm = document.querySelector('.home-film');
const reducedFilmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const labels = document.querySelectorAll('.home-film-caption > span');
const clipTrack = homeFilm.addTextTrack('metadata');
clipTrack.mode = 'hidden';
const clipSeconds = 4;
labels.forEach((label, index) => {
    const cue = new VTTCue(index * clipSeconds, (index + 1) * clipSeconds, label.textContent);
    cue.id = String(index);
    clipTrack.addCue(cue);
});
clipTrack.addEventListener('cuechange', () => {
    const cue = clipTrack.activeCues[0];
    if (cue) labels.forEach((label, index) => { label.hidden = index !== Number(cue.id); });
});

if (!reducedFilmMotion.matches) {
    homeFilm.play().catch(() => {});
}
reducedFilmMotion.addEventListener('change', event => {
    if (event.matches) homeFilm.pause();
});
