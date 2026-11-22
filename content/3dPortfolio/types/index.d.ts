import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

declare global {
    interface RenderContext {
        readonly scene: THREE.Scene;
        readonly camera: THREE.PerspectiveCamera;
        readonly controls: OrbitControls;
        readonly sunlight: THREE.DirectionalLight;
        readonly sky: Sky;
    }

    interface Renderer {
        setSize(width: number, height: number): void;
        render(scene: THREE.Scene, camera: THREE.Camera): void;
    }

    interface ViewerSetupData {
        readonly canvasSelector: string;
        readonly initialCityPackUrl: string;
        readonly startingVehiclesCountGetter: () => number
        readonly simulationSpeedModificator: (DeltaTime) => DeltaTime
    }

    interface ViewerModule {
        setup(
            viewer: Viewer,
            data: ViewerSetupData
        ): void | Promise<void>;
    }


    interface ViewerEventMap {
        loop: ViewerLoopEvent;
        resize: ViewerEvent;
    }

    interface UserData {
        readonly web_id: string
    }

    interface MouseInteractible {
        isHovered(ray: THREE.Ray): boolean;
        onClicked(ray: THREE.Ray): boolean;
    }
    
    type DeltaTime = number

    type ViewerEvents = keyof ViewerEventMap
    
    type PossibleVector3 = [number, number, number];
    type PossibleVector4 = [number, number, number, number];
    type PossibleQuaternion = PossibleVector4;
    
    type PossibleZAxisSide = "+Z" | "-Z";
    type PossibleYAxisSide = "+Y" | "-Y";
    type PossibleXAxisSide = "+X" | "-X";

    type Possible2DAxisSide = PossibleZAxisSide | PossibleXAxisSide
    type PossibleAxisSide = Possible2DAxisSide | PossibleYAxisSide
    
    type CoordinateUnits = "metres";
}