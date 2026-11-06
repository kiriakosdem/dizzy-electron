// Integrate density along each viewing ray. Signed radial and polar factors
// fit in a small 1D table; azimuth and phase are evaluated at each step.
window.HydrogenFuzzy = (function () {
    'use strict';
    const P = window.HydrogenPhysics;
    const SIZE = 512;
    function create(phaseColors) {
        const table = new THREE.DataTexture(new Uint8Array(SIZE * 4), SIZE, 1, THREE.RGBAFormat);
        table.minFilter = table.magFilter = THREE.LinearFilter;
        const material = new THREE.ShaderMaterial({
            side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false,
            uniforms: {
                phaseColors: { value: phaseColors },
                factors: { value: table }, scales: { value: new THREE.Vector2() },
                worldRadius: { value: 1 }, magnetic: { value: 0 }, realBasis: { value: 0 },
                signFactor: { value: 1 }, fuzziness: { value: .5 }
            },
            vertexShader: `
                varying vec3 exitPoint;
                void main() {
                    exitPoint = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
                }`,
            fragmentShader: `
                uniform sampler2D factors;
                uniform vec2 scales;
                uniform sampler2D phaseColors;
                uniform float worldRadius, magnetic, realBasis, signFactor, fuzziness;
                varying vec3 exitPoint;
                float factorAt(vec2 bytes) {
                    return 2. * dot(bytes, vec2(256., 1.) / 257.) - 1.;
                }
                float texCoord(float u) { return (clamp(u, 0., 1.) * ${SIZE-1}. + .5) / ${SIZE}.; }
                void main() {
                    vec3 toEye = cameraPosition / worldRadius - exitPoint;
                    vec3 ray = normalize(toEye);
                    float mid = dot(-exitPoint, ray);
                    vec3 nearest = exitPoint + mid * ray;
                    float chord2 = 1. - dot(nearest, nearest);
                    if (chord2 <= 0.) discard;
                    float halfChord = sqrt(chord2);
                    float start = max(0., mid - halfChord);
                    float stepSize = (min(length(toEye), mid + halfChord) - start) / 96.;
                    vec3 pos = exitPoint + ray * (start + .5 * stepSize);
                    vec4 fog = vec4(0.);
                    for (int i = 0; i < 96; i++) {
                        float r = length(pos);
                        float radial = factorAt(texture2D(factors, vec2(texCoord(r), .5)).rg);
                        float polar = factorAt(texture2D(factors, vec2(texCoord(.5 + .5 * pos.z / max(r, .000001)), .5)).ba);
                        float amp = radial * scales.x * polar * scales.y * signFactor;
                        float angle = magnetic * atan(pos.y, pos.x + 1.e-10);
                        if (realBasis > .5 && magnetic != 0.)
                            amp *= 1.414214 * (realBasis > 1.5 ? sin(angle) : cos(angle));
                        float phase = (realBasis < .5 ? angle / 6.2831853 : 0.) + (amp < 0. ? .5 : 0.);
                        float phaseU = (fract(phase) * 512. + .5) / 513.;
                        vec3 color = sRGBToLinear(texture2D(phaseColors, vec2(phaseU, .5))).rgb;
                        // Change the visibility of faint density while preserving nodes.
                        // At 50%, the transfer function is the original density.
                        float density = amp * amp;
                        float edgePower = exp2(1. - 2. * fuzziness);
                        float visualDensity = pow(min(density, 1.), edgePower) * max(density, 1.);
                        float opacity = 1. - exp(-visualDensity * stepSize * 1.2 * (1. - smoothstep(.87, 1., r)));
                        fog = mix(fog, vec4(color, 1.), opacity);
                        pos += ray * stepSize;
                    }
                    gl_FragColor = vec4(fog.rgb / max(fog.a, .00001), fog.a);
                    #include <encodings_fragment>
                }`
        });
        return new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    }

    function update(mesh, {n, l, m}, basis, worldScale) {
        const radialCDF = P.distributions(n, l, m).radial;
        const bound = P.quantile(radialCDF, .9998);
        const u = mesh.material.uniforms;
        const pixels = u.factors.value.image.data;
        // Store each signed amplitude in two bytes for linear interpolation
        // on WebGL 1, including the faint outer lobes of high-n states.
        function fill(offset, evaluate) {
            const values = Float64Array.from({length: SIZE}, (_, i) => evaluate(i / (SIZE - 1)));
            let peak = 0;
            for (const v of values) peak = Math.max(peak, Math.abs(v));
            values.forEach((v, i) => {
                const encoded = Math.round((v / peak + 1) * 32767.5);
                pixels[4*i + offset] = encoded >> 8;
                pixels[4*i + offset + 1] = encoded & 255;
            });
            return peak;
        }
        const radialPeak = fill(0, t => P.radial(n, l, bound * t));
        const polarPeak = fill(2, t => P.polarAmplitude(l, m, 2*t - 1));
        u.scales.value.set(radialPeak * bound ** 1.5, polarPeak);
        u.factors.value.needsUpdate = true;
        u.magnetic.value = m;
        u.realBasis.value = {complex: 0, cos: 1, sin: 2}[basis];
        u.signFactor.value = (basis !== 'complex' || m < 0) ? (-1) ** Math.abs(m) : 1;
        u.worldRadius.value = bound * worldScale;
        mesh.scale.setScalar(u.worldRadius.value);
        return P.quantile(radialCDF, .99);
    }
    return {create, update};
}());
