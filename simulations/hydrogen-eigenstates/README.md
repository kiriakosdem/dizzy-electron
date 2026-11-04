# Hydrogen eigenstates laboratory

Open `index.html` via the repository's local preview server. The banner, dark-blue palette, right-hand drawer, sliders and switches follow the electric/gravitational field labs. Below 750 px the controls collapse into an overlay drawer.

## Controls

- Select n, ℓ and m separately. This lab supports 1 ≤ n ≤ 6 (91 states). This is a display limit, not a physical upper bound on n.
- Allowed ℓ values are 0…n−1; allowed m values are −ℓ…ℓ. Changing a parent value retains valid dependent values and clamps invalid ones to the nearest allowed value.
- Point density selects 500–20,000 samples. Points are small, matte sphere meshes with 58% opacity, drawn using Three.js instancing. The slider reveals a prefix of a deterministic sample, so it does not reshuffle existing points or change the state.
- Detection highlights select one currently displayed sample uniformly at random every 100 ms. A single amber marker jumps directly to that sphere, with no trail. This illustrates repeated position measurements on identically prepared states, rather than a trajectory or post-measurement dynamics. The switch hides the marker when off; reduced-motion preferences start it off. Hidden browser tabs pause the animation.
- Drag to rotate; scroll/pinch to zoom. Reset view fits the state. Coordinate axes and automatic view rotation are optional; rotation is off initially.
- The z axis defines m. The camera fits each new state, so compare the displayed 99% probability radius (in Bohr radii) when comparing sizes across states. This radius is a readout, not a hard cutoff of the cloud.

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

## Files and checks

- `index.html`: accessible control markup.
- `lab.css`: styles matching the field labs.
- `lab.js`: controls, responsive layout, Three.js scene and instanced spheres.
- `physics.js`: browser/Node-compatible numerical model.
- `tests/physics.test.cjs`: validity, known wavefunctions/nodes, normalization, mean radii, sampled angular moments, ±m symmetry and sample-prefix stability.

From this folder, run `node --test tests/physics.test.cjs`. No npm packages are required. The 3D view uses the existing Three.js r128 and matching OrbitControls CDN builds, so the browser requires internet access and WebGL. Geometry/material buffers are reused when changing states; changing the point count only changes the instance count.

## References

- [OpenStax: The Hydrogen Atom](https://openstax.org/books/university-physics-volume-3/pages/8-1-the-hydrogen-atom) — quantum numbers and the fixed-proton model.
- [NIST DLMF §14.30](https://dlmf.nist.gov/14.30) — normalized complex spherical harmonics.
- [McCullagh Lab: The Hydrogen Atom](https://mccullaghlab.github.io/computational_chemistry/quantum_mechanics/the_hydrogen_atom.html) — radial wavefunctions and generalized Laguerre polynomials.
