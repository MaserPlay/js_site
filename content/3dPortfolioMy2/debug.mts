import { Viewer, ViewerLoopEvent } from "./index.mjs";

const debug_fps_elem = $<HTMLElement>("#debug-fps")[0]!
const simulation_speed_elem = $<HTMLInputElement>("#simulation-speed")[0]!
const starting_vehicles_count_elem = $<HTMLInputElement>("#starting-vehicles-count")[0]!

let simulation_speed : number = 1

let starting_vehicles_count : number = 10

function setDeltaTime(delta:DeltaTime) {
    debug_fps_elem.textContent = ((1 / delta) * getSimulationSpeed()).toFixed(3);
}

export function setup(viewer:Viewer) {
    simulation_speed_elem.addEventListener("input", () => {
        const out = (simulation_speed_elem.nextElementSibling as HTMLOutputElement)
        out.value = simulation_speed_elem.value + '×'
        simulation_speed = Number(simulation_speed_elem.value)
    })
    starting_vehicles_count_elem.addEventListener("input", () => {
        localStorage.setItem("starting_vehicles_count", starting_vehicles_count_elem.value)
        location.reload()
    })
    viewer.addEventListener("loop", (e : ViewerLoopEvent) => setDeltaTime(e.delta))
    try {
        starting_vehicles_count = Number(localStorage.getItem("starting_vehicles_count")) ?? 
                                Number(starting_vehicles_count_elem.value)
    } finally {}

    (starting_vehicles_count_elem.nextElementSibling as HTMLOutputElement).value = String(starting_vehicles_count)
    starting_vehicles_count_elem.value = String(starting_vehicles_count)
}

export function getSimulationSpeed() {
    return simulation_speed
}

export function getStartingVehiclesCount() {
    return starting_vehicles_count
}