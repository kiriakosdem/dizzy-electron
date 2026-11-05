/* Hydrogen bound states in atomic units (a0 = 1), using complex Y_l^m.
   References and numerical accuracy are documented in README.md. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.HydrogenPhysics = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const MAX_N = 6;
    function validState(n, l, m) {
        return [n, l, m].every(Number.isInteger) && n >= 1 && l >= 0 && l < n && Math.abs(m) <= l;
    }
    function constrainState(n, l, m) {
        n = Math.max(1, Math.min(MAX_N, Math.round(Number(n)) || 1));
        l = Math.max(0, Math.min(n - 1, Math.round(Number(l)) || 0));
        m = Math.max(-l, Math.min(l, Math.round(Number(m)) || 0));
        return { n, l, m: m || 0 };
    }
    function factorial(n) { let v = 1; for (let i = 2; i <= n; i++) v *= i; return v; }
    function laguerre(k, alpha, x) {
        if (k === 0) return 1;
        let a = 1, b = 1 + alpha - x;
        for (let j = 2; j <= k; j++) {
            const c = ((2 * j - 1 + alpha - x) * b - (j - 1 + alpha) * a) / j;
            a = b; b = c;
        }
        return b;
    }
    function legendre(l, m, x) {
        m = Math.abs(m);
        let p = 1;
        for (let j = 1; j <= m; j++) p *= -(2 * j - 1) * Math.sqrt(Math.max(0, 1 - x * x));
        if (l === m) return p;
        let q = x * (2 * m + 1) * p;
        for (let j = m + 2; j <= l; j++) {
            const next = ((2 * j - 1) * x * q - (j + m - 1) * p) / (j - m);
            p = q; q = next;
        }
        return q;
    }
    function radial(n, l, r) {
        const rho = 2 * r / n;
        const norm = Math.sqrt((2 / n) ** 3 * factorial(n - l - 1) / (2 * n * factorial(n + l)));
        return norm * Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
    }
    // Density in mu = cos(theta), after integrating the uniform azimuth phi.
    function angularDensity(l, m, mu) {
        m = Math.abs(m);
        return (2 * l + 1) / 2 * factorial(l - m) / factorial(l + m) * legendre(l, m, mu) ** 2;
    }
    function table(pdf, start, end, steps = 8192) {
        const step = (end - start) / steps;
        const cdf = new Float64Array(steps + 1);
        let previous = pdf(start);
        for (let i = 1; i <= steps; i++) {
            const current = pdf(start + i * step);
            cdf[i] = cdf[i - 1] + (previous + current) * step / 2;
            previous = current;
        }
        const mass = cdf[steps];
        if (!(mass > 0) || !Number.isFinite(mass)) throw new Error('Invalid probability distribution');
        for (let i = 1; i <= steps; i++) cdf[i] /= mass;
        return { start, step, cdf, mass };
    }
    function quantile(t, u) {
        u = Math.max(0, Math.min(1, u));
        let low = 0, high = t.cdf.length - 1;
        while (high - low > 1) {
            const mid = (low + high) >>> 1;
            if (t.cdf[mid] < u) low = mid; else high = mid;
        }
        const span = t.cdf[high] - t.cdf[low];
        const fraction = span > 0 ? (u - t.cdf[low]) / span : 0;
        return t.start + (low + fraction) * t.step;
    }
    function distributions(n, l, m) {
        if (!validState(n, l, m) || n > MAX_N) throw new RangeError('Unsupported quantum numbers');
        const rMax = 2 * n * n + 20 * n + 20;
        return {
            radial: table(r => r * r * radial(n, l, r) ** 2, 0, rMax),
            angular: table(mu => angularDensity(l, m, mu), -1, 1)
        };
    }
    function randomGenerator(seed) {
        let state = seed >>> 0;
        return function () {
            state += 0x6D2B79F5;
            let t = Math.imul(state ^ state >>> 15, 1 | state);
            t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function sample(n, l, m, count, seed = 12345, basis = 'complex') {
        if (!Number.isInteger(count) || count < 1 || count > 100000) throw new RangeError('Invalid sample count');
        const d = distributions(n, l, m), random = randomGenerator(seed);
        const azimuth = basis !== 'complex' && m !== 0 ? table(phi => 2 * (basis === 'sin' ? Math.sin(m * phi) : Math.cos(m * phi)) ** 2, 0, 2 * Math.PI) : null;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = quantile(d.radial, random());
            const mu = quantile(d.angular, random());
            const phi = azimuth ? quantile(azimuth, random()) : 2 * Math.PI * random(), s = Math.sqrt(Math.max(0, 1 - mu * mu));
            positions[3 * i] = r * s * Math.cos(phi);
            positions[3 * i + 1] = r * s * Math.sin(phi);
            positions[3 * i + 2] = r * mu;
        }
        return { positions, radius99: quantile(d.radial, 0.99) };
    }
    // Condon–Shortley convention; Y_l^-m = (-1)^m conjugate(Y_l^m).
    // A stationary snapshot omits the physically irrelevant common time phase.
    function phase(n, l, m, x, y, z, basis = 'complex') {
        if (basis !== 'complex') return realAmplitude(n, l, m, x, y, z, basis) < 0 ? Math.PI : 0;
        const r = Math.hypot(x, y, z);
        const amplitude = radial(n, l, r) * legendre(l, Math.abs(m), r ? z / r : 1) *
            (m < 0 && Math.abs(m) % 2 ? -1 : 1);
        const angle = m * Math.atan2(y, x) + (amplitude < 0 ? Math.PI : 0);
        return (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    }
    function realAmplitude(n, l, m, x, y, z, basis = 'cos') {
        m = Math.abs(m);
        const r = Math.hypot(x, y, z), mu = r ? z / r : 1;
        const norm = Math.sqrt((2 * l + 1) / (4 * Math.PI) * factorial(l - m) / factorial(l + m));
        const azimuth = m === 0 ? 1 : Math.sqrt(2) * (-1) ** m *
            (basis === 'sin' ? Math.sin(m * Math.atan2(y, x)) : Math.cos(m * Math.atan2(y, x)));
        return radial(n, l, r) * norm * legendre(l, m, mu) * azimuth;
    }
    function realOrbitals(n, l) {
        const letters = ['s','p','d','f','g','h'];
        const names = [ [''], ['z','y','x'], ['z²','yz','xz','xy','x²−y²'],
            ['z³','yz²','xz²','xyz','z(x²−y²)','y(3x²−y²)','x(x²−3y²)'] ];
        const result = [];
        for (let m = 0; m <= l; m++) for (const basis of (m ? ['sin','cos'] : ['cos'])) {
            const index = result.length;
            const suffix = l <= 3 ? names[l][index] : (m ? `${m}${basis === 'sin' ? 's' : 'c'}` : '0');
            result.push({m, basis, label: `${n}${letters[l]}${suffix ? ' · ' + suffix : ''}`,
                description: m ? `Real ±${m} combination: ${basis}(${m}φ)` : 'Real m = 0 orbital'});
        }
        return result;
    }
    return { realAmplitude, realOrbitals, MAX_N, validState, constrainState, radial, angularDensity, distributions, quantile, sample, phase };
}));
