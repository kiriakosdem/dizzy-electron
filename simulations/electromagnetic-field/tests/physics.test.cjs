'use strict';
// Run with: node tests/physics.test.cjs
// This tests the actual engine embedded in index.html, using only Node.js built-ins.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const match = html.match(/<script id="physics-engine">([\s\S]*?)<\/script>/);
assert.ok(match, 'The embedded physics engine must exist.');
const P = vm.runInNewContext(match[1] + '\nChargeFieldPhysics;', {}, { timeout: 1000 });
const report = { samples: 0, maxRetardedResidual: 0, maxRelativeTransversalityError: 0,
  maxMagneticIdentityError: 0, maxDecompositionError: 0 };
const parameters = [
  { amplitude: 0.7, frequency: 0.1, motion: 'continuous' },
  { amplitude: 1, frequency: 0.1, motion: 'continuous' },
  { amplitude: 1.5, frequency: 0.1, motion: 'pulse' },
  { amplitude: 0, frequency: 0.2, motion: 'continuous' }
];
for (const p of parameters) {
  for (let i = 0; i < 400; i++) {
    const x = 40 * Math.sin(i * 1.234) + 0.43;
    const y = 30 * Math.cos(i * 0.752) + 0.13;
    const f = P.sample(x, y, i * 0.373, p);
    assert.ok(f.valid);
    report.samples++;
    report.maxRetardedResidual = Math.max(report.maxRetardedResidual, Math.abs(f.residual));
    report.maxRelativeTransversalityError = Math.max(report.maxRelativeTransversalityError,
      Math.abs(f.nx * f.erx + f.ny * f.ery) / Math.max(1e-15, Math.hypot(f.erx, f.ery)));
    report.maxMagneticIdentityError = Math.max(report.maxMagneticIdentityError,
      Math.abs(f.bz - (f.nx * f.ey - f.ny * f.ex) / P.C));
    report.maxDecompositionError = Math.max(report.maxDecompositionError,
      Math.abs(f.ex - f.evx - f.erx), Math.abs(f.ey - f.evy - f.ery));
  }
}
assert.ok(report.maxRetardedResidual < 1.1e-10);
assert.ok(report.maxRelativeTransversalityError < 1e-12);
assert.ok(report.maxMagneticIdentityError < 1e-12);
assert.ok(report.maxDecompositionError < 1e-12);

// A stationary charge gives E = (x,y)/R^3 and no magnetic field.
const staticP = { amplitude: 0, frequency: 0.1, motion: 'continuous' };
const staticField = P.sample(3, 4, 9, staticP);
assert.ok(Math.abs(staticField.ex - 3 / 125) < 1e-12);
assert.ok(Math.abs(staticField.ey - 4 / 125) < 1e-12);
assert.ok(Math.abs(staticField.bz) < 1e-12);

// Before the pulse arrives and after it passes, the radiation field is zero.
const pulseP = { amplitude: 1, frequency: 0.1, motion: 'pulse' };
const before = P.sample(15, 0, 10, pulseP);
const during = P.sample(15, 0, 20, pulseP);
const after = P.sample(15, 0, 30, pulseP);
assert.equal(Math.hypot(before.erx, before.ery), 0);
assert.ok(Math.hypot(during.erx, during.ery) > 0);
assert.equal(Math.hypot(after.erx, after.ery), 0);

// Compare the same emission event and direction at R=10 and R=20.
const waveP = parameters[0], emission = 2.5;
const source = P.trajectory(emission, waveP);
const near = P.sample(10, source.y, emission + 10, waveP);
const far = P.sample(20, source.y, emission + 20, waveP);
report.velocityDistanceRatio = Math.hypot(near.evx, near.evy) / Math.hypot(far.evx, far.evy);
report.radiationDistanceRatio = Math.hypot(near.erx, near.ery) / Math.hypot(far.erx, far.ery);
assert.ok(Math.abs(report.velocityDistanceRatio - 4) < 1e-8);
assert.ok(Math.abs(report.radiationDistanceRatio - 2) < 1e-8);

// No radiation lies along the axis of the prescribed linear motion.
const axis = P.sample(0, 10, 14, waveP);
assert.equal(Math.hypot(axis.erx, axis.ery), 0);

// Check both analytic trajectory derivatives against centered finite differences.
let derivativeError = 0;
for (const p of parameters) {
  for (const t of [1.1, 2.3, 3.7, 5.1, 8.3]) {
    const h = 1e-4, q = P.trajectory(t, p);
    const qp = P.trajectory(t + h, p), qm = P.trajectory(t - h, p);
    derivativeError = Math.max(derivativeError,
      Math.abs(q.v - (qp.y - qm.y) / (2 * h)),
      Math.abs(q.a - (qp.v - qm.v) / (2 * h)));
  }
}
assert.ok(derivativeError < 1e-6);
assert.equal(P.sample(0, 0, 0, staticP).valid, false);
assert.equal(P.sample(1, 1, 0, { amplitude: 2, frequency: 1, motion: 'continuous' }).valid, false);
report.maxDerivativeError = derivativeError;
console.log('All numerical checks passed.');
console.log(JSON.stringify(report, null, 2));
