(function () {
    'use strict';
    const P = window.HydrogenPhysics;
    const $ = id => document.getElementById(id);
    const lab = $('lab'), panel = $('controlsPanel'), viewport = $('viewport');
    const compact = matchMedia('(max-width:750px), (max-height:500px) and (max-width:950px)');
    const nSelect = $('nSelect'), lSelect = $('lSelect'), mSelect = $('mSelect');
    const density = $('density'), status = $('renderStatus');
    const MAX_POINTS = Number(density.max);
    let state = { n: 1, l: 0, m: 0 }, drawCount = Number(density.value);
    let renderer, scene, camera, orbit, cloud, axes, rebuildFrame, detection, detectionMatrix;
    let needsRender = true, ready = false, radius99 = 1;
    let detectionsEnabled = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastDetectionAt = -Infinity;
    const DETECTION_INTERVAL = 100;
    const labels = ['s', 'p', 'd', 'f', 'g', 'h'];

    function setPanel(open, returnFocus = false) {
        panel.hidden = !open;
        lab.classList.toggle('controls-open', open);
        $('controlsBackdrop').hidden = !(open && compact.matches);
        $('controlsToggle').setAttribute('aria-expanded', String(open));
        $('controlsToggle').setAttribute('aria-label', open ? 'Hide controls' : 'Show controls');
        $('controlsToggleIcon').setAttribute('d', open ? 'M5 5l10 10M15 5L5 15' : 'M3 5h14M3 10h14M3 15h14');
        viewport.inert = compact.matches && open;
        if (returnFocus) $('controlsToggle').focus();
    }
    $('controlsToggle').addEventListener('click', () => setPanel(panel.hidden));
    $('controlsBackdrop').addEventListener('click', () => setPanel(false, true));
    compact.addEventListener('change', () => setPanel(!compact.matches));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) setPanel(false, true);
        if (event.key === 'Tab' && compact.matches && !panel.hidden) {
            const targets = [$('controlsToggle'), ...panel.querySelectorAll('select, input, button, summary, details[open] a')];
            const first = targets[0], last = targets[targets.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    setPanel(!compact.matches);

    function fillSelect(element, min, max, value) {
        element.replaceChildren();
        for (let i = min; i <= max; i++) element.add(new Option(String(i), String(i)));
        element.value = String(value);
    }
    function reflectState(previous) {
        fillSelect(nSelect, 1, P.MAX_N, state.n);
        fillSelect(lSelect, 0, state.n - 1, state.l);
        fillSelect(mSelect, -state.l, state.l, state.m);
        $('stateName').textContent = `${state.n}${labels[state.l]} · m = ${state.m}`;
        $('energy').textContent = `−${(13.6057 / (state.n * state.n)).toFixed(2)} eV`;
        $('radialNodes').textContent = state.n - state.l - 1;
        $('polarNodes').textContent = state.l - Math.abs(state.m);
        for (const button of document.querySelectorAll('[data-state]')) {
            button.setAttribute('aria-pressed', String(button.dataset.state === `${state.n},${state.l},${state.m}`));
        }
        $('actionStatus').textContent = `Selected n = ${state.n}, l = ${state.l}, m = ${state.m}.` +
            (previous && (previous.l !== state.l || previous.m !== state.m) ? ' Dependent values updated to an allowed combination.' : '');
    }
    function changeState(n, l, m) {
        const previous = { n, l, m };
        state = P.constrainState(n, l, m);
        reflectState(previous);
        if (!ready) return;
        detection.visible = false;
        status.textContent = 'Preparing the probability cloud…';
        status.hidden = false;
        cancelAnimationFrame(rebuildFrame);
        rebuildFrame = requestAnimationFrame(buildCloud);
    }
    nSelect.addEventListener('change', () => changeState(Number(nSelect.value), state.l, state.m));
    lSelect.addEventListener('change', () => changeState(state.n, Number(lSelect.value), state.m));
    mSelect.addEventListener('change', () => changeState(state.n, state.l, Number(mSelect.value)));
    for (const button of document.querySelectorAll('[data-state]')) {
        button.addEventListener('click', () => changeState(...button.dataset.state.split(',').map(Number)));
    }
    function setDensity() {
        drawCount = Number(density.value);
        $('densityValue').textContent = `${drawCount.toLocaleString('en-US')} spheres`;
        density.style.setProperty('--range-fill', `${100 * (drawCount - Number(density.min)) / (MAX_POINTS - Number(density.min))}%`);
        if (cloud) {
            cloud.count = drawCount;
            highlightSample(performance.now(), true);
        }
        needsRender = true;
    }
    density.addEventListener('input', setDensity);
    density.addEventListener('change', () => { $('actionStatus').textContent = `Showing ${drawCount.toLocaleString('en-US')} probability samples.`; });
    function toggle(button, callback) {
        const on = button.getAttribute('aria-checked') !== 'true';
        button.setAttribute('aria-checked', String(on));
        button.classList.toggle('on', on);
        callback(on); needsRender = true;
    }
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
    reflectState(); setDensity();

    function highlightSample(now, force = false) {
        if (!detection) return;
        if (!detectionsEnabled) {
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

    function resetCamera() {
        if (!camera) return;
        const halfFov = camera.fov * Math.PI / 360;
        const halfAngle = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
        const distance = 3.5 / Math.sin(halfAngle);
        camera.position.copy(new THREE.Vector3(1, -1.6, 0.85).normalize().multiplyScalar(distance));
        orbit.target.set(0, 0, 0);
        orbit.update(); needsRender = true;
    }
    function makeAxes() {
        const group = new THREE.Group();
        const colors = [0xd799aa, 0x81b7b1, 0x8ab9ff];
        ['x', 'y', 'z'].forEach((name, i) => {
            const from = new THREE.Vector3(), to = new THREE.Vector3();
            from.setComponent(i, -3.2); to.setComponent(i, 3.2);
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({color:colors[i],transparent:true,opacity:0.35}));
            group.add(line);
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#' + colors[i].toString(16); ctx.font = '32px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name,32,32);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));
            sprite.position.copy(to).multiplyScalar(1.08); sprite.scale.set(.4,.4,1); group.add(sprite);
        });
        return group;
    }
    function buildCloud() {
        try {
            // +/-m share both their density and sample seed. Increasing point count
            // reveals a longer prefix of the same sample, without reshuffling it.
            const seed = state.n * 1000 + state.l * 100 + Math.abs(state.m);
            const sample = P.sample(state.n, state.l, state.m, MAX_POINTS, seed);
            radius99 = sample.radius99;
            const scale = 3 / radius99;
            const dummy = new THREE.Object3D();
            for (let i = 0; i < MAX_POINTS; i++) {
                dummy.position.set(sample.positions[3*i]*scale,sample.positions[3*i+1]*scale,sample.positions[3*i+2]*scale);
                dummy.updateMatrix(); cloud.setMatrixAt(i, dummy.matrix);
            }
            cloud.instanceMatrix.needsUpdate = true;
            cloud.count = drawCount;
            highlightSample(performance.now(), true);
            $('scaleLabel').textContent = `99% probability radius: ${radius99.toFixed(2)} a₀`;
            resetCamera(); status.hidden = true; needsRender = true;
        } catch (error) {
            status.hidden = false; status.textContent = 'The cloud could not be generated. Reload the lab to try again.';
            console.error(error);
        }
    }
    try {
        if (!window.THREE || !THREE.OrbitControls) throw new Error('The 3D libraries did not load');
        scene = new THREE.Scene(); scene.background = new THREE.Color('#061126');
        camera = new THREE.PerspectiveCamera(40, 1, 0.01, 500); camera.up.set(0,0,1);
        renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.domElement.setAttribute('aria-label','Three-dimensional hydrogen probability cloud. Drag to rotate and scroll or pinch to zoom.');
        renderer.domElement.setAttribute('role','img');
        $('canvas-container').appendChild(renderer.domElement);
        orbit = new THREE.OrbitControls(camera, renderer.domElement);
        orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.enablePan = false;
        orbit.minDistance = 1; orbit.maxDistance = 100; orbit.autoRotateSpeed = 0.6;
        orbit.addEventListener('change', () => { needsRender = true; });
        scene.add(new THREE.HemisphereLight(0xbad9ff,0x203150,0.85));
        const key = new THREE.DirectionalLight(0xffffff,0.9); key.position.set(-4,-6,9); scene.add(key);
        const fill = new THREE.DirectionalLight(0x77b1f6,0.4); fill.position.set(5,2,1); scene.add(fill);
        // Smaller diffuse spheres: no specular reflections, with light transparency.
        const sphereGeometry = new THREE.SphereGeometry(0.012,10,8);
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
        new ResizeObserver(() => {
            const width = viewport.clientWidth, height = viewport.clientHeight;
            if (!width || !height) return;
            renderer.setSize(width,height); camera.aspect = width/height; camera.updateProjectionMatrix(); resetCamera();
        }).observe(viewport);
        renderer.domElement.addEventListener('webglcontextlost', event => {
            event.preventDefault(); status.textContent = 'The 3D view was interrupted. Reload the page to restore it.'; status.hidden = false;
        });
        buildCloud();
        function animate(now = performance.now()) {
            requestAnimationFrame(animate);
            orbit.update();
            if (!document.hidden && status.hidden) highlightSample(now);
            if (needsRender || orbit.autoRotate) { renderer.render(scene,camera); needsRender = false; }
        }
        animate();
    } catch (error) {
        status.textContent = 'The 3D view could not start. Check your connection and WebGL support, then reload the page.';
        status.hidden = false; console.error(error);
    }
}());
