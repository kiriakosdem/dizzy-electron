'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Simulation, collide } = require('../physics.js');

function close(actual, expected, tolerance = 1e-9) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}
function advance(sim, seconds) {
    for (let i = 0; i < Math.round(seconds * 120); i++) sim.step(1 / 120);
}
function countWithin(sim, left, right) {
    return sim.particles.filter(p => p.x >= left && p.x < right).length;
}

test('equal disks exchange normal momentum, preserving energy and total momentum', () => {
    const a = { x: 0, y: 0, vx: 7, vy: 3 };
    const b = { x: 6, y: 4, vx: -2, vy: 1 };
    const energy = a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2;
    assert.equal(collide(a, b, 8), true);
    close(a.vx + b.vx, 5);
    close(a.vy + b.vy, 4);
    close(a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2, energy);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 8);
});

test('separating overlapping disks are separated without a second impulse', () => {
    const a = { x: 0, y: 0, vx: -4, vy: 2 };
    const b = { x: 7, y: 0, vx: 2, vy: -1 };
    assert.equal(collide(a, b, 8), false);
    assert.deepEqual([a.vx, a.vy, b.vx, b.vy], [-4, 2, 2, -1]);
    const c = { x: 0, y: 0, vx: 3, vy: 1 };
    const d = { x: 0, y: 0, vx: -3, vy: -1 };
    collide(c, d, 8);
    assert.ok(Object.values(c).concat(Object.values(d)).every(Number.isFinite));
});

test('a moving membrane reflects velocity in its own rest frame', () => {
    const sim = new Simulation({ count: 20, openEnd: false });
    const p = { x: 59, y: 100, vx: -40, vy: 7 };
    sim._walls(p, 60, 15);
    close(p.vx, 70); // v_out − u = −(v_in − u)
    close(p.vy, 7);
    close(p.x, 60 + sim.radius);
    sim.energy = sim.startingEnergy;
    p.x = sim.width + 2;
    sim._walls(p, 60, 0);
    close(p.vx, -70);
    close(p.x, sim.width - sim.radius);
});

test('an undriven closed chamber conserves kinetic energy', () => {
    const sim = new Simulation({ openEnd: false });
    const before = sim.kineticEnergy();
    advance(sim, 2);
    close(sim.kineticEnergy() / before, 1, 2e-12);
    assert.ok(sim.collisions > 1000);
});

test('pressure measures thermal motion and collision impulses independently of bulk flow', () => {
    const sim = new Simulation({ count: 2 });
    const [a, b] = sim.particles;
    Object.assign(a, { x: 209, y: 100, vx: 10, vy: 0 });
    Object.assign(b, { x: 211, y: 100, vx: -10, vy: 0 });
    sim.collisionRate.fill(0);
    const index = sim.sampleBins().occupancy.findIndex(n => n === 2);
    assert.ok(index >= 0);
    const width = sim.sampleBins().widths[index];
    const scale = width * sim.pressureReference;
    close(sim.sampleBins().pressure[index] * scale, 200);
    for (const p of sim.particles) { p.vx += 40; p.vy += 20; }
    close(sim.sampleBins().pressure[index] * scale, 200, 1e-8);
    const duration = .05;
    assert.equal(collide(a, b, 2 * sim.radius, sim.recordImpulse), true);
    sim.pressureDuration = duration;
    const contactContribution = (20 * 2 * sim.radius) / duration;
    close(sim.sampleBins().pressure[index] * scale, 200 + contactContribution, 1e-8);
});

test('the pressure pulse arrives at near, middle and far slices in order', () => {
    const driven = new Simulation(), control = new Simulation();
    driven.pulse();
    let active, quiet;
    function advanceBoth(seconds) {
        for (let i = 0; i < Math.round(seconds / .05); i++) {
            advance(driven, .05);
            advance(control, .05);
            active = driven.sampleBins();
            quiet = control.sampleBins();
        }
    }
    const meanPressure = (sample, left, right) => {
        let total = 0, width = 0;
        sample.centers.forEach((x, i) => {
            if (x >= left && x < right) {
                total += sample.pressure[i] * sample.widths[i];
                width += sample.widths[i];
            }
        });
        return total / width;
    };
    const excess = (left, right) => meanPressure(active, left, right) - meanPressure(quiet, left, right);
    advanceBoth(.5);
    assert.ok(Math.abs(excess(800, 1060)) < .2, 'far field initially quiet');
    advanceBoth(.75);
    assert.ok(excess(150, 320) > .35, 'near compression');
    advanceBoth(1.5);
    assert.ok(excess(430, 680) > .25, 'middle compression');
    advanceBoth(1.5);
    assert.equal(driven.pulseActive, false);
    close(driven.pistonX, driven.baseX);
    assert.ok(excess(800, 1060) > .2, 'far compression after source has stopped');
    assert.ok(Math.abs(driven.injectionRate / driven.baseInjectionRate - 1) < .02,
        'the reservoir barely changes inflow on a single wave crossing');
});

