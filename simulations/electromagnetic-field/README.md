# Field Lab, version 2

A standalone electromagnetic field laboratory with mouse-controlled charge motion, a draggable field probe, and a toggle that highlights changing electric-field vectors.

Open `index.html` in a modern browser. The application needs no installation, external libraries, remote fonts, internet connection, or server.

## Start and interact

The canvas starts without a charge. Click or tap anywhere to choose its initial position. The positive charge appears there with its stationary Coulomb field. Drag the yellow charge in either direction to move it, then release it at your target. The source follows a smoothed, speed-limited path. A fast drag leaves an outlined target and a faint connecting line until the charge catches up.

The Charge tool also lets you click or drag anywhere to specify a new target for an existing source. This moves the charge through intervening positions rather than teleporting it. Dragging resumes playback when paused, allowing the field to respond.

Drag the green probe marker directly to move it. Its numerical measurements update throughout the drag. The Probe tool also lets you click or drag on empty background to choose the probe position. Moving the probe does not move the charge, advance a paused simulation, or alter the field.

Select Pan, hold Shift while dragging, or drag with the middle mouse button to move the camera. Scroll or pinch to zoom. Near, Overview, and Far change only the camera. They never relocate the charge or the probe.

The Mouse time rate control sets normalized time units per real second at 1× playback. Its default is 24, making mouse manipulation practical while keeping the field propagation speed at c = 1. The playback speed selector multiplies this rate. Lower rates help examine an outgoing disturbance but also slow how quickly the charge can follow a fast pointer.

In Mouse mode, Place charge again arms a new placement. The next click starts a new stationary-charge experiment at that location and clears the old trajectory history. Escape cancels an armed replacement. Restart creates a new stationary history at the current charge position, without moving the charge back to an arbitrary origin.

## Changing-arrow toggle

Under Display layers, enable Highlight changing arrows. Electric arrows whose selected field component is changing acquire an orange highlight. Unhighlighted electric arrows retain their yellow appearance. The adjacent readout counts highlighted visible samples.

The detector measures a change in direction or strength at a fixed physical observation point. Camera movement, probe movement, zoom, field-visibility gain, and changing the sampling density are not treated as field motion. Highlights clear while paused or when electric vectors are hidden. The detector also operates in direction-only display mode, where a changing field magnitude can still trigger a highlight even though displayed arrow lengths are equal.

This is a field-change indicator, not a detector of radiation alone. A changing velocity field can also be highlighted. The fixed arrow bases are observation points, not particles moving through space.

## Existing features retained

Total, Velocity, and Radiation isolate the electric field and its corresponding magnetic contribution. Blue dots indicate magnetic field pointing out of the screen. Blue crosses indicate magnetic field pointing into the screen.

Continuous wave and Single pulse remain available after the charge is placed. They use the current user-positioned charge location as the center of a new automatic experiment. The amplitude and frequency controls retain their subluminal speed constraint. Switching to Mouse control, including by grabbing an automatically moving charge, preserves the earlier automatic trajectory in the retarded-field calculation.

Play, pause, single stepping, playback speed, logarithmic or direction-only vector lengths, density settings, propagation guides, the retarded source ray, snapshot export, full-screen view, and the built-in physics notes remain available.

## Keyboard controls

| Key | Action |
| --- | --- |
| Q, P, G | Select Charge, Probe, or Pan |
| M | Toggle changing-arrow highlights |
| Space | Play or pause |
| Period | Advance one step |
| R | Restart the experiment |
| 1, 2, 3 | Select Total, Velocity, or Radiation |
| Plus, minus | Zoom in or out |
| H | Recenter the overview on the charge |
| Arrow keys | Move the probe when the canvas has focus |
| Shift with arrow keys | Move the probe by a larger step |
| Escape | Cancel replacement placement or close the physics notes |

Text inputs, selectors, and focused buttons retain their normal keyboard behavior.

## Physics and numerical representation

The engine evaluates the retarded Lienard-Wiechert fields of a positive point charge on a prescribed planar trajectory. It is a two-dimensional slice of three-dimensional vacuum electromagnetism, not two-dimensional electrostatics. Both horizontal and vertical source velocity and acceleration enter the full vector formula. Normalized units set c = 1 and q/(4*pi*epsilon_0) = 1.

The velocity term has an explicit 1/R² factor. Its direction is not generally radial from the retarded source. The acceleration term has an explicit 1/R factor and is transverse to the direction from the retarded source at every distance. The total field approaches transverse behavior where radiation dominates. These statements refer to fixed emission conditions and direction.

