import type { BarrierReason } from './mobility-types.js';

import type { WebGLRenderer } from 'three';
import type { MobilityView } from './mobility-view.mjs';
import { ui } from './viewer-ui.mjs';

/** Read-only diagnostics: it never advances the simulation or moves the camera. */
export async function createPerformancePanel(renderer: WebGLRenderer) {
    const context = ui.chart.getContext('2d')!;
    const samples: number[] = [];
    const gl = renderer.getContext();
    const gpuInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = gpuInfo ? String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL))
        : await __('City: GPU not reported by browser');
    const networkText = await __('City: Network: $1 directed edges · $2 of $3 moving');
    const statsText = await __('City: $1 draw calls · $2 triangles · $3');
    const vehicleText = await __('City: $1: $2 m/s · $3');
    const movingText = await __('City: moving');
    const waitingText = await __('City: waiting for a clear path');
    const reasons: Record<BarrierReason, string> = {
        queue: await __('City: queue'),
        'nearby-queue': await __('City: nearby vehicle'),
        'approach-occupied': await __('City: entrance occupied'),
        'turn-occupied': await __('City: turn occupied'),
        'exit-blocked': await __('City: no space beyond crossing'),
        'signal-red': await __('City: red'),
        'signal-amber': await __('City: amber'),
        'collision-risk': await __('City: collision risk')
    };
    let sampleStarted = performance.now();
    let frames = 0;

    ui.showFps.addEventListener('change', () => { ui.fpsValue.hidden = !ui.showFps.checked; });
    ui.showChart.addEventListener('change', () => { ui.chart.hidden = !ui.showChart.checked; });

    function drawChart(): void {
        context.clearRect(0, 0, ui.chart.width, ui.chart.height);
        context.strokeStyle = '#7fdda2';
        context.lineWidth = 2;
        context.beginPath();
        samples.forEach((fps, index) => {
            const x = index * ui.chart.width / 99;
            const y = ui.chart.height - Math.min(fps, 120) / 120 * (ui.chart.height - 4);
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        });
        context.stroke();
    }

    function updateTraffic(view: MobilityView): void {
        const active = view.simulation.actors.filter(actor => actor.active);
        const moving = active.filter(actor => actor.speed > .05).length;
        ui.mobilityStatus.textContent = formatString(networkText, view.data.edges.length, moving, active.length);
        ui.mobilityStatus.dataset.signals = JSON.stringify(view.data.signalGroups.map(group =>
            [group.id, view.simulation.aspect(group.id)]));
        if (!ui.trafficInspector.open) return;
        const snapshot = view.simulation.debugSnapshot();
        ui.trafficDebug.dataset.snapshot = JSON.stringify(snapshot);
        ui.trafficDebug.textContent = snapshot.actors
            .filter(actor => actor.active && view.data.actorAssets.find(asset => asset.id === actor.assetId)?.mode === 'vehicle')
            .map(actor => {
                const nearestLimit = actor.limits[0];
                const isMoving = actor.speed > 0.1;
                const isBlocked = !isMoving && nearestLimit && nearestLimit.distance <= 0.05;
                const reason = isMoving ? movingText : isBlocked ? reasons[nearestLimit.reason] : waitingText;
                const source = isBlocked ? ' → ' + nearestLimit.sourceId : '';
                return formatString(vehicleText, actor.id, actor.speed.toFixed(1), reason + source);
            })
            .join('\n');
    }

    return {
        reset(now = performance.now()): void {
            sampleStarted = now;
            frames = 0;
        },
        update(now: number, mobility: MobilityView | null): void {
            frames++;
            const elapsed = now - sampleStarted;
            if (elapsed < 500) return;
            const fps = Math.round(frames * 1000 / elapsed);
            ui.fpsValue.textContent = `FPS: ${fps}`;
            if (mobility) updateTraffic(mobility);
            ui.renderStats.textContent = formatString(statsText, renderer.info.render.calls,
                renderer.info.render.triangles.toLocaleString(getLocale()), gpu);
            samples.push(fps);
            if (samples.length > 100) samples.shift();
            drawChart();
            sampleStarted = now;
            frames = 0;
        }
    };
}
