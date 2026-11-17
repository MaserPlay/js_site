import { Viewer } from "./index.mjs";

import * as THREE from 'three';

const constrainedTarget = new THREE.Vector3();
const correction = new THREE.Vector3();

const allowedArea = new THREE.Box3(
    new THREE.Vector3(-12, 2, -110),
    new THREE.Vector3(12, 2, -20)
);

function constrainPan(context: RenderContext) {
    allowedArea.clampPoint(context.controls.target, constrainedTarget);

    correction.subVectors(constrainedTarget, context.controls.target);

    context.controls.target.copy(constrainedTarget);
    context.camera.position.add(correction);
}

export function setup(viewer:Viewer) {

    const context = viewer.getContext()

    context.controls.addEventListener('change', () => constrainPan(context));
    constrainPan(context);
}