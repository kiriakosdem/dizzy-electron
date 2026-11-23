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

function updateLabTimeRate(input, output, minimum, maximum, secondsPerUnit) {
    const units = [
        [86400, 'd', '{0} simulated days per real second'],
        [3600, 'h', '{0} simulated hours per real second'],
        [60, 'min', '{0} simulated minutes per real second'],
        [1, 's', '{0} simulated seconds per real second'],
        [1e-3, 'ms', '{0} simulated milliseconds per real second'],
        [1e-6, 'µs', '{0} simulated microseconds per real second'],
        [1e-9, 'ns', '{0} nanoseconds per real second'],
        [1e-12, 'ps', '{0} simulated picoseconds per real second']
    ];
    const endpoints = new Intl.NumberFormat('en', { maximumFractionDigits: 2, useGrouping: false });
    const readout = new Intl.NumberFormat('en', {
        minimumSignificantDigits: 3,
        maximumSignificantDigits: 3,
        useGrouping: false
    });
    const format = (value, formatter) => {
        const seconds = Number(value) * secondsPerUnit;
        const [scale, unit, description] = units.find(([scale]) => seconds >= scale) ?? units[units.length - 1];
        const number = formatter.format(seconds / scale);
        return { text: number + ' ' + unit, number, description };
    };

    const current = format(input.value, readout);
    output.textContent = '= ' + current.text;
    minimum.textContent = format(input.min, endpoints).text;
    maximum.textContent = format(input.max, endpoints).text;
    setLabCopy(input, current.description, [current.number], 'aria-valuetext');
}
