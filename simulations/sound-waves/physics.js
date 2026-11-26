(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SoundPhysics = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const TAU = 2 * Math.PI;
    const PRESSURE_BINS = 48;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function seededRandom(seed) {
        let state = seed >>> 0;
        return function () {
            state += 0x6D2B79F5;
            let t = state;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // Equal masses exchange the normal component of their relative velocity.
    // Resolving an overlap between separating particles must not collide them twice.
    function collide(a, b, diameter, recordImpulse) {
        let dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= diameter * diameter) return false;
        const distance = Math.sqrt(d2);
        if (distance < 1e-12) { dx = 1; dy = 0; }
        else { dx /= distance; dy /= distance; }
        const correction = (diameter - distance) * 0.5 + 1e-9;
        a.x -= dx * correction; a.y -= dy * correction;
        b.x += dx * correction; b.y += dy * correction;
        const approaching = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
        if (approaching <= 0) return false;
        a.vx -= approaching * dx; a.vy -= approaching * dy;
        b.vx += approaching * dx; b.vy += approaching * dy;
        if (recordImpulse) recordImpulse((a.x + b.x) / 2, approaching * diameter);
        return true;
    }

    class Simulation {
        constructor(options = {}) {
            this.width = options.width || 1200;
            this.height = options.height || 700;
            this.baseX = options.baseX === undefined ? 60 : options.baseX;
            this.radius = options.radius || 1.8;
            this.count = options.count === undefined ? 16000 : options.count;
            this.thermalSpeed = options.thermalSpeed || 140;
            this.amplitude = 26;
            this.frequency = .32;
            this.continuous = false;
            this.setDrive(options);
            this.openEnd = options.openEnd !== false;
            this.reservoirFeedback = options.reservoirFeedback !== false;
            this.seed = options.seed === undefined ? 12345 : options.seed;
            this.cellSize = this.radius * 2;
            this.gridWidth = Math.ceil(this.width / this.cellSize) + 2;
            this.gridHeight = Math.ceil(this.height / this.cellSize) + 2;
            this.heads = new Int32Array(this.gridWidth * this.gridHeight);
            this.next = new Int32Array(this.count);
            this.occupied = new Int32Array(this.count);
            this.neighbors = [1, this.gridWidth - 1, this.gridWidth, this.gridWidth + 1];
            this.binWidth = (this.width - this.baseX) / PRESSURE_BINS;
            this.collisionVirial = new Float64Array(PRESSURE_BINS);
            this.collisionRate = new Float64Array(PRESSURE_BINS);
            this.recordImpulse = (x, virial) => {
                this.collisionVirial[this._binIndex(x)] += virial;
                this.collisions++;
            };
            this.reset();
        }

        reset(options = {}) {
            if (Number.isFinite(options.count)) this.count = Math.max(1, Math.floor(options.count));
            if (this.next.length !== this.count) {
                this.next = new Int32Array(this.count);
                this.occupied = new Int32Array(this.count);
            }
            this.random = seededRandom(this.seed);
            this.time = 0;
            this.phase = 0;
            this._driveAmplitude = 0;
            this._pulse = null;
            this.pistonX = this.baseX;
            this.pistonVelocity = 0;
            this.collisions = 0;
            this.particles = [];
            this.nextParticleId = this.count;
            this.entered = 0;
            this.exited = 0;
            this.outletNeighbors = [];
            this.collisionVirial.fill(0);
            this.pressureDuration = 0;
            const availableWidth = this.width - this.baseX - 2 * this.radius;
            const availableHeight = this.height - 2 * this.radius;
            const ambientWidth = this.width - this.baseX - this.radius;
            this.ambientSigma = this.thermalSpeed / Math.SQRT2;
            // In 2D the one-sided Maxwellian flux is n₀ × height × σ / √(2π).
            const idealFlux = this.count / ambientWidth * this.ambientSigma / Math.sqrt(TAU);
            const packing = this.count * Math.PI * this.radius ** 2 / (ambientWidth * availableHeight);
            // Calibrate the resting inflow for finite disks at the opening. The
            // ideal flux underfills dense gas before the slow feedback catches up.
            const fluxCorrection = 1 + Math.min(.7, packing * (1.45 + 4 * packing));
            this.baseInjectionRate = idealFlux * fluxCorrection;
            // Scale the controller with the approximate acoustic transit time.
            const transitTime = ambientWidth / (2 * this.thermalSpeed);
            this.reservoirAveragingTime = 3 * transitTime;
            this.reservoirResponseTime = 15 * transitTime;
            this.smoothedCount = this.count;
            this.injectionBias = 0;
            this.injectionRate = this.baseInjectionRate;
            const columns = Math.ceil(Math.sqrt(this.count * availableWidth / availableHeight));
            const rows = Math.ceil(this.count / columns);
            if (availableWidth / columns < 2.05 * this.radius || availableHeight / rows < 2.05 * this.radius) {
                throw new RangeError('The particles do not fit in this chamber.');
            }
            const spacingX = availableWidth / columns, spacingY = availableHeight / rows;
            let meanX = 0, meanY = 0;
            for (let i = 0; i < this.count; i++) {
                // Shuffle the unused cells through the grid instead of leaving a gap at one edge.
                const slot = Math.floor(i * columns * rows / this.count);
                const x = this.baseX + this.radius + (slot % columns + 0.5) * spacingX
                    + (this.random() - 0.5) * (spacingX - 2.05 * this.radius);
                const y = this.radius + (Math.floor(slot / columns) + 0.5) * spacingY
                    + (this.random() - 0.5) * (spacingY - 2.05 * this.radius);
                const speed = this.thermalSpeed * Math.sqrt(-Math.log(Math.max(1e-10, this.random())));
                const angle = TAU * this.random();
                const vx = speed * Math.cos(angle), vy = speed * Math.sin(angle);
                this.particles.push({ id: i, x, y, vx, vy, exited: false });
                meanX += vx; meanY += vy;
            }
            meanX /= this.count || 1; meanY /= this.count || 1;
            let energy = 0;
            for (const p of this.particles) {
                p.vx -= meanX; p.vy -= meanY;
                energy += p.vx * p.vx + p.vy * p.vy;
            }
            const normalize = energy > 0 ? this.thermalSpeed * Math.sqrt(this.count / energy) : 1;
            for (const p of this.particles) { p.vx *= normalize; p.vy *= normalize; }
            // Close the outlet during relaxation to measure the starting energy.
            this.startingEnergy = Infinity;
            this.energy = this.kineticEnergy();
            const relaxationStep = this.radius * .7 / (3.5 * this.thermalSpeed);
            for (let elapsed = 0; elapsed < .35; elapsed += relaxationStep) {
                this._integrate(relaxationStep, this.baseX, 0);
            }
            this.startingEnergy = this.energy = this.kineticEnergy();
            this._sampleCollisionRate();
            // The common factor of 1 / (2 × accessible height) cancels in P/P₀.
            const collisionFlux = this.collisionRate.reduce((total, rate) => total + rate, 0);
            const startingFlux = 2 * this.startingEnergy + collisionFlux;
            this.pressureReference = (startingFlux || this.count * this.thermalSpeed ** 2) / availableWidth;
            this.collisions = 0;
            return this;
        }

        setDrive(options = {}) {
            if (Number.isFinite(options.amplitude)) this.amplitude = clamp(options.amplitude, 0, Math.min(40, this.baseX - 2 * this.radius));
            if (Number.isFinite(options.frequency)) this.frequency = clamp(options.frequency, .16, .38);
            if (typeof options.continuous === 'boolean') this.continuous = options.continuous;
        }

        pulse() {
            if (this._pulse) return false;
            this.continuous = false;
            this._pulse = { age: 0, duration: 1 / this.frequency, amplitude: this.amplitude };
            return true;
        }

        get pulseActive() { return this._pulse !== null; }

        _advanceSource(dt) {
            const previous = this.pistonX;
            // Easing the drive envelope keeps mode and amplitude changes continuous.
            const targetAmplitude = this.continuous ? this.amplitude : 0;
            this._driveAmplitude += (targetAmplitude - this._driveAmplitude) * (1 - Math.exp(-dt / 0.2));
            this.phase = (this.phase + TAU * this.frequency * dt) % TAU;
            let displacement = this._driveAmplitude * Math.sin(this.phase);
            if (this._pulse) {
                this._pulse.age += dt;
                const progress = Math.min(1, this._pulse.age / this._pulse.duration);
                displacement += this._pulse.amplitude * (1 - Math.cos(TAU * progress));
                if (progress >= 1) this._pulse = null;
            }
            // Limit abrupt changes when a strike follows continuous vibration or
            // a slider is moved while the membrane is in motion.
            const maxTravel = .7 * this.thermalSpeed * dt;
            const travel = clamp(this.baseX + displacement - previous, -maxTravel, maxTravel);
            this.pistonX = previous + travel;
            this.pistonVelocity = travel / dt;
        }

        step(dt) {
            if (!Number.isFinite(dt) || dt <= 0) return;
            // A bounded public step avoids a hidden browser tab creating minutes of work.
            let remaining = Math.min(dt, 0.1);
            while (remaining > 1e-10) {
                // Use a generous common speed budget while the gas is near its
                // starting temperature, so ordinary collisions do not change the
                // integration clock for remote parts of the chamber.
                const speedBudget = Math.max(3.5 * this.thermalSpeed, Math.abs(this.pistonVelocity));
                let maximumSpeedSquared = speedBudget ** 2;
                for (const p of this.particles) {
                    maximumSpeedSquared = Math.max(maximumSpeedSquared, p.vx * p.vx + p.vy * p.vy);
                }
                const h = Math.min(remaining, 1 / 240, this.radius * .7 / Math.sqrt(maximumSpeedSquared));
                this._advanceSource(h);
                this._integrate(h, this.pistonX, this.pistonVelocity);
                this.time += h;
                remaining -= h;
            }
        }

        _walls(p, left, velocity) {
            const r = this.radius;
            if (p.y < r) {
                p.y = r;
                if (p.vy < 0) p.vy = -p.vy;
            }
            if (p.y > this.height - r) {
                p.y = this.height - r;
                if (p.vy > 0) p.vy = -p.vy;
            }
            if (p.x < left + r) {
                p.x = left + r;
                if (p.vx < velocity) {
                    // Reverse the normal velocity in the drum's frame.
                    const approach = velocity - p.vx;
                    p.vx = velocity + approach;
                    this.energy += 2 * velocity * approach;
                }
            }
            if (this.openEnd && this.startingEnergy !== Infinity) {
                if (p.x > this.width) {
                    p.exited = true;
                    this.exited++;
                    this.energy -= .5 * (p.vx * p.vx + p.vy * p.vy);
                    return false;
                }
            } else if (p.x > this.width - r) {
                p.x = this.width - r;
                if (p.vx > 0) p.vx = -p.vx;
            }
            return true;
        }

        _updateReservoirRate(dt) {
            if (!this.reservoirFeedback) return;
            const blend = -Math.expm1(-dt / this.reservoirAveragingTime);
            this.smoothedCount += (this.particles.length - this.smoothedCount) * blend;
            const response = this.reservoirResponseTime;
            const error = this.count - this.smoothedCount;
            const correction = error / response;
            const limit = this.baseInjectionRate * .5;
            // Learn a persistent flow mismatch slowly. A proportional correction
            // alone would need a permanent count deficit to offset that mismatch.
            const biasStep = correction * dt / (response / 4);
            const currentAdjustment = correction + this.injectionBias;
            if ((currentAdjustment < limit || biasStep < 0) &&
                (currentAdjustment > -limit || biasStep > 0)) {
                this.injectionBias = clamp(this.injectionBias + biasStep, -limit, limit);
            }
            this.injectionRate = this.baseInjectionRate + clamp(correction + this.injectionBias, -limit, limit);
        }

        _injectParticles(dt) {
            const expected = this.injectionRate * dt;
            const whole = Math.floor(expected);
            const arrivals = whole + Number(this.random() < expected - whole);
            if (!arrivals) return;
            const r = this.radius;
            const diameterSquared = (2 * r) ** 2;
            const rayleigh = () => Math.sqrt(-2 * Math.log1p(-this.random()));
            const candidates = [];
            let leftmost = this.width;
            for (let i = 0; i < arrivals; i++) {
                const vx = -this.ambientSigma * rayleigh();
                const vy = this.ambientSigma * rayleigh() * Math.cos(TAU * this.random());
                const x = Math.max(this.pistonX + r, this.width + vx * dt * this.random());
                leftmost = Math.min(leftmost, x);
                candidates.push({ x, vx, vy });
            }
            const neighbors = this.outletNeighbors;
            neighbors.length = 0;
            for (const p of this.particles) {
                if (p.x >= leftmost - 2 * r) neighbors.push(p);
            }
            for (const { x, vx, vy } of candidates) {
                // Retry the height if the disk would overlap a neighbor. Drop
                // blocked arrivals instead of queuing them against the opening.
                for (let attempt = 0; attempt < 24; attempt++) {
                    const y = r + this.random() * (this.height - 2 * r);
                    if (neighbors.some(p => (x - p.x) ** 2 + (y - p.y) ** 2 < diameterSquared)) continue;
                    const p = { id: this.nextParticleId++, x, y, vx, vy, exited: false };
                    this.particles.push(p);
                    neighbors.push(p);
                    this.energy += .5 * (vx * vx + vy * vy);
                    this.entered++;
                    break;
                }
            }
        }

        _integrate(dt, left, wallVelocity) {
            const particles = this.particles;
            let kept = 0;
            for (const p of particles) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (this._walls(p, left, wallVelocity)) particles[kept++] = p;
            }
            particles.length = kept;
            if (particles.length > this.next.length) {
                const capacity = Math.ceil(particles.length * 1.25);
                this.next = new Int32Array(capacity);
                this.occupied = new Int32Array(capacity);
            }
            // Rebuild after overlap corrections. The padded grid lets each occupied
            // cell test four forward neighbors without checking the grid edges.
            const { heads, next, occupied, gridWidth, neighbors, cellSize, recordImpulse } = this;
            const diameter = this.radius * 2;
            const inverseCellSize = 1 / cellSize;
            for (let pass = 0; pass < 2; pass++) {
                heads.fill(-1);
                let occupiedCount = 0;
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    const cell = (1 + Math.floor(p.y * inverseCellSize)) * gridWidth
                        + 1 + Math.floor(p.x * inverseCellSize);
                    if (heads[cell] === -1) occupied[occupiedCount++] = cell;
                    next[i] = heads[cell];
                    heads[cell] = i;
                }
                for (let n = 0; n < occupiedCount; n++) {
                    const cell = occupied[n];
                    for (let i = heads[cell]; i !== -1; i = next[i]) {
                        const p = particles[i];
                        for (let j = next[i]; j !== -1; j = next[j]) {
                            collide(p, particles[j], diameter, recordImpulse);
                        }
                        for (const offset of neighbors) {
                            for (let j = heads[cell + offset]; j !== -1; j = next[j]) {
                                collide(p, particles[j], diameter, recordImpulse);
                            }
                        }
                    }
                }
                kept = 0;
                for (const p of particles) {
                    if (this._walls(p, left, wallVelocity)) particles[kept++] = p;
                }
                particles.length = kept;
            }
            if (this.openEnd && this.startingEnergy !== Infinity) {
                this._updateReservoirRate(dt);
                this._injectParticles(dt);
            }
            this.pressureDuration += dt;
        }

        _binIndex(x) {
            return clamp(Math.floor((x - this.baseX) / this.binWidth), 0, PRESSURE_BINS - 1);
        }

        _sampleCollisionRate() {
            if (!this.pressureDuration) return;
            for (let i = 0; i < PRESSURE_BINS; i++) {
                this.collisionRate[i] = this.collisionVirial[i] / this.pressureDuration;
            }
            this.collisionVirial.fill(0);
            this.pressureDuration = 0;
        }

        sampleBins() {
            this._sampleCollisionRate();
            const velocityX = new Float64Array(PRESSURE_BINS);
            const velocityY = new Float64Array(PRESSURE_BINS);
            const speedSquared = new Float64Array(PRESSURE_BINS);
            const pressure = new Float64Array(PRESSURE_BINS);
            const centers = new Float64Array(PRESSURE_BINS);
            const widths = new Float64Array(PRESSURE_BINS);
            const occupancy = new Uint32Array(PRESSURE_BINS);
            for (const p of this.particles) {
                const index = this._binIndex(p.x);
                occupancy[index]++;
                velocityX[index] += p.vx;
                velocityY[index] += p.vy;
                speedSquared[index] += p.vx * p.vx + p.vy * p.vy;
            }
            const right = this.openEnd ? this.width : this.width - this.radius;
            for (let i = 0; i < PRESSURE_BINS; i++) {
                const start = i === 0 ? this.pistonX + this.radius :
                    Math.max(this.pistonX + this.radius, this.baseX + i * this.binWidth);
                const end = Math.min(right, this.baseX + (i + 1) * this.binWidth);
                centers[i] = (start + end) / 2;
                widths[i] = Math.max(0, end - start);
                const n = occupancy[i];
                // In 2D the scalar pressure is half the stress trace: momentum
                // transported by thermal motion plus momentum passed at contacts.
                const bulk = n ? (velocityX[i] ** 2 + velocityY[i] ** 2) / n : 0;
                const thermal = Math.max(0, speedSquared[i] - bulk);
                pressure[i] = widths[i] > 0
                    ? (thermal + this.collisionRate[i]) / (widths[i] * this.pressureReference)
                    : 1;
            }
            return { pressure, centers, occupancy, widths };
        }

        kineticEnergy() {
            return this.particles.reduce((sum, p) => sum + (p.vx * p.vx + p.vy * p.vy) / 2, 0);
        }
    }

    return { Simulation, collide, seededRandom };
}));
