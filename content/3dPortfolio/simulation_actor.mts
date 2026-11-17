import * as THREE from 'three';

export interface SimulationActorSetupData {
    model: THREE.Object3D
}

export abstract class SimulationActor<TSimulationActorSetupData extends SimulationActorSetupData> {

    public readonly boudingBox: THREE.Box3 = new THREE.Box3()
    public name: string = ""

    constructor(
        public readonly setupData: TSimulationActorSetupData
    ) {
        setupData.model = setupData.model.clone(true)
        this.position.setY(-10)
    }

    abstract update(delta: DeltaTime): void;

    getUpdateboudingBox(): THREE.Box3 {
        this.boudingBox.setFromObject(this.setupData.model)
        return this.boudingBox
    }

    get position(): THREE.Vector3 {
        return this.setupData.model.position;
    }

    get quaternion(): THREE.Quaternion {
        return this.setupData.model.quaternion;
    }
    remove(context: RenderContext) {
        context.scene.remove(this.setupData.model)
    }
}