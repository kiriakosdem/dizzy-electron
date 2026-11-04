// Keep legacy bookmarks working without adding a history entry.
(function () {
    const target = new URL(document.currentScript.dataset.destination, window.location.href);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.href);
}());
