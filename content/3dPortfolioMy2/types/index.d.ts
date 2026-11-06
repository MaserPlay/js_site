import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

declare global {
    interface RenderContext {
        readonly renderer: THREE.WebGLRenderer;
        readonly scene: THREE.Scene;
        readonly camera: THREE.PerspectiveCamera;
        readonly controls: OrbitControls;
        readonly sunlight: THREE.DirectionalLight;
        readonly sky: Sky;
    }

    interface ViewerSetupData {
        readonly canvasSelector: string;
        readonly initialCityPackUrl: string;
        readonly simulationSpeedMultiplerGetter: () => number
    }

    interface ViewerModule {
        setup(
            viewer: Viewer,
            data: ViewerSetupData
        ): void | Promise<void>;
    }

    type DeltaTime = number

    interface ViewerEventMap {
        loop: ViewerLoopEvent;
        resize: ViewerEvent;
    }

    interface UserData {
        readonly web_id: string
    }

    type ViewerEvents = keyof ViewerEventMap
}