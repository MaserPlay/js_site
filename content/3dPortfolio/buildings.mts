import * as THREE from 'three';

export class ProjectBuilding implements MouseInteractible {

    public readonly boudingBox: THREE.Box3 = new THREE.Box3()

    constructor(
        private readonly data: BuildingModel, 
        private readonly model: THREE.Group,
    ) {}
    get technical_name() {
        return this.data.technical_name === null ? undefined : this.data.technical_name
    }
    hideProject() {
        this.model.visible = false
    }
    showProjectAt(placement: BuildingPlacementData) {
        this.model.visible = true
        this.model.position.fromArray(placement.position)
        this.model.quaternion.fromArray(placement.quaternion)
        this.model.scale.fromArray(placement.scale)
        this.boudingBox.setFromObject(this.model)
    }
    addTo(to: THREE.Group) {
        to.add(this.model)
    }
    isHovered(ray: THREE.Ray): boolean {
        return ray.intersectsBox(this.boudingBox)
    }
    onClicked(ray: THREE.Ray): boolean {
        console.log(this.technical_name)
        return true
    }
}

export class ProjectsManager {
    constructor(
        public readonly placementData:BuildingPlacementsData,
        private readonly sContext: () => SceneContext
    ) {}
    setup() {
        for (let i = 0; i < Math.min(this.placementData.buildings.length, this.sContext().projectBuildings.length); i++) {
            const placement = this.placementData.buildings[i];
            const building = this.sContext().projectBuildings[i];

            if (!building.technical_name) {
                continue
            }

            building.showProjectAt(placement)
        }
    }
}