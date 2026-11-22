import * as THREE from 'three';

export interface ActorSpawnData {
    transform: THREE.Object3D,
    modelName: string,
    localBounds: THREE.Box3
}

export abstract class Actor<TSpawnData extends ActorSpawnData> {

    public readonly boudingBox: THREE.Box3 = new THREE.Box3()
    public name: string = ""

    constructor(
        public readonly spawnData: TSpawnData
    ) {
        this.position.setY(-10)
    }

    abstract update(delta: DeltaTime): void;

    getUpdateboudingBox(): THREE.Box3 {
        this.transform.updateMatrix()

        return this.boudingBox.copy(this.spawnData.localBounds).applyMatrix4(this.transform.matrix)
    }

    get transform() {
        return this.spawnData.transform
    }
    get position(): THREE.Vector3 {
        return this.transform.position;
    }

    get quaternion(): THREE.Quaternion {
        return this.transform.quaternion;
    }
    remove(context: RenderContext) {
        context.scene.remove(this.transform)
    }
}