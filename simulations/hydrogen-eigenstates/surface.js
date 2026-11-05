/* Probability-enclosing isosurfaces for the axially symmetric complex Y_l^m states. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./physics.js'));
    else root.HydrogenSurface = factory(root.HydrogenPhysics);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (P) {
    'use strict';
    const MIN_PROBABILITY = 0.5, MAX_PROBABILITY = 0.999;
    const RADIAL_STEPS = 2048, POLAR_STEPS = 512, BINS = 8192, LOG_SPAN = 36;

    function prepare(n, l, m) {
        const distribution = P.distributions(n, l, m);
        const radius99 = P.quantile(distribution.radial, 0.99);
        // The omitted radial tail is much smaller than the slider's precision.
        const rMax = P.quantile(distribution.radial, 1 - 1e-9);
        const radial = new Float64Array(RADIAL_STEPS), volumes = new Float64Array(RADIAL_STEPS);
        const angular = new Float64Array(POLAR_STEPS), solidAngles = new Float64Array(POLAR_STEPS);
        for (let i = 0; i < RADIAL_STEPS; i++) {
            const a = rMax * (i / RADIAL_STEPS) ** 2, b = rMax * ((i + 1) / RADIAL_STEPS) ** 2;
            radial[i] = P.radial(n, l, (a + b) / 2) ** 2;
            volumes[i] = (b ** 3 - a ** 3) / 3;
        }
        for (let j = 0; j < POLAR_STEPS; j++) {
            const a = Math.PI * j / POLAR_STEPS, b = Math.PI * (j + 1) / POLAR_STEPS;
            angular[j] = P.angularDensity(l, m, Math.cos((a + b) / 2)) / (2 * Math.PI);
            solidAngles[j] = 2 * Math.PI * (Math.cos(a) - Math.cos(b));
        }
        const peak = Math.max(...radial) * Math.max(...angular);
        const masses = new Float64Array(BINS);
        // Weight each density level by probability rho dV, not by vertex count
        // or by r² rho. The latter is a radial distribution, not a spatial density.
        for (let i = 0; i < RADIAL_STEPS; i++) for (let j = 0; j < POLAR_STEPS; j++) {
            const density = radial[i] * angular[j];
            if (!density) continue;
            const bin = Math.min(BINS - 1, Math.floor(Math.max(0, Math.log(peak / density)) * BINS / LOG_SPAN));
            masses[bin] += density * volumes[i] * solidAngles[j];
        }
        const cumulative = new Float64Array(BINS + 1);
        for (let i = 0; i < BINS; i++) cumulative[i + 1] = cumulative[i] + masses[i];
        return { n, l, m, radius99, rMax, peak, cumulative, mass: cumulative[BINS] };
    }

    function threshold(model, probability) {
        // Converting the slider's 99.9 percent to a fraction can round one ULP
        // above 0.999. Accept that round-off at either endpoint, then clamp it.
        if (!Number.isFinite(probability) || probability < MIN_PROBABILITY - Number.EPSILON || probability > MAX_PROBABILITY + Number.EPSILON) {
            throw new RangeError('Enclosed probability must be between 50% and 99.9%');
        }
        probability = Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, probability));
        const target = probability * model.mass;
        let low = 0, high = BINS;
        while (high - low > 1) {
            const mid = (low + high) >>> 1;
            if (model.cumulative[mid] < target) low = mid; else high = mid;
        }
        const fraction = (target - model.cumulative[low]) / (model.cumulative[high] - model.cumulative[low]);
        return model.peak * Math.exp(-(low + fraction) * LOG_SPAN / BINS);
    }

    // Include nodes explicitly so even very thin excluded gaps remain separate
    // surfaces at high enclosure probabilities and in highly excited states.
    function radialGrid(model, steps) {
        const grid = [];
        let previous = P.radial(model.n, model.l, 0);
        for (let i = 0; i <= steps; i++) {
            const r = model.rMax * (i / steps) ** 2;
            const value = P.radial(model.n, model.l, r);
            if (previous * value < 0) {
                let a = grid[grid.length - 1], b = r;
                for (let k = 0; k < 40; k++) {
                    const mid = (a + b) / 2;
                    if (P.radial(model.n, model.l, mid) * previous > 0) a = mid; else b = mid;
                }
                grid.push((a + b) / 2);
            }
            grid.push(r); previous = value;
        }
        return grid;
    }
    function polarGrid(model, steps) {
        const grid = Array.from({ length: steps + 1 }, (_, j) => Math.PI * j / steps);
        const angular = theta => P.angularDensity(model.l, model.m, Math.cos(theta));
        for (let j = 1; j < steps; j++) {
            if (angular(grid[j]) < angular(grid[j - 1]) && angular(grid[j]) < angular(grid[j + 1])) {
                let a = grid[j - 1], b = grid[j + 1];
                for (let k = 0; k < 60; k++) {
                    const u = (2 * a + b) / 3, v = (a + 2 * b) / 3;
                    if (angular(u) < angular(v)) b = v; else a = u;
                }
                grid.push((a + b) / 2);
            }
        }
        return grid.sort((a, b) => a - b).filter((theta, i, all) => !i || theta - all[i - 1] > 1e-10);
    }

    function build(model, probability) {
        const level = threshold(model, probability);
        const radii = radialGrid(model, 512), angles = polarGrid(model, 192), azimuthSteps = 96;
        const radial = radii.map(r => P.radial(model.n, model.l, r) ** 2);
        const angular = angles.map(theta => P.angularDensity(model.l, model.m, Math.cos(theta)) / (2 * Math.PI));
        const density = (r, theta) => P.radial(model.n, model.l, r) ** 2 *
            P.angularDensity(model.l, model.m, Math.cos(theta)) / (2 * Math.PI);
        const positions = [], normals = [], indices = [], rings = new Map();
        let maxRadius = 0;

        function ring(a, b, key) {
            if (rings.has(key)) return rings.get(key);
            let low = 0, high = 1;
            const inside = a.value >= level;
            for (let k = 0; k < 24; k++) {
                const t = (low + high) / 2;
                if ((density(a.r + t * (b.r - a.r), a.theta + t * (b.theta - a.theta)) >= level) === inside) low = t;
                else high = t;
            }
            const t = (low + high) / 2, r = a.r + t * (b.r - a.r), theta = a.theta + t * (b.theta - a.theta);
            const sin = Math.sin(theta), cos = Math.cos(theta);
            const s = r * sin, z = r * cos, dr = model.rMax * 1e-6, dt = 1e-5;
            const radialDerivative = (density(r + dr, theta) - density(r - dr, theta)) / (2 * dr);
            const polarDerivative = (density(r, theta + dt) - density(r, theta - dt)) / (2 * dt * r);
            let ns = -(sin * radialDerivative + cos * polarDerivative);
            let nz = -(cos * radialDerivative - sin * polarDerivative);
            const length = Math.hypot(ns, nz); ns /= length; nz /= length;
            const start = positions.length / 3;
            const pole = Math.abs(s) < model.rMax * 1e-12;
            for (let k = 0; k < (pole ? 1 : azimuthSteps); k++) {
                const phi = 2 * Math.PI * k / azimuthSteps, x = Math.cos(phi), y = Math.sin(phi);
                positions.push(pole ? 0 : s * x, pole ? 0 : s * y, z);
                normals.push(pole ? 0 : ns * x, pole ? 0 : ns * y, nz);
            }
            maxRadius = Math.max(maxRadius, r);
            const result = { start, pole }; rings.set(key, result); return result;
        }
        function triangle(a, b, c) {
            if (a === b || b === c || a === c) return;
            const u = [0, 1, 2].map(k => positions[3 * b + k] - positions[3 * a + k]);
            const v = [0, 1, 2].map(k => positions[3 * c + k] - positions[3 * a + k]);
            const dot = (u[1] * v[2] - u[2] * v[1]) * normals[3 * a] +
                (u[2] * v[0] - u[0] * v[2]) * normals[3 * a + 1] +
                (u[0] * v[1] - u[1] * v[0]) * normals[3 * a + 2];
            if (dot > 0) indices.push(a, b, c); else indices.push(a, c, b);
        }
        function connect(a, b) {
            for (let k = 0; k < azimuthSteps; k++) {
                const next = (k + 1) % azimuthSteps;
                const a0 = a.start + (a.pole ? 0 : k), a1 = a.start + (a.pole ? 0 : next);
                const b0 = b.start + (b.pole ? 0 : k), b1 = b.start + (b.pole ? 0 : next);
                triangle(a0, b0, a1); triangle(a1, b0, b1);
            }
        }
        for (let i = 0; i < radii.length - 1; i++) for (let j = 0; j < angles.length - 1; j++) {
            const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
            const values = corners.map(([r, theta]) => radial[r] * angular[theta]);
            if (values.every(v => v < level) || values.every(v => v >= level)) continue;
            const crossings = [];
            for (let e = 0; e < 4; e++) {
                const next = (e + 1) % 4;
                if ((values[e] >= level) === (values[next] >= level)) continue;
                const [a, b] = [corners[e], corners[next]];
                const ids = [a[0] * angles.length + a[1], b[0] * angles.length + b[1]].sort((x, y) => x - y);
                crossings[e] = ring({ r: radii[a[0]], theta: angles[a[1]], value: values[e] },
                    { r: radii[b[0]], theta: angles[b[1]], value: values[next] }, ids.join(':'));
            }
            const edges = crossings.filter(Boolean);
            if (edges.length === 2) connect(...edges);
            else if (edges.length === 4) {
                const centerInside = density((radii[i] + radii[i + 1]) / 2, (angles[j] + angles[j + 1]) / 2) >= level;
                if (centerInside === (values[0] >= level)) { connect(edges[0], edges[1]); connect(edges[2], edges[3]); }
                else { connect(edges[0], edges[3]); connect(edges[1], edges[2]); }
            }
        }
        return { positions: new Float32Array(positions), normals: new Float32Array(normals),
            indices: new Uint32Array(indices), threshold: level, maxRadius };
    }
    return { MIN_PROBABILITY, MAX_PROBABILITY, prepare, threshold, build };
}));