test('reset reproduces the equilibrium gas and source controls do not teleport the wall', () => {
    const sim = new Simulation();
    const initial = sim.particles.map(p => ({ ...p }));
    sim.setDrive({ continuous: true, amplitude: 40, frequency: .38 });
    advance(sim, 0.3);
    const position = sim.pistonX;
    sim.setDrive({ continuous: false, amplitude: 5, frequency: 0.2 });
    close(sim.pistonX, position);
    const dt = 1 / 600;
    sim.step(dt);
    assert.ok(Math.abs(sim.pistonX - position) <= .7 * sim.thermalSpeed * dt + 1e-10);
    sim.reset();
    assert.deepEqual(sim.particles, initial);
    close(sim.time, 0);
    close(sim.pistonX, sim.baseX);
    assert.equal(sim.pulse(), true);
    assert.equal(sim.pulse(), false);
    sim.reset({ count: 2200 });
    assert.equal(sim.particles.length, 2200);
    assert.equal(sim.next.length, 2200);
    assert.equal(sim.smoothedCount, sim.count);
    assert.equal(sim.injectionBias, 0);
    assert.equal(sim.injectionRate, sim.baseInjectionRate);
    advance(sim, 0.1);
});

test('the top, bottom, and membrane rebound elastically at every energy', () => {
    const sim = new Simulation({ count: 20 });
    const left = sim.baseX;
    const contacts = [
        [{ x: left, y: 80, vx: -40, vy: 7 }, 'vx', 15, 70],
        [{ x: 100, y: 0, vx: 7, vy: -40 }, 'vy', 0, 40],
        [{ x: 100, y: sim.height, vx: 7, vy: 40 }, 'vy', 0, -40],
    ];
    for (const [incoming, component, speed, elastic] of contacts) {
        const tangent = component === 'vx' ? 'vy' : 'vx';
        for (const energy of [sim.startingEnergy - 10, sim.startingEnergy + 100]) {
            sim.energy = energy;
            const p = { ...incoming };
            sim._walls(p, left, speed);
            close(p[component], elastic);
            close(p[tangent], incoming[tangent]);
            close(sim.energy - energy, (elastic ** 2 - incoming[component] ** 2) / 2);
        }
    }
});

test('particles leave through the opening without bouncing or being replaced one for one', () => {
    const sim = new Simulation({ count: 2 });
    const [exiting] = sim.particles;
    Object.assign(exiting, { x: sim.width - .1, y: 80, vx: 200, vy: 10 });
    sim.energy = sim.kineticEnergy();
    sim.random = () => .99; // Below one expected arrival, this draw injects nothing.
    sim.step(.001);
    assert.ok(exiting.exited);
    assert.equal(exiting.vx, 200);
    assert.equal(sim.exited, 1);
    assert.equal(sim.entered, 0);
    assert.equal(sim.particles.length, 1);
    assert.equal(sim.particles.includes(exiting), false);
    close(sim.energy, sim.kineticEnergy());
});

