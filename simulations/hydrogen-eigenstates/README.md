# The hydrogen atom laboratory

Open `index.html` via the repository's local preview server. The banner, dark-blue palette, right-hand drawer, sliders and switches follow the electric/gravitational field labs. Below 750 px the controls collapse into an overlay drawer.

## Controls

- Select n, ℓ and m separately. This lab supports 1 ≤ n ≤ 6 (91 states). This is a display limit, not a physical upper bound on n.
- Allowed ℓ values are 0…n−1; allowed m values are −ℓ…ℓ. Changing a parent value retains valid dependent values and clamps invalid ones to the nearest allowed value.
- Point density selects 1,000–30,000 samples, with 10,000 selected by default. Points are small, matte sphere meshes with 58% opacity, drawn using Three.js instancing. The slider reveals a prefix of a deterministic sample, so it does not reshuffle existing points or change the state.
- Orbital display starts with the softly lit phase-colored surface and also offers the point cloud. The phase legend is at the top right of the canvas. Enclosed probability defaults to 70.0% and adjusts from 50.0% to 99.9% in 0.1 percentage-point steps. The surface bounds the highest-density regions containing approximately that total probability, including disconnected lobes and excluding nodal gaps. It is not an electron's solid boundary; the remaining probability lies outside.
- Surface mode hides the point-density and detection controls, retaining their settings when returning to the cloud. The camera and physical scale stay fixed while enclosure changes, making expansion and contraction visible. The surface readout gives its maximum distance from the nucleus; outer opaque shells can obscure inner boundaries.
- Detection highlights select one currently displayed sample uniformly at random every 100 ms. A single amber marker jumps directly to that sphere, with no trail. This illustrates repeated position measurements on identically prepared states, rather than a trajectory or post-measurement dynamics. The switch hides the marker when off; highlights start off by default. Hidden browser tabs pause the animation.
- Drag to rotate; scroll/pinch to zoom. Reset view restores the common physical scale. Coordinate axes and automatic view rotation are optional; rotation is on initially.
- The z axis defines m. All states and both display modes use a fixed 0.04 scene units per Bohr radius and a common initial camera framing of 95 a₀ radius, so sizes can be compared directly. The coordinate axes extend to ±80 a₀. Low-n orbitals look small at this scale; use zoom to inspect them. The displayed extent or 99% radius is in Bohr radii. The cloud's radius is a readout, not a hard cutoff.

## Physics and sampling

The model uses a fixed nucleus, nonrelativistic hydrogen Hamiltonian, without spin, fine structure or external fields. In atomic units a₀ = 1:

```text
ψ_nℓm(r, θ, φ) = R_nℓ(r) Y_ℓ^m(θ, φ)
ρ = 2r/n
R_nℓ(r) = sqrt((2/n)^3 (n−ℓ−1)! / [2n(n+ℓ)!])
           × exp(−ρ/2) ρ^ℓ L_(n−ℓ−1)^(2ℓ+1)(ρ)
|Y_ℓ^m|² = (2ℓ+1)/(4π) × (ℓ−|m|)!/(ℓ+|m|)! × [P_ℓ^|m|(cos θ)]²
E_n ≈ −13.6057/n² eV
```

`physics.js` implements generalized Laguerre and associated Legendre recurrences. It integrates normalized CDFs on 8,192 intervals for r²|R|² and for 2π|Y|² in μ = cos θ. Inverse-CDF samples of r and μ, with uniform φ, include the spherical volume Jacobian; there is no uniform-box rejection ceiling or origin padding. The radial integration ends at 2n² + 20n + 20 Bohr radii; normalization and analytical mean radii are checked for every supported state.

These are complex angular-momentum eigenstates. Their probability densities are independent of φ and are identical for ±m. In particular, m = ±1 p states are not the real pₓ/pᵧ orbital combinations. The polar node readout is ℓ−|m|; the radial count is n−ℓ−1. Individual spheres show possible measurement positions, not multiple electrons or a trajectory. Sphere radii and lighting are visualization choices.

## Enclosed-probability surface

`surface.js` chooses a spatial-density threshold τ such that ∫_{|ψ|² ≥ τ} |ψ|² dV approximates the selected probability. Quadrature uses 2,048 quadratic radial intervals and 512 polar intervals, with the exact shell/solid-angle volume factors and midpoint densities. An 8,192-bin logarithmic density histogram stores cumulative probability mass for fast slider updates. The radial domain omits only 10⁻⁹ probability. This is a numerical approximation, independent of the cloud's sample count; it does not use a radial quantile as the orbital's shape.

