(function () {
    'use strict';
    const P = window.HydrogenPhysics;
    const S = window.HydrogenSurface, RS = window.HydrogenRealSurface;
    const paletteStyle = getComputedStyle(document.documentElement);
    let phasePalette;
    let basis = 'cos';
    const $ = id => document.getElementById(id);
    const viewport = $('viewport');
    const quantumSteppers = document.querySelectorAll('.quantum-stepper');
    const density = $('density'), status = $('renderStatus');
    const zoomLabel = $('zoomLabel'), zoomIn = $('zoomIn'), zoomOut = $('zoomOut');
    const displayOptions = $('displayMode');
    let displayMode = displayOptions.querySelector('input:checked').value;
    const enclosure = $('enclosure'), fuzziness = $('fuzziness');
    // One world unit is 25 Bohr radii for every state and display mode.
    const WORLD_SCALE = 0.04, VIEW_RADIUS = 3.8;
    const MAX_POINTS = Number(density.max);
    let state = { n: 5, l: 2, m: 0 }, drawCount = Number(density.value);
    let renderer, scene, camera, orbit, cloud, axes, rebuildFrame, detection, detectionMatrix;
    let homeDistance, nodes, nodeMaterial, nodeShape;
    let fuzzy, fuzzyState, fuzzyRadius99;
    let surface, surfaceModel, surfaceState, cloudState, surfaceProbability, surfaceRadius, cloudRadius99;
    let probability = Number(enclosure.value) / 100;
    let needsRender = true, ready = false, radius99 = 1;
    let detectionsEnabled = false;
    let lastDetectionAt = -Infinity;
    const DETECTION_INTERVAL = 100;
    const labels = ['s', 'p', 'd', 'f', 'g', 'h'];

    function canStep(key, delta) {
        const next = { ...state, [key]: state[key] + delta };
        return next.n <= P.MAX_N && P.validState(next.n, next.l, next.m);
    }
    setupLabCanvasTools(() => {
        if (!ready || !status.hidden || renderer.getContext().isContextLost()) return null;
        renderer.render(scene, camera);
        const frame = document.createElement('canvas');
        frame.width = renderer.domElement.width;
        frame.height = renderer.domElement.height;
        const ctx = frame.getContext('2d');
        // Composite the transparent WebGL scene over the viewport's radial backdrop.
        paintLabBackdrop(ctx, frame.width, frame.height);
        ctx.drawImage(renderer.domElement, 0, 0);
        return frame;
    }, () => `hydrogen-${$('stateName').textContent}-${displayMode}.png`);

    function reflectQuantumNumber(key, min, max) {
        const value = state[key];
        const element = $(key + 'Select');
        element.replaceChildren();
        for (let i = min; i <= max; i++) element.add(new Option(String(i), String(i)));
        element.value = String(value);
        const stepper = document.querySelector(`.quantum-stepper[data-number="${key}"]`);
        const realPair = key === 'm' && basis !== 'complex' && value !== 0;
        stepper.querySelector('.quantum-value').textContent = realPair ? `±${value}` : value;
        stepper.querySelector('[data-step="-1"]').disabled = !canStep(key, -1);
        stepper.querySelector('[data-step="1"]').disabled = !canStep(key, 1);
        if (realPair) {
            const option = new Option('', 'real');
            setLabCopy(option, '±{0} (real)', [value]);
            element.add(option);
            element.value = 'real';
        }
    }
    function describeRealOrbital(orbital) {
        return orbital.m
            ? labText('Real ±{0} combination: {1}({0}φ)', orbital.m, orbital.basis)
            : labText('Real m = 0 orbital');
    }
    function reflectState(previous) {
        reflectQuantumNumber('n', 1, P.MAX_N);
        reflectQuantumNumber('l', 0, state.n - 1);
        reflectQuantumNumber('m', -state.l, state.l);
        const orbitals = P.realOrbitals(state.n, state.l);
        const selected = orbitals.find(o => o.m === state.m && o.basis === basis);
        const realName = state.m === 0 ? orbitals.find(o => o.m === 0) : selected;
        const shell = `${state.n}${labels[state.l]}`;
        const suffix = realName ? realName.suffix : `(m=${state.m})`;
        const name = $('stateName');
        name.textContent = shell;
        if (suffix) {
            const subscript = document.createElement('sub');
            subscript.textContent = suffix;
            name.appendChild(subscript);
        }
        $('energy').textContent = `−${(13.6057 / (state.n * state.n)).toFixed(2)} eV`;
        nodeShape = P.nodalSurfaces(state.n, state.l, state.m, basis);
        $('nodeCount').textContent = nodeShape.radii.length + nodeShape.polarCosines.length + nodeShape.planeAngles.length;
        const row = $('realOrbitals'), group = `${state.n},${state.l}`;
        if (row.dataset.group !== group) {
            row.replaceChildren(); row.dataset.group = group;
            for (const orbital of orbitals) {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'action-button';
                button.textContent = orbital.label;
                setLabCopy(button, () => describeRealOrbital(orbital), [], 'title');
                button.dataset.m = orbital.m; button.dataset.basis = orbital.basis;
                button.addEventListener('click', () => changeState(state.n, state.l, orbital.m, orbital.basis));
                row.appendChild(button);
            }
        }
        for (const button of row.children) button.setAttribute('aria-pressed', String(
            Number(button.dataset.m) === state.m && button.dataset.basis === basis));
        const {n, l, m} = state;
        const adjusted = previous && (previous.l !== l || previous.m !== m);
        setLabCopy($('actionStatus'), () => {
            const description = selected
                ? labText('Selected {0}, {1}.', selected.label, describeRealOrbital(selected))
                : labText('Selected n = {0}, l = {1}, m = {2}.', n, l, m);
            return adjusted ? description + ' ' + labText('Dependent values updated to an allowed combination.') : description;
        });
    }
    function changeState(n, l, m, nextBasis = basis) {
        basis = nextBasis;
        const previous = { n, l, m };
        state = P.constrainState(n, l, m);
        if (basis !== 'complex') { state.m = Math.abs(state.m); if (!state.m) basis = 'cos'; }
        reflectState(previous);
        if (!ready) return;
        scheduleBuild();
    }
    for (const stepper of quantumSteppers) {
        const key = stepper.dataset.number;
        const select = $(key + 'Select');
        const setValue = value => {
            const next = { ...state, [key]: value };
            changeState(next.n, next.l, next.m, key === 'm' ? 'complex' : basis);
        };
        select.addEventListener('change', () => {
            if (select.value !== 'real') setValue(Number(select.value));
        });
        for (const button of stepper.querySelectorAll('button')) {
            button.addEventListener('click', () => {
                const delta = Number(button.dataset.step);
                if (canStep(key, delta)) setValue(state[key] + delta);
            });
        }
    }
    function setDensity() {
        drawCount = Number(density.value);
        setLabCopy($('densityValue'), () => drawCount.toLocaleString(document.documentElement.lang));
        density.style.setProperty('--range-fill', `${100 * (drawCount - Number(density.min)) / (MAX_POINTS - Number(density.min))}%`);
        if (cloud) {
            cloud.count = drawCount;
            highlightSample(performance.now(), true);
        }
        needsRender = true;
    }
    density.addEventListener('input', setDensity);
    density.addEventListener('change', () => { setLabCopy($('actionStatus'), 'Showing {0} probability samples.', [drawCount.toLocaleString('en-US')]); });
    function reflectDisplay() {
        const isSurface = displayMode === 'surface';
        const isPoints = displayMode === 'points';
        $('pointControls').hidden = !isPoints;
        $('detectionControls').hidden = !isPoints;
        $('surfaceControls').hidden = !isSurface;
        $('fuzzyControls').hidden = displayMode !== 'fuzzy';
        $('phaseLegend').hidden = isPoints;
        if (renderer) setLabCopy(renderer.domElement, isSurface
            ? 'Three-dimensional hydrogen probability surface. Drag to rotate and scroll or pinch to zoom.'
            : 'Three-dimensional hydrogen probability cloud. Drag to rotate and scroll or pinch to zoom.', [], 'aria-label');
    }
    function setFuzziness() {
        const value = Number(fuzziness.value);
        $('fuzzinessValue').textContent = `${value}%`;
        setLabCopy(fuzziness, '{0} percent fuzziness', [value], 'aria-valuetext');
        fuzziness.style.setProperty('--range-fill', `${value}%`);
        if (fuzzy) fuzzy.material.uniforms.fuzziness.value = value / 100;
        needsRender = true;
    }
    fuzziness.addEventListener('input', setFuzziness);
    fuzziness.addEventListener('change', () => {
        setLabCopy($('actionStatus'), 'Cloud fuzziness set to {0}%.', [fuzziness.value]);
    });
    function setEnclosure() {
        probability = Number(enclosure.value) / 100;
        $('enclosureValue').textContent = `${Number(enclosure.value).toFixed(1)}%`;
        setLabCopy(enclosure, '{0} percent enclosed probability', [Number(enclosure.value).toFixed(1)], 'aria-valuetext');
        enclosure.style.setProperty('--range-fill', `${100 * (Number(enclosure.value) - Number(enclosure.min)) / (Number(enclosure.max) - Number(enclosure.min))}%`);
        if (ready && displayMode === 'surface') scheduleBuild();
    }
    displayOptions.addEventListener('change', event => {
        displayMode = event.target.value;
        reflectDisplay();
        scheduleBuild();
    });
    enclosure.addEventListener('input', setEnclosure);
    enclosure.addEventListener('change', () => { setLabCopy($('actionStatus'), 'Surface encloses approximately {0}% probability.', [(probability * 100).toFixed(1)]); });
    function scheduleBuild() {
        if (!ready) return;
        detection.visible = false;
        setLabCopy(status, displayMode === 'surface' ? 'Preparing the probability surface…' : 'Preparing the probability cloud…');
        status.hidden = false;
        cancelAnimationFrame(rebuildFrame);
        rebuildFrame = requestAnimationFrame(() => {
            rebuildFrame = requestAnimationFrame(buildVisualization);
        });
    }
    function toggle(button, callback) {
        const on = button.getAttribute('aria-checked') !== 'true';
        button.setAttribute('aria-checked', String(on));
        button.classList.toggle('on', on);
        callback(on); needsRender = true;
    }
    $('nodesToggle').addEventListener('click', () => toggle($('nodesToggle'), () => {
        if (ready) drawNodes();
    }));
    $('axesToggle').addEventListener('click', () => toggle($('axesToggle'), on => { if (axes) axes.visible = on; }));
    $('rotationToggle').addEventListener('click', () => toggle($('rotationToggle'), on => { if (orbit) orbit.autoRotate = on; }));
    $('detectionToggle').addEventListener('click', () => toggle($('detectionToggle'), on => {
        detectionsEnabled = on;
        highlightSample(performance.now(), true);
    }));
    $('detectionToggle').setAttribute('aria-checked', String(detectionsEnabled));
    $('detectionToggle').classList.toggle('on', detectionsEnabled);
    document.addEventListener('visibilitychange', () => { lastDetectionAt = -Infinity; });
    $('resetView').addEventListener('click', resetCamera);
    zoomIn.addEventListener('click', () => zoomView(1 / 1.25));
    zoomOut.addEventListener('click', () => zoomView(1.25));
    reflectState(); setDensity(); setEnclosure(); setFuzziness(); reflectDisplay();

    function highlightSample(now, force = false) {
        if (!detection) return;
        if (!detectionsEnabled || displayMode !== 'points' || !cloud || !cloud.visible) {
            if (detection.visible) {
                detection.visible = false;
                needsRender = true;
            }
            return;
        }
        if (!force && now - lastDetectionAt < DETECTION_INTERVAL) return;
        // Uniformly choose an existing probability sample. Weighting by density
        // again would bias the distribution. One reusable marker leaves no trail.
        const index = Math.floor(Math.random() * cloud.count);
        cloud.getMatrixAt(index, detectionMatrix);
        detection.position.setFromMatrixPosition(detectionMatrix);
        detection.visible = true;
        lastDetectionAt = now;
        needsRender = true;
    }

    function zoomView(factor) {
        if (!camera || !orbit) return;
        const offset = camera.position.clone().sub(orbit.target);
        const distance = Math.max(orbit.minDistance, Math.min(orbit.maxDistance, offset.length() * factor));
        camera.position.copy(orbit.target).add(offset.setLength(distance));
        orbit.update(); needsRender = true;
    }

    function updateZoomControls() {
        if (!homeDistance) return;
        const distance = camera.position.distanceTo(orbit.target);
        // Perspective scale in the plane through the nucleus.
        const viewHeight = 2 * distance * Math.tan(camera.fov * Math.PI / 360);
        updateLabScale($('distanceLabel'), $('scaleRule'), viewport.clientHeight * WORLD_SCALE / viewHeight, 'a₀');
        const label = Math.round(100 * homeDistance / distance) + '%';
        // OrbitControls also emits changes during rotation.
        if (zoomLabel.textContent !== label) zoomLabel.textContent = label;
        const atClosest = distance <= orbit.minDistance + 1e-8;
        const atFarthest = distance >= orbit.maxDistance - 1e-8;
        if (zoomIn.disabled !== atClosest) zoomIn.disabled = atClosest;
        if (zoomOut.disabled !== atFarthest) zoomOut.disabled = atFarthest;
    }

    function resetCamera() {
        if (!homeDistance) return;
        camera.position.copy(new THREE.Vector3(1, -1.6, 0.85).normalize().multiplyScalar(homeDistance));
        orbit.target.set(0, 0, 0);
        orbit.update(); needsRender = true;
    }
    function makeAxes() {
        const group = new THREE.Group();
        const colors = [0xd799aa, 0x81b7b1, 0x8ab9ff];
        colors.forEach((color, i) => {
            const from = new THREE.Vector3(), to = new THREE.Vector3();
            from.setComponent(i, -3.2); to.setComponent(i, 3.2);
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({color,transparent:true,opacity:0.35}));
            group.add(line);
        });
        return group;
    }
    function drawNodes() {
        for (const mesh of nodes.children) mesh.geometry.dispose();
        nodes.clear();
        if ($('nodesToggle').getAttribute('aria-checked') !== 'true') return;
        const extent = radius99 * WORLD_SCALE;
        function add(geometry) {
            const mesh = new THREE.Mesh(geometry, nodeMaterial);
            mesh.renderOrder = 5;
            nodes.add(mesh);
            return mesh;
        }
        for (const r of nodeShape.radii) add(new THREE.SphereGeometry(r * WORLD_SCALE, 64, 32));
        for (const mu of nodeShape.polarCosines) {
            if (Math.abs(mu) < 1e-10) {
                add(new THREE.CircleGeometry(extent, 64));
            } else {
                const height = extent * mu;
                const cone = add(new THREE.ConeGeometry(extent * Math.sqrt(1 - mu * mu), Math.abs(height), 64, 1, true));
                cone.rotation.x = -Math.sign(height) * Math.PI / 2;
                cone.position.z = height / 2;
            }
        }
        for (const phi of nodeShape.planeAngles) {
            const plane = add(new THREE.CircleGeometry(extent, 64));
            plane.rotation.order = 'ZXY';
            plane.rotation.x = Math.PI / 2;
            plane.rotation.z = phi;
        }
    }
    function buildVisualization() {
        try {
            const key = `${state.n},${state.l},${Math.abs(state.m)},${basis}`;
            const isSurface = displayMode === 'surface';
            const phaseKey = `${state.n},${state.l},${state.m},${basis}`;
            if (displayMode === 'fuzzy') {
                if (fuzzyState !== phaseKey) {
                    fuzzyRadius99 = window.HydrogenFuzzy.update(fuzzy, state, basis, WORLD_SCALE);
                    fuzzyState = phaseKey;
                }
                radius99 = fuzzyRadius99;
            } else if (isSurface) {
                const surfaceEngine = basis !== 'complex' && state.m !== 0 ? RS : S;
                if (surfaceState !== phaseKey) {
                    surfaceModel = surfaceEngine.prepare(state.n, state.l, state.m, basis);
                    surfaceState = phaseKey;
                    surfaceProbability = undefined;
                }
                radius99 = surfaceModel.radius99;
                if (surfaceProbability !== probability) {
                    const mesh = surfaceEngine.build(surfaceModel, probability);
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
                    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
                    const colors = new Float32Array(mesh.positions.length), color = new THREE.Color();
                    for (let i = 0; i < mesh.positions.length; i += 3) {
                        const phase = P.phase(state.n, state.l, state.m, ...mesh.positions.subarray(i, i + 3), basis);
                        phasePalette.colorAt(phase, color).convertSRGBToLinear();
                        color.toArray(colors, i);
                    }
                    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
                    geometry.computeBoundingSphere();
                    surface.geometry.dispose();
                    surface.geometry = geometry;
                    surface.scale.setScalar(WORLD_SCALE);
                    surfaceProbability = probability;
                    surfaceRadius = mesh.maxRadius;
                }
            } else if (cloudState !== key) {
                // +/-m share both their density and sample seed. Increasing point count
                // reveals a longer prefix of the same sample, without reshuffling it.
                const seed = state.n * 1000 + state.l * 100 + Math.abs(state.m);
                const sample = P.sample(state.n, state.l, state.m, MAX_POINTS, seed, basis);
                cloudRadius99 = sample.radius99;
                const scale = WORLD_SCALE;
                const dummy = new THREE.Object3D();
                for (let i = 0; i < MAX_POINTS; i++) {
                    dummy.position.set(sample.positions[3*i]*scale,sample.positions[3*i+1]*scale,sample.positions[3*i+2]*scale);
                    dummy.updateMatrix(); cloud.setMatrixAt(i, dummy.matrix);
                }
                cloud.instanceMatrix.needsUpdate = true;
                cloud.count = drawCount;
                cloudState = key;
            }
            cloud.visible = displayMode === 'points';
            if (cloud.visible) radius99 = cloudRadius99;
            fuzzy.visible = displayMode === 'fuzzy';
            surface.visible = isSurface;
            drawNodes();
            highlightSample(performance.now(), true);
            setLabCopy($('scaleLabel'), isSurface ? 'Surface extent from nucleus' : '99% probability radius');
            $('scaleValue').textContent = `${(isSurface ? surfaceRadius : radius99).toFixed(2)} a₀`;
            $('scaleMetric').hidden = false;
            reflectDisplay();
            status.hidden = true; needsRender = true;
        } catch (error) {
            fuzzy.visible = false; cloud.visible = false; surface.visible = false; detection.visible = false;
            status.hidden = false; setLabCopy(status, 'The orbital could not be generated. Try another state or reload the lab.');
            console.error(error);
        }
    }
    try {
        if (!window.THREE || !THREE.OrbitControls) throw new Error('The 3D libraries did not load');
        phasePalette = window.HydrogenOrbitalColors(
            new THREE.Color(paletteStyle.getPropertyValue('--orbital-positive').trim()),
            new THREE.Color(paletteStyle.getPropertyValue('--orbital-negative').trim())
        );
        $('phaseRamp').style.background = phasePalette.gradient;
        scene = new THREE.Scene();
        nodes = new THREE.Group();
        scene.add(nodes);
        nodeMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#59cf96').convertSRGBToLinear(), transparent: true,
            opacity: .18, side: THREE.DoubleSide, depthWrite: false, depthTest: false
        });
        camera = new THREE.PerspectiveCamera(40, 1, 0.01, 500); camera.up.set(0,0,1);
        renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        setLabCopy(renderer.domElement, 'Three-dimensional hydrogen probability cloud. Drag to rotate and scroll or pinch to zoom.', [], 'aria-label');
        renderer.domElement.setAttribute('role','img');
        $('canvas-container').appendChild(renderer.domElement);
        orbit = new THREE.OrbitControls(camera, renderer.domElement);
        orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.enablePan = false;
        orbit.rotateSpeed = 1.25;
        orbit.minDistance = 1; orbit.maxDistance = 100; orbit.autoRotateSpeed = 0.9;
        orbit.autoRotate = true;
        orbit.addEventListener('change', () => { updateZoomControls(); needsRender = true; });
        scene.add(new THREE.HemisphereLight(0xbad9ff,0x203150,0.85));
        const key = new THREE.DirectionalLight(0xffffff,0.9); key.position.set(-4,-6,9); scene.add(key);
        const fill = new THREE.DirectionalLight(0x77b1f6,0.4); fill.position.set(5,2,1); scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffffff,0.25); rim.position.set(2,5,6); scene.add(rim);
        surface = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhongMaterial({
            color:0xffffff, vertexColors:true, specular:0x151515, shininess:18,
            side:THREE.DoubleSide
        }));
        surface.visible = false; scene.add(surface);
        fuzzy = window.HydrogenFuzzy.create(phasePalette.texture);
        fuzzy.visible = false; scene.add(fuzzy);
        setFuzziness();
        // Smaller diffuse spheres: no specular reflections, with light transparency.
        const sphereGeometry = new THREE.SphereGeometry(0.004,10,8);
        cloud = new THREE.InstancedMesh(sphereGeometry,new THREE.MeshLambertMaterial({color:0x77b1f6,transparent:true,opacity:0.58,depthWrite:false}),MAX_POINTS);
        cloud.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cloud.frustumCulled = false; scene.add(cloud);
        detection = new THREE.Mesh(sphereGeometry,new THREE.MeshBasicMaterial({color:0xffd482,transparent:true,opacity:1,depthWrite:false,depthTest:false}));
        detection.scale.setScalar(3.5);
        detection.renderOrder = 10;
        detection.visible = false;
        detectionMatrix = new THREE.Matrix4();
        scene.add(detection);
        axes = makeAxes(); scene.add(axes);
        ready = true;
        let initialViewSet = false;
        new ResizeObserver(() => {
            const width = viewport.clientWidth, height = viewport.clientHeight;
            if (!width || !height) return;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            // Home frames the same physical radius for every orbital.
            const halfFov = camera.fov * Math.PI / 360;
            const halfAngle = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
            homeDistance = Math.min(orbit.maxDistance, VIEW_RADIUS / Math.sin(halfAngle));
            if (!initialViewSet) {
                resetCamera();
                initialViewSet = true;
            }
            updateZoomControls();
            // The new drawing buffer needs a frame before the browser paints the resize.
            renderer.render(scene, camera);
            needsRender = false;
        }).observe(viewport);
        renderer.domElement.addEventListener('webglcontextlost', event => {
            event.preventDefault(); setLabCopy(status, 'The 3D view was interrupted. Reload the page to restore it.'); status.hidden = false;
        });
        buildVisualization();
        function animate(now = performance.now()) {
            requestAnimationFrame(animate);
            orbit.update();
            if (!document.hidden && status.hidden) highlightSample(now);
            if (needsRender || orbit.autoRotate) { renderer.render(scene,camera); needsRender = false; }
        }
        animate();
    } catch (error) {
        setLabCopy(status, 'The 3D view could not start. Check your connection and WebGL support, then reload the page.');
        status.hidden = false; console.error(error);
    }
}());
