(() => {
    const groups = document.querySelectorAll('.panel-options');
    if (!groups.length) return;

    function fitLabels(group) {
        group.style.removeProperty('--segment-size');
        group.classList.remove('segment-wrap');
        if (!group.getBoundingClientRect().width) return;

        let scale = 1;
        const labels = group.querySelectorAll('.segment-label');
        for (const label of labels) {
            const segment = label.parentElement;
            const style = getComputedStyle(segment);
            const available = segment.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const width = label.getBoundingClientRect().width;
            if (width > 0) scale = Math.min(scale, available / width);
        }
        if (scale >= 1) return;

        const baseSize = parseFloat(getComputedStyle(labels[0]).fontSize);
        const fittedSize = Math.floor(baseSize * scale * 10) / 10;
        group.style.setProperty('--segment-size', Math.max(10, fittedSize) + 'px');
        group.classList.toggle('segment-wrap', fittedSize < 10);
    }

    const observer = new ResizeObserver(entries => entries.forEach(({ target }) => fitLabels(target)));
    groups.forEach(group => observer.observe(group));
    const fitAll = () => groups.forEach(fitLabels);
    window.siteLanguage?.onChange(fitAll);
    document.fonts?.addEventListener('loadingdone', fitAll);
})();
