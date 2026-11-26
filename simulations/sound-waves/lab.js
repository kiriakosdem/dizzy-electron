/* The picture is a view of the collision simulation, never a prescribed wave. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const canvas = $('soundCanvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
        const status = $('renderStatus');
        setLabCopy(status, 'Your browser could not initialize a 2D canvas.');
        status.hidden = false;
        return;
    }
    const viewport = $('viewport');
    let sim;
    const view = { pressure: true, speed: true, track: false };
    const graphPressureHalfRange = 1.5; // In units of the starting pressure.
    const basePlaybackRate = .25;
    let playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 1, height = 1, dpr = 1, lastTime = 0, accumulator = 0;
    let resizeTimer;
    let samples, pressure, pressureDelta, tracked, trail = [], lastTrailTime = -1;
    let lastReadout = -1;
    const palette = Array.from({ length: 24 }, (_, i) => {
        const t = i / 23;
        // Blue -> pale cyan -> amber. A fixed scale makes heating visible.
        const a = t < .5 ? [80, 184, 240] : [190, 223, 230];
        const b = t < .5 ? [190, 223, 230] : [255, 143, 65];
        const f = t < .5 ? t * 2 : t * 2 - 1;
        return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',')})`;
    });

    function announce(message) { setLabCopy($('actionStatus'), message); }
    function reflectPlayback() {
        setLabLabel($('playPause'), playing ? 'Pause simulation' : 'Play simulation');
        $('playIcon').setAttribute('d', playing ? 'M6 4h3v12H6zm5 0h3v12h-3z' : 'M6 3l11 7-11 7z');
    }
    function reflectSource() {
        $('continuousMode').checked = sim.continuous;
        $('pulseMode').checked = !sim.continuous;
        $('pulseButton').hidden = sim.continuous;
        $('pulseButton').disabled = sim.pulseActive;
    }
    function chooseTracked() {
        tracked = sim.particles.reduce((best, p) =>
            Math.hypot(p.x - sim.width * .3, p.y - sim.height * .5) <
            Math.hypot(best.x - sim.width * .3, best.y - sim.height * .5) ? p : best, sim.particles[0]);
        trail = [];
        lastTrailTime = -1;
    }
    function sample(dt = 0) {
        samples = sim.sampleBins();
        const smoothed = samples.pressure.map((_, i, values) => {
            if (!samples.widths[i]) return 1;
            let total = 0, weight = 0;
            for (let j = -2; j <= 2; j++) {
                if (i + j < 0 || i + j >= values.length) continue;
                const w = (3 - Math.abs(j)) * samples.widths[i + j];
                total += values[i + j] * w;
                weight += w;
            }
            return total / weight;
        });
        const blend = dt ? 1 - Math.exp(-dt / .065) : 1;
        if (!pressure) pressure = smoothed;
        else smoothed.forEach((v, i) => {
            pressure[i] = samples.widths[i] ? pressure[i] + blend * (v - pressure[i]) : 1;
        });
        // The slices have the same height, so width weights give the area
        // average. Slices behind the drum have zero width and do not count.
        let totalPressure = 0, gasWidth = 0;
        samples.widths.forEach((sliceWidth, i) => {
            totalPressure += pressure[i] * sliceWidth;
            gasWidth += sliceWidth;
        });
        const averagePressure = gasWidth ? totalPressure / gasWidth : 0;
        pressureDelta = pressure.map((value, i) => samples.widths[i] ? value - averagePressure : 0);
        if (view.track && (!tracked || tracked.exited)) chooseTracked();
        if (view.track && tracked && sim.time - lastTrailTime > .025) {
            trail.push({ x: tracked.x, y: tracked.y });
            if (trail.length > 100) trail.shift();
            lastTrailTime = sim.time;
        }
    }
    function restart() {
        const { sceneWidth, chamberHeight } = chamberLayout();
        const count = Number($('particleCount').value);
        const scale = Math.min(sceneWidth / 1200, chamberHeight / 700);
        const modelWidth = sceneWidth / scale;
        const modelHeight = chamberHeight / scale;
        if (sim && Math.abs(sim.width - modelWidth) < 1 && Math.abs(sim.height - modelHeight) < 1) {
            sim.reset({ count });
        } else {
            const firstRun = !sim;
            sim = new SoundPhysics.Simulation({
                count, width: modelWidth, height: modelHeight,
                amplitude: Number($('amplitude').value),
                frequency: Number($('frequency').value),
                continuous: sim?.continuous
            });
            if (firstRun) sim.pulse();
        }
        pressure = null;
        accumulator = 0;
        chooseTracked();
        sample();
        reflectSource();
        updateReadout();
        draw();
    }
    function updateReadout() {
        $('timeReadout').textContent = `${sim.time.toFixed(1)} τ`;
        $('energyReadout').textContent = `${(sim.energy / sim.startingEnergy).toFixed(2)}×`;
        $('particleReadout').textContent = sim.particles.length.toLocaleString(document.documentElement.lang);
        lastReadout = sim.time;
    }
    $('playPause').addEventListener('click', () => {
        playing = !playing;
        accumulator = 0;
        updateReadout();
        reflectPlayback();
        announce(playing ? 'Playback resumed.' : 'Simulation paused.');
    });
    $('resetButton').addEventListener('click', () => { restart(); announce('Chamber reset.'); });
    $('pulseButton').addEventListener('click', () => {
        sim.pulse();
        playing = true;
        reflectPlayback();
        reflectSource();
        announce('The membrane launched one pulse.');
    });
    for (const id of ['continuousMode', 'pulseMode']) $(id).addEventListener('change', () => {
        sim.setDrive({ continuous: $('continuousMode').checked });
        reflectSource();
        announce(sim.continuous ? 'Continuous vibration enabled.' : 'Continuous vibration stopped. Waves already in the chamber keep travelling.');
    });
    for (const name of ['amplitude', 'frequency']) {
        const slider = $(name);
        const updateFill = () => {
            const fraction = (slider.valueAsNumber - Number(slider.min)) / (Number(slider.max) - Number(slider.min));
            // The thumb center travels one thumb radius in from each end.
            slider.style.setProperty('--range-fill',
                `calc(${fraction * 100}% + var(--thumb-size) * ${.5 - fraction})`);
        };
        updateFill();
        slider.addEventListener('input', () => {
            const value = slider.valueAsNumber;
            sim.setDrive({ [name]: value });
            $(name + 'Value').textContent = name === 'frequency' ? `${value.toFixed(2)} / τ` : String(value);
            updateFill();
        });
    }
    for (const name of Object.keys(view)) {
        $(name + 'Toggle').addEventListener('click', () => {
            view[name] = !view[name];
            $(name + 'Toggle').setAttribute('aria-checked', String(view[name]));
            if (name === 'pressure' || name === 'speed') {
                $(name + 'Legend').hidden = !view[name];
                $('pressureLegend').parentElement.hidden = !view.pressure && !view.speed;
            }
            if (name === 'track') { trail = []; lastTrailTime = -1; }
            draw();
        });
    }
    $('particleCount').addEventListener('change', () => { restart(); announce('Particle count changed. Chamber reset.'); });
    document.addEventListener('visibilitychange', () => { lastTime = 0; accumulator = 0; });
    document.addEventListener('keydown', event => {
        if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
            event.target.closest('button, input, select, summary, a, dialog') || labControls.drawerOpen) return;
        event.preventDefault();
        $('playPause').click();
    });
    setupLabCanvasTools(() => { draw(); return canvas; }, () => 'dizzy-electron-sound-waves.png');

    function line(x1, y1, x2, y2, color, lineWidth = 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    const speedGroups = palette.map(() => []);
    function chamberLayout() {
        const fieldHeight = Math.max(70, height - 78);
        const fieldWidth = Math.max(100, width);
        // On tall screens the wave travels up from the piston at the bottom.
        const portrait = fieldHeight > fieldWidth * 1.15;
        const sceneWidth = portrait ? fieldHeight : fieldWidth;
        const sceneHeight = portrait ? fieldWidth : fieldHeight;
        const graphHeight = Math.min(64, sceneHeight * .15);
        const graphGap = 11;
        const chamberHeight = sceneHeight - graphHeight - graphGap;
        return { portrait, sceneWidth, chamberHeight, graphHeight, graphGap };
    }

    function draw() {
        if (!samples || width < 100 || height < 140) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintLabBackdrop(ctx, width, height);
        const { portrait, sceneWidth, chamberHeight, graphHeight, graphGap } = chamberLayout();
        // While resizing, fit the previous chamber uniformly until the new
        // geometry is ready. Both coordinates always use pixels per model unit.
        const scale = Math.min(sceneWidth / sim.width, chamberHeight / sim.height);
        const renderedHeight = sim.height * scale;
        const top = 0;
        ctx.save();
        if (portrait) {
            ctx.translate(0, sceneWidth);
            ctx.rotate(-Math.PI / 2);
        }
        const sx = x => x * scale;
        const yy = y => y * scale;
        const pistonBack = sx(0);
        const wall = sx(sim.pistonX);
        const end = sx(sim.width);
        const bottom = top + renderedHeight;
        const radius = Math.max(.5, sim.radius * scale);
        const fadeStart = end - Math.min(28, (end - sx(0)) * .065);
        const outletPaint = color => {
            const fade = ctx.createLinearGradient(fadeStart, 0, end, 0);
            fade.addColorStop(0, color);
            fade.addColorStop(1, 'transparent');
            return fade;
        };
        ctx.fillStyle = outletPaint('rgba(2,10,22,.28)');
        ctx.fillRect(wall, top, end - wall, renderedHeight);
        if (view.pressure) {
            ctx.save();
            ctx.beginPath(); ctx.rect(wall, top, end - wall, renderedHeight); ctx.clip();
            for (let i = 0; i < pressureDelta.length; i++) {
                if (!samples.widths[i]) continue;
                const delta = pressureDelta[i];
                const color = delta >= 0 ? `rgba(255,143,65,${Math.min(.55, Math.abs(delta) * 1.05)})` :
                    `rgba(61,164,236,${Math.min(.5, Math.abs(delta) * 1.05)})`;
                const bandLeft = sx(samples.centers[i] - samples.widths[i] / 2);
                const bandWidth = samples.widths[i] * scale + .6;
                ctx.fillStyle = bandLeft + bandWidth > fadeStart ? outletPaint(color) : color;
                ctx.fillRect(bandLeft, top, bandWidth, renderedHeight);
            }
            ctx.restore();
        }
        const inletFadeWidth = Math.min(20, (end - pistonBack) * .04);
        const pistonPaint = ctx.createLinearGradient(pistonBack, 0, pistonBack + inletFadeWidth, 0);
        pistonPaint.addColorStop(0, 'transparent');
        pistonPaint.addColorStop(1, '#ff984f');
        ctx.fillStyle = pistonPaint;
        ctx.fillRect(pistonBack, top, wall - pistonBack, renderedHeight);
        const rail = ctx.createLinearGradient(pistonBack, 0, end, 0);
        rail.addColorStop(0, 'transparent');
        rail.addColorStop(inletFadeWidth / (end - pistonBack), '#60788e');
        rail.addColorStop((fadeStart - pistonBack) / (end - pistonBack), '#60788e');
        rail.addColorStop(1, 'transparent');
        line(pistonBack, top - 1, end, top - 1, rail, 1.5);
        line(pistonBack, bottom + 1, end, bottom + 1, rail, 1.5);
        for (const group of speedGroups) group.length = 0;
        for (const p of sim.particles) {
            const speed = view.speed ? Math.sqrt(p.vx * p.vx + p.vy * p.vy) : 0;
            const index = Math.min(palette.length - 1, Math.floor(speed / 320 * (palette.length - 1)));
            speedGroups[index].push(p);
        }
        speedGroups.forEach((group, i) => {
            if (!group.length) return;
            ctx.fillStyle = outletPaint(view.speed ? palette[i] : '#a9d6eb');
            ctx.beginPath();
            for (const p of group) {
                const x = sx(p.x), y = yy(p.y);
                ctx.moveTo(x + radius, y);
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
            }
            ctx.fill();
        });
        if (view.track && tracked && !tracked.exited) {
            ctx.strokeStyle = outletPaint('rgba(255,238,164,.7)'); ctx.lineWidth = 1.3;
            ctx.beginPath(); trail.forEach((p, i) => i ? ctx.lineTo(sx(p.x), yy(p.y)) : ctx.moveTo(sx(p.x), yy(p.y))); ctx.stroke();
            ctx.strokeStyle = outletPaint('#fff1a3'); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx(tracked.x), yy(tracked.y), radius + 4, 0, 2 * Math.PI); ctx.stroke();
        }

        const graphLeft = sx(0);
        const graphTop = bottom + graphGap;
        const mid = graphTop + graphHeight / 2;
        const gy = delta => mid - delta * (graphHeight / 2) / graphPressureHalfRange;
        for (let tick = 0; tick <= 4; tick++) {
            const y = graphTop + tick * graphHeight / 4;
            line(graphLeft, y, end, y, tick === 2 ? 'rgba(189,211,229,.4)' : 'rgba(137,167,194,.12)');
        }
        line(graphLeft, graphTop, graphLeft, graphTop + graphHeight, 'rgba(137,167,194,.35)');
        function plotSegment(x1, y1, x2, y2, positive) {
            ctx.fillStyle = positive ? 'rgba(255,152,79,.19)' : 'rgba(80,184,240,.19)';
            ctx.beginPath(); ctx.moveTo(x1, mid); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x2, mid); ctx.closePath(); ctx.fill();
            line(x1, y1, x2, y2, positive ? '#ff984f' : '#50b8f0', 2);
        }
        ctx.save();
        ctx.beginPath(); ctx.rect(graphLeft, graphTop, end - graphLeft, graphHeight); ctx.clip();
        for (let i = 0; i < pressureDelta.length - 1; i++) {
            if (!samples.widths[i] || !samples.widths[i + 1]) continue;
            const x1 = sx(samples.centers[i]), x2 = sx(samples.centers[i + 1]);
            const d1 = pressureDelta[i], d2 = pressureDelta[i + 1];
            const y1 = gy(d1), y2 = gy(d2);
            if (d1 * d2 < 0) {
                const crossing = x1 + (x2 - x1) * d1 / (d1 - d2);
                plotSegment(x1, y1, crossing, mid, d1 > 0);
                plotSegment(crossing, mid, x2, y2, d2 > 0);
            } else {
                plotSegment(x1, y1, x2, y2, d1 + d2 >= 0);
            }
        }
        ctx.restore();
        ctx.restore();
    }
    function resizeCanvas() {
        const bounds = viewport.getBoundingClientRect();
        width = bounds.width; height = bounds.height;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    }
    resizeCanvas();
    restart();
    new ResizeObserver(() => {
        const oldWidth = width, oldHeight = height;
        resizeCanvas();
        draw();
        if (width === oldWidth && height === oldHeight) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (width < 100 || height < 140) return;
            const { sceneWidth, chamberHeight } = chamberLayout();
            if (Math.abs(sceneWidth / chamberHeight - sim.width / sim.height) > .002) {
                restart();
                announce('Chamber reset.');
            }
        }, 180);
    }).observe(viewport);
    function animate(now) {
        requestAnimationFrame(animate);
        const dt = lastTime ? Math.min(.05, (now - lastTime) / 1000) : 0;
        lastTime = now;
        if (document.hidden) return;
        if (playing && !$('physicsDialog').open && !labControls.drawerOpen) {
            // Bound catch-up work so large particle counts remain interactive.
            accumulator = Math.min(1 / 30, accumulator + dt * basePlaybackRate * Number($('playbackRate').value));
            let elapsed = 0;
            const frameDeadline = performance.now() + 10;
            while (accumulator >= 1 / 120) {
                sim.step(1 / 120); accumulator -= 1 / 120; elapsed += 1 / 120;
                if (performance.now() >= frameDeadline) break;
            }
            if (elapsed) { sample(elapsed); draw(); }
            if (sim.time - lastReadout >= .1) updateReadout();
            reflectSource();
        } else if (lastReadout !== sim.time) {
            // A paused frame should report its exact energy, including pauses
            // caused by the controls drawer or physics notes.
            updateReadout();
        }
    }
    reflectPlayback();
    requestAnimationFrame(animate);
})();
