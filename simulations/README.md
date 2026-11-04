# Simulations

Each current lab has a standalone `index.html`:

- `electric-field/`: electrostatic fields, potentials and charge interaction tests.
- `gravitational-field/`: gravitational fields, trajectories and interaction tests.
- `electromagnetic-field/`: time-dependent fields; its README describes the model and numerical checks.
- `hydrogen-eigenstates/`: 3D orbitals; loads Three.js and OrbitControls from a CDN.

The electric, gravitational and electromagnetic labs are self-contained HTML files. `bouncing-balls/` and `falling-blocks/` preserve older sketches that depend on the relevant p5/Matter libraries in `assets/vendor/`; they are not standalone HTML labs.

Run all existing tests from the repository root with `node --test simulations/*/tests/*.test.cjs`. Keep tests beside the simulation and resolve the HTML as `../index.html` relative to the test file.
