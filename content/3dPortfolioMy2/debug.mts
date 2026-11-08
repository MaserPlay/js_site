import { Viewer, ViewerLoopEvent } from "./index.mjs";

import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import * as THREE from 'three';
import { VehicleActor } from "./vehicle.mjs";

const elements = {
    debug_fps: $<HTMLElement>("#debug-fps")[0]!,
    simulation_speed: $<HTMLInputElement>("#simulation-speed")[0]!,
    starting_vehicles_count: $<HTMLInputElement>("#starting-vehicles-count")[0]!,
    starting_vehicles_count_out: $<HTMLOutputElement>("output[for=\"starting-vehicles-count\"]")[0]!
}

const debugContext = {
    simulation_speed: 1,
    starting_vehicles_count: 1,
    debugRenderer: new CSS2DRenderer(),
    textMarkPool: Array<CSS2DObject>(0) 
}

function setDeltaTime(delta:DeltaTime) {
    elements.debug_fps.textContent = ((1 / delta) * getSimulationSpeed()).toFixed(3);
}

export function getSimulationSpeed() {
    return debugContext.simulation_speed
}

export function getStartingVehiclesCount() {
    return debugContext.starting_vehicles_count
}

export function setup(viewer:Viewer) {
    const rContext = viewer.getContext()
    elements.simulation_speed.addEventListener("input", () => {
        const out = (elements.simulation_speed.nextElementSibling as HTMLOutputElement)
        out.value = elements.simulation_speed.value + '×'
        debugContext.simulation_speed = Number(elements.simulation_speed.value)
    })
    elements.starting_vehicles_count.addEventListener("input", () => {
        localStorage.setItem("starting_vehicles_count", elements.starting_vehicles_count.value)
        location.reload()
    })
    viewer.addEventListener("loop", (e : ViewerLoopEvent) => setDeltaTime(e.delta));

    debugContext.starting_vehicles_count = Number(localStorage.getItem("starting_vehicles_count")) ?? 
                                Number(elements.starting_vehicles_count.value)

    elements.starting_vehicles_count_out.value = String(debugContext.starting_vehicles_count)
    elements.starting_vehicles_count.value = String(debugContext.starting_vehicles_count)

    debugContext.textMarkPool = Array(debugContext.starting_vehicles_count).fill(() => {
        const css2dObj = new CSS2DObject(document.createElement('div'))
        css2dObj.element.className = 'badge bg-dark text-white';
        css2dObj.element.textContent = "text"
        css2dObj.element.style.whiteSpace = 'pre-line';
        return css2dObj
    }).map(f => f())

    const debugMarkGroup = new THREE.Group()
    debugMarkGroup.name = "debugGroup"
    debugMarkGroup.add(...debugContext.textMarkPool)
    rContext.scene.add(debugMarkGroup)

    Object.assign(debugContext.debugRenderer.domElement.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
    });

    debugContext.debugRenderer.setSize(window.innerWidth, window.innerHeight);
    document.body.append(debugContext.debugRenderer.domElement);

    viewer.addRenderer(debugContext.debugRenderer)
}

export function loop(delta: DeltaTime, sContext: SceneContext) {
    for (let i = 0; i < Math.min(debugContext.textMarkPool.length, sContext.actors.length); i++) {
        const markPos = debugContext.textMarkPool[i].position
        const actor : VehicleActor = sContext.actors[i]
        markPos.copy(actor.position)
        markPos.y += 3
        debugContext.textMarkPool[i].element.textContent = "name: " + actor.name + "\n"
        debugContext.textMarkPool[i].element.textContent += "followCar: " + actor.followCar?.name + "\n"
    }
}