test('the ambient reservoir injects new particles at the calibrated thermal flux', () => {
    const sim = new Simulation({ count: 200 });
    const accessibleWidth = sim.width - sim.baseX - sim.radius;
    const idealFlux = sim.count * sim.thermalSpeed / (accessibleWidth * Math.sqrt(4 * Math.PI));
    assert.ok(sim.injectionRate >= idealFlux && sim.injectionRate < idealFlux * 1.01,
        'the calibration approaches the ideal flux in dilute gas');
    // No outgoing particles are needed to admit an arrival.
    const expected = .75;
    const dt = expected / sim.injectionRate;
    sim.random = () => .9;
    sim._injectParticles(dt);
    assert.equal(sim.entered, 0);
    sim.random = () => .5;
    sim._injectParticles(dt);
    assert.equal(sim.entered, 1);
    assert.equal(sim.exited, 0);
    const p = sim.particles.at(-1);
    assert.equal(p.id, sim.count);
    close(p.vx, -sim.thermalSpeed * Math.sqrt(Math.log(2)));
    close(p.vy, p.vx);
    close(p.x, sim.width + p.vx * dt / 2);
    close(p.y, sim.height / 2);
    assert.equal(sim.particles.length, sim.count + 1);
    close(sim.energy / sim.kineticEnergy(), 1);
    sim.step(.001);
    assert.ok(sim.next.length >= sim.particles.length);
});

test('the calibrated outlet keeps an undriven chamber close to its starting count and energy', () => {
    const sim = new Simulation();
    advance(sim, 8);
    assert.ok(Math.abs(sim.particles.length / sim.count - 1) < .035, 'quiet particle count');
    assert.ok(Math.abs(sim.energy / sim.startingEnergy - 1) < .065, 'quiet kinetic energy');
    assert.ok(sim.entered > 1000 && sim.exited > 1000, 'particles are still exchanged with the reservoir');
});

test('slow feedback restores the particle population after successive pulses', () => {
    // A shorter cross-section keeps the run inexpensive at comparable density.
    const options = { count: 1600, height: 75, amplitude: 40, frequency: .38 };
    const driven = new Simulation(options);
    const fixed = new Simulation({ ...options, reservoirFeedback: false });
    for (let i = 0; i < 3; i++) {
        driven.pulse();
        fixed.pulse();
        advance(driven, 5);
        advance(fixed, 5);
    }
    const depleted = driven.particles.length;
    assert.ok(depleted < .95 * driven.count);
    let restoredSum = 0, fixedSum = 0;
    for (let i = 0; i < 25; i++) {
        advance(driven, 5);
        advance(fixed, 5);
        if (i >= 20) {
            restoredSum += driven.particles.length;
            fixedSum += fixed.particles.length;
        }
    }
    const restored = restoredSum / 5;
    assert.ok(Math.abs(restored / driven.count - 1) < .08, `restored mean count: ${restored}`);
    assert.ok(restored > fixedSum / 5 + .05 * driven.count, 'feedback recovers more gas than fixed inflow');
});

test('strong driving produces net outflow and the open end removes energy after the drum stops', () => {
    const sim = new Simulation({ count: 20000, continuous: true, amplitude: 40, frequency: .38 });
    let outletOccupancy = 0;
    const sampleOutlet = () => {
        outletOccupancy += countWithin(sim, sim.width - 100, sim.width) / sim.particles.length;
    };
    for (let i = 0; i < 32; i++) {
        advance(sim, .25);
        sampleOutlet();
    }
    const drivenEnergy = sim.energy;
    assert.ok(sim.exited > sim.entered, 'the driven gas has net outflow');
    assert.ok(sim.entered > 1000, 'surrounding air continues to enter');
    sim.setDrive({ continuous: false });
    for (let i = 0; i < 12; i++) {
        advance(sim, .25);
        sampleOutlet();
    }
    const meanOutletFraction = outletOccupancy / 44;
    assert.ok(meanOutletFraction < .12, `mean particle fraction near the opening: ${meanOutletFraction}`);
    const energy = sim.kineticEnergy();
    assert.ok(energy < drivenEnergy * .95, `gas energy after drive: ${energy / sim.startingEnergy}`);
    close(sim.energy / sim.startingEnergy, energy / sim.startingEnergy, 2e-12);
    assert.equal(sim.particles.length, sim.count + sim.entered - sim.exited);
    for (const p of sim.particles) {
        assert.ok([p.x, p.y, p.vx, p.vy].every(Number.isFinite));
        assert.ok(p.x >= sim.pistonX + sim.radius - 1e-8 && p.x <= sim.width + 1e-8);
        assert.ok(p.y >= sim.radius - 1e-8 && p.y <= sim.height - sim.radius + 1e-8);
    }
    const bins = sim.sampleBins();
    assert.equal(bins.occupancy.reduce((a, b) => a + b, 0), sim.particles.length);
    assert.ok(bins.pressure.every(p => Number.isFinite(p) && p >= 0));
});
