import { Box3, LinearSRGBColorSpace, Material, Mesh, MeshStandardMaterial, Object3D,
    PropertyBinding, ShaderChunk, TextureLoader, Vector3, type Texture } from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type StreetBakeManifest = {
    source_sha256: string; source_node: string; baked_node: string;
    receiver_url: string; lightmap_url: string; uv_index_gltf: number;
    encoding_scale: number; lamps: number[][];
    target_materials?: string[];
};

export function makeBakedRoadMaterial(source: MeshStandardMaterial, lightmap: Texture): MeshStandardMaterial {
    const material = source.clone();
    material.lightMap = lightmap;
    material.lightMapIntensity = 0;
    const baseCompile = source.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        baseCompile.call(material, shader, renderer);
        shader.vertexShader = 'varying float vBakedStreetUp;\n' + shader.vertexShader.replace(
            '#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvBakedStreetUp = smoothstep(0.25, 0.8, objectNormal.y);');
        shader.fragmentShader = 'varying float vBakedStreetUp;\n' + shader.fragmentShader.replace(
            '#include <lights_fragment_maps>', ShaderChunk.lights_fragment_maps.replace(
                'irradiance += lightMapIrradiance;',
                `float streetAtlasMask = step(0.0, vLightMapUv.x) * step(vLightMapUv.x, 1.0)
                    * step(0.0, vLightMapUv.y) * step(vLightMapUv.y, 1.0);
                irradiance += lightMapIrradiance * streetAtlasMask * vBakedStreetUp;`));
    };
    material.customProgramCacheKey = () => `${source.customProgramCacheKey()}:street_lightmap_clip_v1`;
    return material;
}

/** Static road lighting exported from Blender; moving actors keep normal materials. */
export class BakedStreetLayer {
    enabled = false;
    private constructor(readonly original: Object3D, readonly root: Object3D,
        readonly materials: MeshStandardMaterial[], readonly lamps: Vector3[], readonly intensityScale: number) {}

    static async load(loader: GLTFLoader, city: Object3D, manifestUrl: string, expectedHash: string): Promise<BakedStreetLayer> {
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error('Не загружено описание запечённого света');
        const data = await response.json() as StreetBakeManifest;
        if (data.source_sha256 !== expectedHash || data.uv_index_gltf !== 1 || !Number.isFinite(data.encoding_scale) || data.encoding_scale <= 0) {
            throw new Error('Карта света не соответствует городу');
        }
        const original = city.getObjectByName(PropertyBinding.sanitizeNodeName(data.source_node));
        if (!original) throw new Error('Не найдена исходная дорога');
        const sourceMaterials = new Map<string, Material>();
        const materialName = (name: string): string => name.replace(/\.\d+$/, '');
        original.traverse(object => {
            if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                sourceMaterials.set(material.name, material);
                sourceMaterials.set(materialName(material.name), material);
            }
        });
        const [replacement, lightmap] = await Promise.all([
            loader.loadAsync(data.receiver_url), new TextureLoader().loadAsync(data.lightmap_url)
        ]);
        if (!replacement.scene.getObjectByName(PropertyBinding.sanitizeNodeName(data.baked_node))) {
            throw new Error('Неверный приёмник карты света');
        }
        lightmap.flipY = false;
        lightmap.channel = 1;
        lightmap.colorSpace = LinearSRGBColorSpace;
        const mapped = new Map<Material, MeshStandardMaterial>();
        const targets = new Set((data.target_materials || []).map(materialName));
        replacement.scene.traverse(object => {
            if (!(object instanceof Mesh)) return;
            const assign = (imported: Material): Material => {
                const source = sourceMaterials.get(imported.name) || sourceMaterials.get(materialName(imported.name));
                if (!source) throw new Error(`Материал дороги не найден: ${imported.name}`);
                if (targets.size ? !targets.has(materialName(source.name)) : !/(road_asphalt|road_sidewalk)$/.test(materialName(source.name))) return source;
                if (!(source instanceof MeshStandardMaterial) || !object.geometry.getAttribute('uv1')) {
                    throw new Error('Нет светового UV-канала дороги');
                }
                let material = mapped.get(source);
                if (material) return material;
                material = makeBakedRoadMaterial(source, lightmap);
                mapped.set(source, material);
                return material;
            };
            object.material = Array.isArray(object.material) ? object.material.map(assign) : assign(object.material);
            object.updateMatrix();
            object.matrixAutoUpdate = false;
        });
        if (mapped.size < (targets.size || 2)) throw new Error('Не все поверхности дороги получили карту света');
        // Receiver geometry/UV0 were independently compared with the source in Blender.
        const originalBounds = new Box3().setFromObject(original);
        const replacementBounds = new Box3().setFromObject(replacement.scene);
        if (originalBounds.min.distanceTo(replacementBounds.min) > 0.01 || originalBounds.max.distanceTo(replacementBounds.max) > 0.01) {
            throw new Error('Изменились габариты дороги при замене');
        }
        replacement.scene.visible = false;
        city.add(replacement.scene);
        return new BakedStreetLayer(original, replacement.scene, [...mapped.values()],
            data.lamps.map(position => new Vector3().fromArray(position)), data.encoding_scale * Math.PI * 4);
    }
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.original.visible = !enabled;
        this.root.visible = enabled;
    }
    setIntensity(multiplier: number): void {
        this.materials.forEach(material => { material.lightMapIntensity = this.intensityScale * multiplier; });
    }
    containsLamp(position: Vector3): boolean {
        return this.lamps.some(lamp => lamp.distanceToSquared(position) < 0.75 * 0.75);
    }
}
