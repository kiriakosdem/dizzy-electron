// One cyclic phase palette for the surface, volume, and legend.
// Phase 0 (+1) is logo orange; phase π (−1) is logo light blue.
window.HydrogenOrbitalColors = function (positive, negative) {
    'use strict';
    const positiveHSL = positive.getHSL({});
    const negativeHSL = negative.getHSL({});
    const middleHue = negativeHSL.h > positiveHSL.h ? negativeHSL.h : negativeHSL.h + 1;
    function colorAt(phase, target) {
        const turn = ((phase / (2 * Math.PI)) % 1 + 1) % 1;
        if (turn === 0) return target.copy(positive);
        if (turn === .5) return target.copy(negative);
        const negativeWeight = (1 - Math.cos(2 * Math.PI * turn)) / 2;
        const hue = turn <= .5 ?
            positiveHSL.h + 2 * turn * (middleHue - positiveHSL.h) :
            middleHue + (2 * turn - 1) * (positiveHSL.h + 1 - middleHue);
        return target.setHSL(
            hue,
            positiveHSL.s + negativeWeight * (negativeHSL.s - positiveHSL.s),
            positiveHSL.l + negativeWeight * (negativeHSL.l - positiveHSL.l)
        );
    }
    const size = 513, pixels = new Uint8Array(size * 4), color = new THREE.Color();
    for (let i = 0; i < size; i++) {
        colorAt(2 * Math.PI * i / (size - 1), color);
        pixels[4*i] = Math.round(color.r * 255);
        pixels[4*i + 1] = Math.round(color.g * 255);
        pixels[4*i + 2] = Math.round(color.b * 255);
        pixels[4*i + 3] = 255;
    }
    const texture = new THREE.DataTexture(pixels, size, 1, THREE.RGBAFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    const stops = [];
    for (let i = 0; i <= 24; i++) {
        stops.push('#' + colorAt(2 * Math.PI * i / 24, color).getHexString());
    }
    return { colorAt, texture, gradient: `linear-gradient(to right, ${stops.join(',')})` };
};
