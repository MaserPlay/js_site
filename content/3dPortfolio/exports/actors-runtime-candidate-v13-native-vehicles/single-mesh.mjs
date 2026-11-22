import { BufferAttribute, Matrix4, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function defaultAttribute(template, count, key) {
    const array = new template.array.constructor(count * template.itemSize);
    if (key === 'color') array.fill(1);
    return new BufferAttribute(array, template.itemSize, template.normalized);
}

export function toSingleMesh(root) {
    const parts = root.children.filter((part) => part.isMesh);
    const supported = new Set(root.isMesh ? [root] : parts);
    root.traverse((node) => {
        if (node.isMesh && (!supported.has(node) || node.isSkinnedMesh)) {
            throw new Error(`Expected a flattened static model: ${root.name}`);
        }
    });
    if (root.isMesh) return root;
    if (!parts.length) throw new Error(`No direct geometry for ${root.name}`);
    const identity = new Matrix4();
    for (const part of parts) {
        if (part.matrixAutoUpdate) part.updateMatrix();
        if (!part.matrix.equals(identity) || part.children.length) {
            throw new Error(`Expected an untransformed primitive: ${part.name}`);
        }
    }
    const sources = parts.map(({ geometry }) => geometry);
    const indexed = sources.every(({ index }) => index !== null);
    const geometries = sources.map((geo) => !indexed && geo.index ? geo.toNonIndexed() : geo.clone());
    const attributes = new Map();
    for (const geometry of geometries) {
        for (const [name, value] of Object.entries(geometry.attributes)) attributes.set(name, value);
    }
    for (const geometry of geometries) {
        for (const [name, template] of attributes) {
            if (!geometry.hasAttribute(name)) {
                geometry.setAttribute(name, defaultAttribute(template, geometry.attributes.position.count, name));
            }
        }
    }
    const merged = mergeGeometries(geometries, true);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) throw new Error(`Cannot merge geometry for ${root.name}`);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const model = new Mesh(merged, parts.map(({ material }) => material));
    model.name = root.name;
    model.userData = {
        ...root.userData,
        primitiveSourceNodes: parts.map(({ geometry }) => geometry.userData.sourceNode ?? null),
    };
    model.up.copy(root.up);
    model.position.copy(root.position);
    model.quaternion.copy(root.quaternion);
    model.scale.copy(root.scale);
    model.visible = root.visible;
    model.layers.mask = root.layers.mask;
    if (parts[0].morphTargetDictionary) {
        model.morphTargetDictionary = { ...parts[0].morphTargetDictionary };
        model.morphTargetInfluences = [...parts[0].morphTargetInfluences];
    }
    for (const marker of [...root.children]) {
        if (!marker.isMesh) model.add(marker);
    }
    if (root.parent) {
        const parent = root.parent;
        root.removeFromParent();
        parent.add(model);
    }
    return model;
}

export function singleMeshModels(gltf, role) {
    return gltf.scene.children.filter((node) => node.userData.web_role === role).map(toSingleMesh);
}

export function sourceNodeForHit({ object, faceIndex }) {
    const sources = object.userData.primitiveSourceNodes;
    if (!sources || faceIndex == null) return null;
    const index = faceIndex * 3;
    const group = object.geometry.groups.find(({ start, count }) => start <= index && index < start + count);
    return group ? sources[group.materialIndex] : null;
}