The retarded time is solved independently at every field sample. Motion in one location does not instantly rewrite distant fields. After the mouse is released, disturbances already emitted continue propagating outward while playback runs.

Initial placement specifies an equilibrium initial condition. The charge is assumed to have existed at that chosen position for all earlier times. It is not a charge suddenly created in empty space. Changing to an automatic source restarts that analytic experiment, as described in the interface. Changing from an automatic source to Mouse mode instead preserves the automatic prehistory.

The mouse supplies a target position to a bounded controller. The recorded trajectory has continuous position and velocity with piecewise constant acceleration over steps no longer than 0.05 normalized time units. Each segment is integrated analytically. Therefore, the position, velocity, and acceleration sampled at a retarded time are mutually consistent. Endpoint velocities are bounded by 0.65c, and their linear interpolation stays inside the same speed bound. The manual controller limits acceleration to 1.5 normalized acceleration units. Acceleration may change at segment boundaries. This is a numerical prescribed trajectory, not an exact reproduction of every raw mouse event.

All physical trajectory segments are retained. Exactly stationary or coasting segments can be merged without changing the trajectory. Only decorative propagation circles have a bounded display history. No radiation reaction, self-force, external force estimation, or force from the probe is simulated.

The Newton solver uses a bracket valid for any source trajectory with maximum speed V < c. For D equal to the distance from the current source, the triangle inequality gives D/(c + V) <= t - tr <= D/(c - V). The target residual is 1e-10 normalized time units. A 0.14-unit disk around the current charge excludes the point singularity.

For highlights, the selected vector at time t is compared with the vector at the same physical point at t - 0.06. The vector-difference magnitude divided by 0.06 must exceed both 0.03 times the larger field magnitude and an absolute numerical floor of 1e-9. The threshold prevents insignificant numerical differences from appearing as motion.

Arrow lengths use the original logarithmic display mapping rather than linear physical scaling. Probe readings remain unscaled. Blue symbols and yellow arrows are sampled on interleaved grids at their own actual positions. Timing-guide circles are not electric field lines.

The built-in physics panel includes the field equations, all symbol definitions, the motion-segment derivation, transversality explanation, detector definition, and references.

## Tests

From this directory, both numerical test suites use only Node.js built-in modules and extract the actual engine from `index.html`:

```sh
node tests/physics.test.cjs
node tests/manual.test.cjs
```

`tests/physics.test.cjs` preserves the first version's 1,600-sample checks, including the stationary limit, retarded-time residual, transversality, magnetic identity, distance scaling, pulse causality, and analytic trajectory derivatives.

`tests/manual.test.cjs` adds 1,200 field samples and additional checks for arbitrary placement, two-dimensional motion, rotation and translation covariance, horizontal acceleration, delayed response outside the causal cone, immutable past fields, piecewise trajectory derivatives and continuity, speed and acceleration limits, preservation of automatic prehistory, settling after release, and the highlight criterion.

`tests/browser-validation.json` is a historical report that records the Chromium interface checks. These cover direct mouse and touch charge dragging, direct probe dragging, background probe placement, automatic mode transitions, highlighting, pausing, field isolation, camera gestures, pinch zoom, keyboard controls, replacement placement, modal notes, and snapshot export. Responsive page widths from 320 to 1024 pixels were checked for horizontal page overflow. Touch events were exercised in a mobile-sized Chromium context, not on physical phone hardware.

The container's Chromium policy blocks file navigation, so the browser tests loaded the exact self-contained HTML through Playwright's `set_content` method. The application itself does not require Playwright or a server. Other browser engines were not tested in this session.

## Source organization

`index.html` contains the complete interface, styling, numerical engine, and controls. The engine is isolated in the script identified as `physics-engine`. The `FieldLab` browser object exposes state snapshots, field samples, trajectory inspection, placement, target movement, stepping, playback, and rendering helpers for reproducible checks. Manual simulation time can advance through these helpers but cannot be rewound into already recorded mouse input. Restart begins a new manual history.

## Formula references

Michael Fowler, University of Virginia, “The Lienard-Weichert Potentials and Fields.”
https://galileoandeinstein.phys.virginia.edu/Elec_Mag/2022_Lectures/EM_67_Lienard_Weichert.html

The Feynman Lectures on Physics, Volume II, Chapter 21, “Solutions of Maxwell’s Equations with Currents and Charges.”
https://www.feynmanlectures.caltech.edu/II_21.html
