# Sound Waves Laboratory

A two-dimensional gas of 16,000 identical hard disks by default, with a 20,000-particle option, makes a longitudinal pressure disturbance visible. The membrane on the left transfers energy to nearby particles, and elastic collisions carry it across the chamber.

## Model

All disks have the same radius and unit mass. A collision exchanges the normal component of relative velocity, preserving pair momentum and kinetic energy. The membrane is an externally driven planar source, representing a small portion of a drumhead or loudspeaker cone.

The initial gas has randomized thermal velocities, zero initial mean momentum and an RMS speed of 140 model distance units per model time unit. It relaxes with a fixed membrane before the visible clock starts. Reset uses a seeded random generator to reproduce the same experiment.

The membrane defaults to 0.32 cycles per model time unit, with a range of 0.16–0.38. Its speed stays below 70% of the starting RMS particle speed, including while changing settings.

Continuous motion is sinusoidal, with a short smooth amplitude envelope when switched on or off. A pulse makes one smooth inward-and-back stroke, with excursion twice the amplitude setting and period `1 / frequency`. Changes to the source do not erase waves already travelling through the gas. A uniform spatial grid finds nearby collision partners. Adaptive substeps limit travel to 0.7 particle radii per substep. Positional overlap correction and two collision passes approximate hard-disk contact.

The chamber is 1,200 × 700 model units and each disk has a radius of 1.8. The right edge is open. A disk whose center crosses that edge leaves with its kinetic energy. The reservoir starts from the ideal 2D thermal flux `n₀ A σ / sqrt(2π)`, where `n₀` is the starting number density, `A` is the accessible height, and `σ` is the starting RMS speed divided by √2. The base rate includes a finite-disk correction calibrated for the lab's particle settings. For the fraction `η` of chamber area occupied by disks, the multiplier is `1 + min(0.7, η(1.45 + 4η))`. The correction reduces the startup dip in count and kinetic energy while the drum is idle.

Each substep uses stochastic rounding for fractional arrivals. The inward normal speed is Rayleigh distributed and the transverse velocity is Gaussian. The placement depth corresponds to a uniform arrival time within the substep. Random heights are retried to avoid overlaps. An arrival with no clear placement is dropped.

The particle picker sets both the initial population and the target count. The reservoir uses an exponential average of the total count over about 12 model time units. It adds the smoothed deficit multiplied by `k ≈ 0.0164` per model time unit to the base injection rate. The corresponding 61-unit response scale is about 15 estimated wave transit times. An integral correction also accumulates that proportional term over a 15-unit time scale to offset persistent flow mismatch from finite disks. The combined correction is limited to ±50% of the base rate, and the integral stops growing into that limit. Reset clears the correction. The actual refill time depends on how quickly the outlet discharges particles and can be longer than the controller's response scale.

The boundary still allows short-term net outflow and can produce some acoustic reflection. The count controller restores the population gradually while injected velocities continue to use the ambient temperature. Use `reservoirFeedback: false` when constructing a simulation to compare against fixed inflow.

The top and bottom reflect particles elastically. At the membrane, the horizontal velocity reverses relative to the moving surface, so the membrane can do work on the gas. The settings show the kinetic energy of the gas in the chamber relative to the reset state.

The visualization uses model units and slowed motion. The disks are a deliberately enlarged two-dimensional analogy for gas molecules, not literal air molecules to scale. Their finite size and strong source motion make the pulse easy to see and can produce nonlinear compression. This model does not claim calibrated sound speed, audible frequencies, three-dimensional air thermodynamics, or quantitative acoustic pressure.

## Measurements and rendering

`sampleBins()` measures pressure in 48 slices across the chamber. The kinetic contribution in each slice is the sum of squared velocities relative to its local mean flow. The collisional contribution is the disk diameter times normal impulse, summed over contacts whose midpoints fall in the slice and divided by the sampling time. Half the sum, divided by the accessible slice area, estimates scalar pressure in two dimensions. The starting reference comes from the chamber average during reset equilibration.

The graph and bands share a pressure field smoothed across nearby slices and over a short time. They display deviations from the current area-weighted average of the field across the gas. The graph centers that average and uses fixed limits of ±1.5 times the starting pressure for the deviation. Values outside this range are clipped in the display. The browser caps per-frame simulation work so high counts may advance more slowly on slower hardware.

## JavaScript interface

`physics.js` exports `SoundPhysics` in browsers and a CommonJS module for tests. `new SoundPhysics.Simulation(options)` exposes `particles`, `time`, `pistonX`, `pistonVelocity`, `baseX`, `width`, `height` and `radius`. Use `step(dt)`, `pulse()`, `setDrive({amplitude, frequency, continuous})`, `reset({count})` and `sampleBins()`. Reset's optional count changes the number of particles while retaining their common size. `pulseActive` reports an unfinished stroke; `pulse()` returns false if one is already in progress. Each public step accepts up to 0.1 model time units, so a resumed hidden browser tab cannot jump far ahead.

## Validation

Run from the repository root:

```sh
node --test simulations/sound-waves/tests/physics.test.cjs
```

The tests check elastic collisions, delayed propagation, reproducible reset, independent injection and deletion, particle and energy accounting, and outflow under strong driving. Closed chamber reference tests construct the simulation with `openEnd: false`.
