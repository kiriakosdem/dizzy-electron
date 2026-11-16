// Keep the ruler compact and use round distances as the view zooms.
function updateLabScale(label, rule, pixelsPerUnit, unit) {
    if (!(pixelsPerUnit > 0)) return;
    const target = 78 / pixelsPerUnit;
    const decade = 10 ** Math.floor(Math.log10(target));
    const ratio = target / decade;
    const length = (ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1) * decade;
    const text = Number(length.toPrecision(1)) + ' ' + unit;
    const width = (length * pixelsPerUnit).toFixed(1) + 'px';
    if (label.textContent !== text) label.textContent = text;
    if (rule.style.width !== width) rule.style.width = width;
}
