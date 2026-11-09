import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

import * as NOTIFICATIONS from "./notification.mjs"
import * as DEBUG from "./debug.mjs"

const modules: Array<() => Promise<ViewerModule>> = [
    async () => await import('./debug.mjs'),
    async () => await import('./scene.mjs'),
    async () => await import('./camera.mjs'),
];

export class ViewerEvent extends Event {
    constructor(
        type: ViewerEvents
    ) {
        super(type);
    }
}

export class ViewerLoopEvent extends ViewerEvent {
    constructor(
        type: ViewerEvents,
        public readonly delta: DeltaTime
    ) {
        super(type);
    }
}

export interface Viewer {
    addEventListener<K extends keyof ViewerEventMap>(
        type: K,
        callback: (event: ViewerEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ): void;
}

export class Viewer extends EventTarget {
    private context!: RenderContext;
    private renders: Renderer[] = []

    constructor(setupData: ViewerSetupData) {
        super();
        (async () => {
            const canvas = document.querySelector(setupData.canvasSelector)!;

            if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
                throw new Error(`canvas not found: ${setupData.canvasSelector}`);
            }

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            const controls = new OrbitControls(camera, renderer.domElement);
            const sky = new Sky();

            const sunlight = new THREE.DirectionalLight("#ffffff");

            this.context = Object.freeze<RenderContext>({
                renderer,
                camera,
                scene,
                controls,
                sunlight,
                sky
            })
            const context = this.context!

            scene.add(sunlight)
            scene.add( sky );

            this.addRenderer(renderer);
            window.addEventListener('resize', async () => {
                this.dispatchEvent(new ViewerEvent("resize"))

                const width = window.innerWidth;
                const height = window.innerHeight;
                this.renders.forEach(r => r.setSize(window.innerWidth, window.innerHeight))

                context.camera.aspect = width / height;
                context.camera.updateProjectionMatrix();
            })

            for (const load of modules) {
                await load()
                    .then(module => module.setup(this, setupData))
                    .catch(NOTIFICATIONS.error);
            }

            const timer = new THREE.Timer();
            timer.connect(document);

            renderer.setAnimationLoop((time: DOMHighResTimeStamp, frame: XRFrame) => {
                timer.update(time);
                const realDelta = timer.getDelta()
                const modificatedDelta = setupData.simulationSpeedModificator(realDelta)
                context.sky.material.uniforms[ 'time' ].value += modificatedDelta;

                this.dispatchEvent(new ViewerLoopEvent(
                    "loop", 
                    modificatedDelta
                ))
                controls.update();
                this.renders.forEach(r => r.render(scene, camera));
            });
        })().catch(NOTIFICATIONS.error);
    }
    addRenderer(renderer: Renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
        this.renders.push(renderer)
    }
    getContext() {
        return this.context
    }
}

NOTIFICATIONS.addExecptionListeners()
export const viewer = new Viewer({
    canvasSelector: "#canvas", 
    initialCityPackUrl: "/content/3dPortfolioMy2/exports/actors-runtime-candidate-v07",
    simulationSpeedModificator: DEBUG.modificateDelta,
    startingVehiclesCountGetter: DEBUG.getStartingVehiclesCount
})