Because these complex eigenstates have axially symmetric densities, marching squares on a radial/polar grid finds all contour segments, which are revolved around z with 96 azimuthal segments. Radial and polar nodes are inserted explicitly to preserve narrow gaps, even at 99.9% enclosure. Edge intersections are refined by bisection; normals follow the negative density gradient. Shared indexed vertices close seams and poles. A Phong material provides subtle highlights. Vertex colors map arg ψ to a cyclic hue wheel, including radial and polar sign changes and the signed m azimuthal phase (Condon–Shortley convention). The common time-dependent phase is omitted. Rebuilding disposes of the previous GPU geometry and reuses the material; probability tables are reused for the current state.

Tests compare the 1s boundary against its analytic cumulative probability, and representative s/p/d and high-order states against an independent uniform-r/uniform-cos(θ) quadrature (tolerance 0.15 percentage points). Mesh tests check closed, consistently oriented boundaries, finite unit normals, and constant density at vertices, including high-order nodal shells.

## Files and checks

- `index.html`: accessible control markup.
- `lab.css`: styles matching the field labs.
- `lab.js`: controls, responsive layout, Three.js scene, instanced spheres and glossy surfaces.
- `physics.js`: browser/Node-compatible numerical model.
- `surface.js`: browser/Node-compatible enclosure integration and surface geometry.
- `tests/physics.test.cjs`: validity, known wavefunctions/nodes, normalization, mean radii, sampled angular moments, ±m symmetry and sample-prefix stability.
- `tests/surface.test.cjs`: analytic enclosure, independent probability integration, surface topology, normals and ±m symmetry.

From this folder, run `node --test tests/*.test.cjs`. No npm packages are required. The 3D view uses the existing Three.js r128 and matching OrbitControls CDN builds, so the browser requires internet access and WebGL. Cloud geometry/material buffers are reused when changing states; changing the point count only changes the instance count.

## References

- [OpenStax: The Hydrogen Atom](https://openstax.org/books/university-physics-volume-3/pages/8-1-the-hydrogen-atom) — quantum numbers and the fixed-proton model.
- [NIST DLMF §14.30](https://dlmf.nist.gov/14.30) — normalized complex spherical harmonics.
- [McCullagh Lab: The Hydrogen Atom](https://mccullaghlab.github.io/computational_chemistry/quantum_mechanics/the_hydrogen_atom.html) — radial wavefunctions and generalized Laguerre polynomials.

## Suggested real orbitals

For every allowed n/ℓ, a horizontally scrollable row offers the standard 2ℓ+1 real tesseral basis: m=0 plus sine and cosine combinations of each ±m pair. There are 1, 3, 5, 7, 9 and 11 choices for s through h. The s/p/d/f labels use familiar orbital names; g/h use the explicit order and s/c notation described beside the row. This is a complete basis, not an enumeration of the infinitely many possible real linear combinations. Selecting m returns to complex spherical harmonics; real combinations have no single m eigenvalue.

`physics.js` evaluates normalized real harmonics as sqrt(2)(−1)^m Re/Im(Y_l^m) for m>0. Cloud sampling uses the appropriate normalized sin²/cos² azimuth CDF. Phase coloring uses the sign of the real amplitude, including radial nodes.

`real-surface.js` handles the non-axisymmetric surfaces on a 144³-cell Cartesian grid with a box half-width of 1.55 times the 99% radial radius. Density-weighted quadrature chooses the enclosure threshold; marching tetrahedra extracts both signed amplitude levels ±sqrt(threshold), preserving separation of opposite-phase lobes. This is a finite-resolution approximation; very small inner structures can be under-resolved. The existing axial method remains in use for m=0 and complex states. Preparation and extraction take roughly 1–2 seconds for representative real orbitals on the development machine. Tests verify the entire real angular basis through ℓ=5, p-orbital sampling and orientations, and independent sampled enclosure checks for p and h surfaces.

## Canvas view controls

The bottom-right canvas toolbar offers Zoom in, Zoom out and a house-icon Reset view. Each zoom click changes camera distance by a factor of 1.25, within the same limits as scroll/pinch zoom. Reset restores the common physical scale and viewing direction. Buttons have accessible names, keyboard focus styles and 44 px touch targets. The energy readout and physical extent are in the controls panel; the canvas has no energy diagram or instruction footer.
