'use strict';

const homeFilm = document.querySelector('.home-film');
const filmToggle = document.querySelector('.home-film-toggle');
const reducedFilmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const playFilm = () => homeFilm.play().catch(() => {});
const updateFilmToggle = () => {
    const playing = !homeFilm.paused && !homeFilm.ended;
    const label = playing
        ? window.siteLanguage.text('Παύση βίντεο', 'Pause video')
        : window.siteLanguage.text('Αναπαραγωγή βίντεο', 'Play video');
    filmToggle.toggleAttribute('data-playing', playing);
    filmToggle.setAttribute('aria-label', label);
    filmToggle.title = label;
};

filmToggle.addEventListener('click', () => {
    if (homeFilm.paused || homeFilm.ended) playFilm();
    else homeFilm.pause();
});
for (const event of ['play', 'pause', 'ended']) {
    homeFilm.addEventListener(event, updateFilmToggle);
}
window.siteLanguage.onChange(updateFilmToggle);
updateFilmToggle();
filmToggle.hidden = false;

const labels = document.querySelectorAll('.home-film-caption > [data-lab]');
const filmAction = document.querySelector('.home-film-action');
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
    if (!cue) return;
    const activeLabel = labels[Number(cue.id)];
    labels.forEach(label => { label.hidden = label !== activeLabel; });
    filmAction.setAttribute('href', activeLabel.dataset.lab);
});

if (!reducedFilmMotion.matches) {
    playFilm();
}
reducedFilmMotion.addEventListener('change', event => {
    if (event.matches) homeFilm.pause();
});
