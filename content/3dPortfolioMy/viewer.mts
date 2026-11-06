import type { SignalTimingOverrides } from './mobility-types.js';
import { createProjectPanel } from './project-panel.mjs';
import { createPerformancePanel } from './performance-panel.mjs';
import { notifications } from './notifications.mjs';
import { preloadTranslations } from './viewer-i18n.mjs';
import { ui } from './viewer-ui.mjs';
import { warmInteriors, refreshInteriorShadows } from './warm-interiors.mjs';
import { EntryProfiler } from './entry-profiler.mjs';
import { MobilityView } from './mobility-view.mjs';
import { pedestrianOffset } from './mobility.mjs';
import { loadCityPackage, streetPose, type CityDescription, type ProjectPoint } from './city-package.mjs';
import { CameraPath, entryPoints } from './camera-route.mjs';
import { NatureMaterials } from './nature-materials.mjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { BakedStreetLayer } from './street-lighting.mjs';

const CITY_MANIFEST_URL = '/content/3dPortfolioMy/exports/full-native-mobility-v1-02/manifest.json';
const PROJECTS_API_URL = 'https://maserplay.ru/api/projects.json';

// Тайминги сайта по ID перекрёстков, в секундах. Неуказанные поля берутся из DEFAULT_SIGNAL_TIMINGS.
const SIGNAL_TIMINGS: SignalTimingOverrides = {
    'junction.avenue.crossing.24': {
        vehicleGreen: 14,
        pedestrianGreen: 8,
        amber: 3,
        clearance: 1
    },
    'junction.avenue.crossing.76': {
        vehicleGreen: 14,
        pedestrianGreen: 8,
        amber: 3,
        clearance: 1
    }
};

async function startViewer(): Promise<void> {
    await preloadTranslations();
    // Сцена и состояние просмотра.
    const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true });
    // Объекты и точки проектов: ID → геометрия / метаданные Blender.
    const projects = new Map<string, THREE.Object3D>();
    const navigation = new Map<string, ProjectPoint & { box: THREE.Box3 }>();
    const behaviors = new Map<string, (pointId: string) => void>();
    behaviors.set('enter-project', pointId => {
        const object = projects.get(pointId);
        if (object) void enterProject(object);
    });
    function activatePoint(pointId: string): void {
        const point = navigation.get(pointId);
        if (point && projectPanel.placements.has(pointId)) behaviors.get(point.behavior)?.(pointId);
    }
    const pointObjectIds = new WeakMap<THREE.Object3D, string>();
    let description: CityDescription;
    let materialSourceHash = '';
    let lastInteriorProject: THREE.Object3D | null = null;
    const entryProfiler = new EntryProfiler(document.querySelector<HTMLElement>('#entry-performance'));
    const natureMaterials = new NatureMaterials();
    let city: THREE.Object3D | null = null;
    let cityReady = false;
    let warmingInteriors = false;
    let preparingEntry = false;
    let bakedStreet: BakedStreetLayer | null = null;
    let dynamicLampCount = 24;
    let citySpan = 1000;
    // Свет и материалы.
    const glowingMaterials = new Map<THREE.MeshStandardMaterial, number>();
    const displayMaterials = new Map<THREE.Material, THREE.MeshBasicMaterial>();
    const lampPositions: THREE.Vector3[] = [];
    const lampTargets: THREE.Vector3[] = [];
    const streetLights: THREE.SpotLight[] = [];
    const headlights: THREE.SpotLight[] = [];
    const trafficVehicles: { object: THREE.Object3D; headlight: THREE.SpotLight }[] = [];
    const interiorLights: THREE.PointLight[] = [];
    let activeInteriorProject: THREE.Object3D | null = null;
    // Подготовленные модели: инстансы, LOD и анимации.
    const vegetationBatches: { batch: THREE.InstancedMesh; originals: THREE.Mesh[] }[] = [];
    const peopleLods: { high: THREE.Object3D; medium: THREE.Object3D; far: THREE.Object3D }[] = [];
    const peopleSourceMeshes = new Map<THREE.Object3D, number>();
    const animatedWalkers: {
        source: THREE.Object3D; phase: number; root: THREE.Object3D;
        mixer: THREE.AnimationMixer; levels: THREE.Object3D[]
    }[] = [];
    const actorFrustum = new THREE.Frustum();
    const actorViewProjection = new THREE.Matrix4();
    const actorBounds = new THREE.Sphere(new THREE.Vector3(), 1.5);
    let lastLightUpdate = 0;
    // Положение камеры и текущий вход/выход.
    let flight: {
        points: THREE.Vector3[]; path: CameraPath; look: THREE.Vector3; lookStart: THREE.Vector3;
        elapsed: number; duration: number; returning: boolean
    } | null = null;
    let returnPath: THREE.Vector3[] | null = null;
    const savedTarget = new THREE.Vector3();
    let activeProjectName = '';
    const raycaster = new THREE.Raycaster();
    let pointerStart: { x: number; y: number } | null = null;
    // Транспорт: новая сеть или совместимость со старым экспортом.
    const cars: { object: THREE.Object3D; startZ: number; direction: number }[] = [];
    const walkers: { object: THREE.Object3D; baseX: number; startZ: number; baseY: number; direction: number; phase: number }[] = [];
    let movementTime = 0;
    let mobilityView: MobilityView | null = null;
    const projectPanel = await createProjectPanel({
        apiUrl: PROJECTS_API_URL,
        canEnter: () => cityReady && !flight && !returnPath,
        onVisit: activatePoint
    });
    const performancePanel = await createPerformancePanel(renderer);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, Number(ui.quality.value)));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Камера и управление мышью, клавиатурой и касаниями.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c12);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
    const controls = new OrbitControls(camera, ui.canvas);
    // Уличная камера едет по оси улицы. Свободной орбиты и бокового панорамирования нет.
    controls.enableRotate = controls.enablePan = controls.enableZoom = false;
    controls.enableDamping = false;
    let railStart = -18.8;
    let railEnd = -106.75;
    let railFocus = railStart;
    let railDistance = 32;
    let interiorYaw = 0;
    let interiorPitch = 0;
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const textM = await __("City: $1 · $2 m");
    const textStreet = await __("City: Street: $1%");
    const textEndOfStreet = await __("City: End of street");
    const textStartOfStreet = await __("City: Start of street");

    function updateStreetCamera(): void {
        railFocus = THREE.MathUtils.clamp(railFocus, railEnd, railStart);
        railDistance = THREE.MathUtils.clamp(railDistance, description?.camera.street.minDistance ?? 14, description?.camera.street.maxDistance ?? 36);
        const street = description?.camera.street;
        controls.target.set(0, street?.targetHeight ?? 2.5, railFocus);
        if (street) camera.position.copy(streetPose(street, railFocus, railDistance));
        else camera.position.set(0, 2.5 + railDistance * 0.5, railFocus + railDistance * Math.sqrt(0.75));
        camera.lookAt(controls.target);
        const percent = (railFocus - railStart) / (railEnd - railStart) * 100;
        ui.streetPosition.value = String(percent);
        ui.streetPositionValue.textContent = formatString(textM, percent < 0.5 ? textStartOfStreet : percent > 99.5 ? textEndOfStreet : formatString(textStreet, Math.round(percent)), Math.round(railDistance));
    }
    function updateInteriorLook(): void {
        interiorPitch = THREE.MathUtils.clamp(interiorPitch, -Math.PI * 0.4, Math.PI * 0.4);
        const direction = new THREE.Vector3(Math.sin(interiorYaw) * Math.cos(interiorPitch),
            Math.sin(interiorPitch), -Math.cos(interiorYaw) * Math.cos(interiorPitch));
        controls.target.copy(camera.position).addScaledVector(direction, 4);
        camera.lookAt(controls.target);
    }
    const releasePointer = (event: PointerEvent): void => { activePointers.delete(event.pointerId); pinchDistance = 0; };
    const overviewPosition = new THREE.Vector3();
    const overviewTarget = new THREE.Vector3();
    function stopFollowingWalker(): void {
        if (!ui.followWalker.checked) return;
        ui.followWalker.checked = false;
        camera.position.copy(overviewPosition);
        controls.target.copy(overviewTarget);
        controls.enabled = true;
        controls.update();
    }
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    // Освещение настраивается здесь: Blender не переносит его в GLB.
    // Освещение и настройки графики.
    const ambient = new THREE.HemisphereLight(0xa9b7cf, 0x303843, 0.28);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xc8d6ee, 0.18);
    sun.position.set(100, 200, 150);
    sun.castShadow = true;
    const shadowResolution = Math.min(4096, renderer.capabilities.maxTextureSize);
    sun.shadow.mapSize.set(shadowResolution, shadowResolution);
    sun.shadow.bias = -0.0002;
    sun.shadow.autoUpdate = false;
    scene.add(sun);
    scene.add(sun.target);
    for (let i = 0;i < 4;i++) {
        const light = new THREE.PointLight(0xffefdc, 55, 15, 2);
        light.visible = false;
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.bias = -0.0001;
        light.shadow.normalBias = 0.015;
        light.shadow.autoUpdate = false;
        scene.add(light);
        interiorLights.push(light);
    }

    function updateFog(): void {
        const distance = Number(ui.fogDistance.value);
        const night = ui.timeOfDay.value === 'night';
        const color = night ? 0x080c12 : 0xc9d1d3;
        const near = (night ? 22 : 28) * distance;
        const far = (night ? 135 : 160) * distance;
        scene.fog = ui.fogEnabled.checked ? new THREE.Fog(color, near, far) : null;
        // Полностью скрытые дымкой здания не нужно отправлять на отрисовку.
        camera.far = ui.fogEnabled.checked ? far + 10 : Math.min(citySpan * 2, 600);
        camera.updateProjectionMatrix();
    }
    function updateGlow(): void {
        const factor = ui.timeOfDay.value === 'night' ? Number(ui.glowStrength.value) : 1;
        glowingMaterials.forEach((originalIntensity, material) => {
            material.emissiveIntensity = originalIntensity * factor;
        });
        streetLights.forEach((light, index) => {
            light.visible = index < dynamicLampCount && ui.timeOfDay.value === 'night' && factor > 0 && Number(ui.streetBrightness.value) > 0;
            light.intensity = 160 * factor / 2.5 * Number(ui.streetBrightness.value);
        });
        headlights.forEach(light => { light.visible = ui.timeOfDay.value === 'night' && ui.headlightsEnabled.checked && Boolean(light.parent?.visible); });
        bakedStreet?.setIntensity(ui.timeOfDay.value === 'night' && ui.bakedStreetEnabled.checked ? factor / 2.5 * Number(ui.streetBrightness.value) : 0);
        lastLightUpdate = 0;
    }
    const textProjectStreetLightmapAdditionalLights = await __("City: Project street lightmap · 4 additional lights");
    const textDynamicStreetLighting = await __("City: Dynamic street lighting");

    function updateBakedStreetMode(): void {
        if (!bakedStreet) return;
        bakedStreet.setEnabled(ui.bakedStreetEnabled.checked);
        dynamicLampCount = ui.bakedStreetEnabled.checked ? 4 : 24;
        ui.bakedStreetStatus.textContent = ui.bakedStreetEnabled.checked ? textProjectStreetLightmapAdditionalLights : textDynamicStreetLighting;
        sun.shadow.needsUpdate = true;
        updateGlow();
    }
    async function loadBakedStreet(root: THREE.Object3D): Promise<void> {
        try {
            const module = await import('./street-lighting.mjs') as typeof import('./street-lighting.mjs');
            bakedStreet = await module.BakedStreetLayer.load(loader, root, '/content/3dPortfolioMy/baked-street-v02/manifest.json',
                materialSourceHash);
            updateBakedStreetMode();
        } catch (error) {
            ui.bakedStreetEnabled.checked = false;
            ui.bakedStreetStatus.textContent = await __("City: Dynamic street lighting");
            notifications.warning(await __("City: Lightmap unavailable · dynamic lighting"), error);
            updateGlow();
        }
    }
    const textOfVehicles = await __("City: $1% · $2 of $3 vehicles");

    function updateTrafficDensity(): void {
        const fraction = Number(ui.trafficDensity.value) / 100;
        if (mobilityView) {
            const count = mobilityView.setVehicleDensity(fraction);
            mobilityView.update(0);
            const total = mobilityView.simulation.actors.filter(actor => actor.asset.mode !== 'pedestrian').length;
            ui.trafficDensityValue.textContent = formatString(textOfVehicles, ui.trafficDensity.value, count, total);
            updateGlow();
            return;
        }
        const count = Math.round(trafficVehicles.length * fraction);
        const selected = new Set(Array.from({ length: count }, (_, index) => Math.floor(index * trafficVehicles.length / count)));
        trafficVehicles.forEach(({ object }, index) => { object.visible = selected.has(index); });
        ui.trafficDensityValue.textContent = formatString(textOfVehicles, ui.trafficDensity.value, count, trafficVehicles.length);
        updateGlow();
    }
    function updateInteriorLights(): void {
        interiorLights.forEach(light => {
            light.visible = Boolean(activeInteriorProject) && ui.interiorLighting.checked && Number(ui.interiorBrightness.value) > 0;
            light.intensity = Number(ui.interiorBrightness.value);
        });
    }
    function updateShadows(): void {
        renderer.shadowMap.enabled = ui.shadows.checked;
        sun.shadow.needsUpdate = true;
        interiorLights.forEach(light => { light.shadow.needsUpdate = true; });
        city?.traverse(object => {
            if (object instanceof THREE.Mesh) {
                let dynamic = false;
                for (let ancestor: THREE.Object3D | null = object;ancestor && ancestor !== city;ancestor = ancestor.parent) {
                    if (ancestor.userData.webDynamic) { dynamic = true; break; }
                }
                // Кэш содержит только неподвижную геометрию, без застывших силуэтов транспорта и прохожих.
                object.castShadow = ui.shadows.checked && !dynamic;
                object.receiveShadow = ui.shadows.checked;
            }
        });
    }
    function updateVegetationInstancing(): void {
        vegetationBatches.forEach(({ batch, originals }) => {
            batch.visible = ui.vegetationInstancing.checked;
            originals.forEach(object => { object.visible = !ui.vegetationInstancing.checked; });
        });
        sun.shadow.needsUpdate = true;
    }

    function resize(): void {
        const width = ui.canvas.clientWidth;
        const height = ui.canvas.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    resize();
    camera.position.set(100, 100, 150);
    controls.update();

    // Подготовка геометрии, материалов и моделей людей.
    function addStreetLighting(root: THREE.Object3D): void {
        // Собираем положения линз из экспортированной геометрии фонарей.
        const lamps = new Map<string, { sum: THREE.Vector3; count: number }>();
        const point = new THREE.Vector3();
        root.updateWorldMatrix(true, true);
        root.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            if (!materials.some(material => material.name.toLowerCase().includes('road_lamp_lens'))) return;
            const positions = object.geometry.getAttribute('position');
            if (!positions) return;
            for (let i = 0;i < positions.count;i++) {
                point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                const key = `${Math.round(point.x)},${Math.round(point.y)},${Math.round(point.z)}`;
                let lamp = lamps.get(key);
                if (!lamp) { lamp = { sum: new THREE.Vector3(), count: 0 }; lamps.set(key, lamp); }
                lamp.sum.add(point);
                lamp.count++;
            }
        });
        if (!lamps.size) return;
        lamps.forEach(lamp => {
            lamp.sum.multiplyScalar(1 / lamp.count);
            if (!lampPositions.some(position => position.distanceToSquared(lamp.sum) < 0.49)) {
                lampPositions.push(lamp.sum.clone());
            }
        });
        lampPositions.forEach(position => {
            let other: THREE.Vector3 | null = null;
            let best = 196;
            lampPositions.forEach(candidate => {
                if (Math.abs(candidate.y - position.y) > 0.75) return;
                const distance = (candidate.x - position.x) ** 2 + (candidate.z - position.z) ** 2;
                if (distance > 16 && distance < best) { best = distance; other = candidate; }
            });
            const target = other ? position.clone().lerp(other as THREE.Vector3, 0.5) : position.clone();
            target.y = position.y - 6;
            lampTargets.push(target);
        });
        // Освещаем видимую часть города настоящими источниками, а не плоскими пятнами.
        // Тени от каждого фонаря пока отключены: источники переиспользуются при движении камеры.
        for (let i = 0;i < Math.min(24, lampPositions.length);i++) {
            const light = new THREE.SpotLight(0xffe1bf, 160, 28, Math.PI / 3, 0.55, 2);
            light.position.copy(lampPositions[i]).y -= 0.25;
            const target = new THREE.Object3D();
            target.position.copy(lampTargets[i]);
            scene.add(target);
            light.target = target;
            scene.add(light);
            streetLights.push(light);
        }
        console.info(`Источники уличного света: ${lamps.size}`);
        updateGlow();
    }

    function instanceStaticEnvironment(root: THREE.Object3D): void {
        // Только точные копии геометрии/материала. Выбор проектов использует готовые AABB,
        // поэтому их неподвижные детали тоже можно группировать без дорогого picking по мешам.
        const receiverName = THREE.PropertyBinding.sanitizeNodeName('Portfolio avenue • generated static road');
        const groups = new Map<string, THREE.Mesh[]>();
        root.updateWorldMatrix(true, true);
        root.traverse(object => {
            if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh || Array.isArray(object.material)) return;
            if (!object.visible || object.material.transparent || object.morphTargetInfluences?.length || object.matrixWorld.determinant() <= 0) return;
            let ancestor: THREE.Object3D | null = object;
            while (ancestor && ancestor !== root) {
                if (ancestor.userData.webDynamic || ancestor.userData.webBakeReceiver || ancestor.name === receiverName || /^(traffic|citizen|rider|ride|lift)/i.test(ancestor.name)) return;
                ancestor = ancestor.parent;
            }
            const position = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
            const cell = `${Math.floor(position.x / 32)},${Math.floor(position.z / 32)}`;
            const key = `${object.geometry.uuid}:${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${object.layers.mask}:${object.renderOrder}:${cell}`;
            const group = groups.get(key) || [];
            group.push(object);
            groups.set(key, group);
        });
        const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
        let total = 0;
        groups.forEach(objects => {
            if (objects.length < 3) return;
            const first = objects[0];
            const batch = new THREE.InstancedMesh(first.geometry, first.material, objects.length);
            batch.name = `instanced_static_${vegetationBatches.length}`;
            batch.castShadow = first.castShadow;
            batch.receiveShadow = first.receiveShadow;
            batch.layers.mask = first.layers.mask;
            batch.renderOrder = first.renderOrder;
            objects.forEach((object, index) => {
                batch.setMatrixAt(index, new THREE.Matrix4().multiplyMatrices(rootInverse, object.matrixWorld));
            });
            batch.instanceMatrix.needsUpdate = true;
            batch.computeBoundingSphere();
            root.add(batch);
            vegetationBatches.push({ batch, originals: objects });
            total += objects.length;
        });
        updateVegetationInstancing();
        console.info(`Инстансинг: ${total} объектов в ${vegetationBatches.length} группах`);
    }

    async function loadPeopleLods(root: THREE.Object3D, people: THREE.Object3D[]): Promise<void> {
        const [data, response] = await Promise.all([
            loader.loadAsync('/content/3dPortfolioMy/people-lod.glb'),
            fetch('/content/3dPortfolioMy/data/people-lod-map.json')
        ]);
        if (!response.ok) throw new Error(await __("City: Failed to load the LOD map"));
        const mapping = await response.json() as { nodes: Record<string, number> };
        const templates = new Map<string, THREE.Object3D>();
        data.scene.traverse(object => {
            if (object.userData.lod_level) templates.set(`${object.userData.lod_source_mesh}:${object.userData.lod_level}`, object);
        });
        people.forEach(high => {
            const id = high.name.match(/Citizen.v11.*?(\d{3})/i)?.[1];
            const source = id ? mapping.nodes[id] : undefined;
            if (source !== undefined) peopleSourceMeshes.set(high, source);
            const mediumTemplate = templates.get(`${source}:medium`);
            const farTemplate = templates.get(`${source}:far`);
            if (!mediumTemplate || !farTemplate) return;
            const medium = mediumTemplate.clone(true);
            const far = farTemplate.clone(true);
            for (const level of [medium, far]) {
                level.matrixAutoUpdate = false;
                level.visible = false;
                root.add(level);
            }
            peopleLods.push({ high, medium, far });
        });
        updateShadows();
        console.info(`LOD людей: ${peopleLods.length}`);
    }

    const peopleRigBasis = new THREE.Matrix4();
    async function loadAnimatedWalkers(root: THREE.Object3D): Promise<void> {
        const data = await loader.loadAsync('/content/3dPortfolioMy/people-walk-v08-idle.glb');
        let rig: THREE.Object3D | undefined;
        data.scene.traverse(object => {
            if (object.userData.city_people_rig_schema === 1) rig = object;
        });
        const walk = data.animations.find(clip => clip.name === 'Walk');
        if (!rig || !walk) throw new Error(await __("City: GLB is missing CityPeopleRig or the Walk clip"));
        const forward = rig.userData.web_forward_axis || rig.userData.forward_gltf;
        if (forward === '+Z') peopleRigBasis.makeRotationY(Math.PI);
        else if (forward === '-Z') peopleRigBasis.identity();
        else throw new Error(await __("City: Unsupported walking model basis"));
        for (const person of walkers) {
            const source = peopleSourceMeshes.get(person.object);
            // Кости — соседи мешей, поэтому клонируется весь корень арматуры.
            const instance = cloneSkeleton(rig);
            instance.userData.webDynamic = true;
            const variants = new Map<string, THREE.Object3D>();
            const unused: THREE.Object3D[] = [];
            instance.traverse(object => {
                if (object.userData.people_source_mesh === undefined) return;
                if (Number(object.userData.people_source_mesh) === source) variants.set(object.userData.lod_level, object);
                else unused.push(object);
            });
            unused.forEach(object => object.removeFromParent());
            const high = variants.get('high');
            if (!high) throw new Error(formatString(await __("City: Missing full walking model $1"), String(source)));
            const levels = ['high', 'medium', 'far'].map(level => {
                // Если LOD не прошли визуальную проверку, сохраняем целую полную модель.
                const model = variants.get(level) || high;
                model.visible = false;
                return model;
            });
            const mixer = new THREE.AnimationMixer(instance);
            mixer.clipAction(walk).play();
            instance.matrixAutoUpdate = false;
            instance.traverse(object => {
                if (object instanceof THREE.SkinnedMesh) object.frustumCulled = false;
            });
            // Меняем все три уровня одновременно, чтобы при смене LOD шаг не пропадал.
            for (let index = peopleLods.length - 1;index >= 0;index--) {
                const old = peopleLods[index];
                if (old.high !== person.object) continue;
                old.medium.removeFromParent();
                old.far.removeFromParent();
                peopleLods.splice(index, 1);
            }
            person.object.visible = false;
            person.object.position.y = person.baseY;
            root.add(instance);
            animatedWalkers.push({ source: person.object, phase: person.phase * 0.13, root: instance, mixer, levels });
        }
        updateShadows();
        const fullOnly = animatedWalkers.some(person => new Set(person.levels).size < 3);
        ui.walkStatus.textContent = formatString(await __("City: Skeletal walking: $1 of $2$3"), animatedWalkers.length, walkers.length, fullOnly ? await __("City:  · full models") : '');
        console.info(ui.walkStatus.textContent);
    }

    function updateAnimatedWalkers(): void {
        if (!city) return;
        camera.updateMatrixWorld();
        actorFrustum.setFromProjectionMatrix(actorViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const inverse = new THREE.Matrix4().copy(city.matrixWorld).invert();
        const position = new THREE.Vector3();
        animatedWalkers.forEach(person => {
            person.source.updateWorldMatrix(true, false);
            position.setFromMatrixPosition(person.source.matrixWorld);
            actorBounds.center.copy(position).y += 0.9;
            person.root.visible = actorFrustum.intersectsSphere(actorBounds);
            if (!person.root.visible) return;
            const distance = position.distanceTo(camera.position);
            const levelIndex = !ui.peopleLodEnabled.checked || distance < 30 ? 0 : distance < 75 ? 1 : 2;
            new Set(person.levels).forEach(level => { level.visible = false; });
            person.levels[levelIndex].visible = true;
            person.root.matrix.multiplyMatrices(inverse, person.source.matrixWorld);
            person.root.matrix.multiply(peopleRigBasis);
            person.root.matrixWorldNeedsUpdate = true;
            // Общее время маршрута: пауза останавливает и шаг, и перемещение.
            // Все уровни используют одни кости, смена LOD сохраняет фазу цикла.
            person.mixer.setTime(movementTime + person.phase);
        });
    }

    function updatePeopleLods(): void {
        if (!city) return;
        const inverse = new THREE.Matrix4().copy(city.matrixWorld).invert();
        const position = new THREE.Vector3();
        peopleLods.forEach(({ high, medium, far }) => {
            high.updateWorldMatrix(true, false);
            position.setFromMatrixPosition(high.matrixWorld);
            const distance = position.distanceTo(camera.position);
            high.visible = !ui.peopleLodEnabled.checked || distance < 30;
            medium.visible = ui.peopleLodEnabled.checked && distance >= 30 && distance < 75;
            far.visible = ui.peopleLodEnabled.checked && distance >= 75;
            for (const level of [medium, far]) {
                if (!level.visible) continue;
                level.matrix.multiplyMatrices(inverse, high.matrixWorld);
                level.matrixWorldNeedsUpdate = true;
            }
        });
    }

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const candidatePackage = new URLSearchParams(location.search).get('cityPackage');
    if (candidatePackage && !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(candidatePackage)) throw new Error(await __("City: Invalid test package name"));
    const manifestUrl = candidatePackage
        ? '/content/3dPortfolioMy/exports/' + candidatePackage + '/manifest.json'
        : CITY_MANIFEST_URL;
    const textPedestrian = await __("City: pedestrian");
    const textSkeletalWalkingAndIdlePedestrians = await __("City: Skeletal walking and idle: $1 pedestrians");
    const textActiveAreaJunctionsDirectedEdges = await __("City: Active area: $1 junctions · $2 directed edges");
    const textFailedToLoadTheCityCheckYourConnectionAndReload = await __("City: Failed to load the city. Check your connection and reload.");

    // Загрузка готового пакета Blender и прогрев сцены.
    async function loadCity(): Promise<void> {
        try {
            const loaded = await loadCityPackage(loader, new URL(manifestUrl, location.href).href);
            description = loaded.description;
            const networkCarriers = new Set<THREE.Object3D>();
            if (loaded.mobility) {
                for (const spawn of loaded.mobility.actorSpawns) {
                    const node = loaded.objects.get(spawn.nodeId)!;
                    node.userData.webDynamic = true;
                    networkCarriers.add(node);
                }
                for (const head of loaded.mobility.signalHeads) for (const lens of head.lenses) loaded.objects.get(lens.nodeId)!.userData.webDynamic = true;
            }
            const packageStatus = document.querySelector<HTMLElement>('#package-status');
            if (packageStatus) packageStatus.textContent = `${candidatePackage ? await __("City: Test package") : await __("City: City")}: ${loaded.manifest.exportId}`;
            ui.canvas.dataset.exportId = loaded.manifest.exportId;
            materialSourceHash = loaded.manifest.compatibility?.sourceSha256 || loaded.manifest.assets.city.sha256;
            description.projectPoints.forEach(point => {
                navigation.set(point.id, { ...point, box: new THREE.Box3(new THREE.Vector3().fromArray(point.pick.min), new THREE.Vector3().fromArray(point.pick.max)) });
                const pointNode = loaded.objects.get(point.nodeId)!;
                projects.set(point.id, pointNode);
                pointObjectIds.set(pointNode, point.id);
            });
            projectPanel.setPoints(description.projectPoints.map(point => point.id));
            city = loaded.root;
            city.visible = false;
            scene.add(city);
            addStreetLighting(city);
            const trafficObjects: THREE.Object3D[] = [];
            const people: THREE.Object3D[] = [];
            city.traverse(object => {
                if (object.userData.city_v11_person) people.push(object);
                // Две полосы и два тротуара улицы проектов уже размечены в экспорте.
                if (/^Traffic[_ ]\d+/.test(object.name)) {
                    object.userData.webDynamic = true;
                    trafficObjects.push(object);
                    if (Math.abs(Math.abs(object.position.x) - 1.67) < 0.1 && object.position.z < -20 && object.position.z > -90) {
                        cars.push({ object, startZ: object.position.z, direction: object.position.x > 0 ? -1 : 1 });
                    }
                }
                if (!loaded.mobility && /^Citizen[_ ]v11/.test(object.name) && Math.abs(Math.abs(object.position.x) - 5.45) < 0.1 && object.position.z < -5 && object.position.z > -95) {
                    object.userData.webDynamic = true;
                    const direction = object.position.x < 0 ? -1 : 1;
                    // Полностью заменяем ориентацию: в исходном GLB встречаются Euler X/Z = PI.
                    object.rotation.set(0, direction < 0 ? 0 : Math.PI, 0);
                    walkers.push({ object, baseX: object.position.x, startZ: object.position.z, baseY: object.position.y, direction, phase: walkers.length * 0.7 });
                }
                if (!(object instanceof THREE.Mesh)) return;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => {
                    if (!(material instanceof THREE.MeshStandardMaterial)) return;
                    natureMaterials.prepare(material);
                    const name = material.name.toLowerCase();
                    if (name.includes('road_asphalt')) {
                        // Нейтральный тёмный асфальт; яркая цветная разметка сохраняется.
                        material.onBeforeCompile = shader => {
                            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                            #include <map_fragment>
                            if (max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b) < 0.08) {
                                float asphaltValue = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * 3.0, 0.028, 0.08);
                                diffuseColor.rgb = vec3(asphaltValue);
                            }
                        `);
                        };
                        material.customProgramCacheKey = () => 'neutral_asphalt_v2';
                    }
                    if ((material.emissiveMap && name.includes('glass')) || name.includes('road_lamp_lens') || name.includes('car_lamp_front')) {
                        if (!glowingMaterials.has(material)) glowingMaterials.set(material, material.emissiveIntensity);
                    }
                });
                const screenMaterials = materials.map(material => {
                    if (!(material instanceof THREE.MeshStandardMaterial) || (!material.map && !material.emissiveMap)) return material;
                    const name = material.name.toLowerCase();
                    if (!/(launcher.screenshot|game.display|screen\d|lava.screenshot|qv.*(chat|media|settings)|fs2.*(portrait|wide))/.test(name)) return material;
                    let screen = displayMaterials.get(material);
                    if (!screen) {
                        screen = new THREE.MeshBasicMaterial({
                            map: material.emissiveMap || material.map,
                            color: 0xffffff, side: material.side, toneMapped: false
                        });
                        screen.name = `${material.name} / display`;
                        displayMaterials.set(material, screen);
                    }
                    return screen;
                });
                object.material = Array.isArray(object.material) ? screenMaterials : screenMaterials[0];
            });
            trafficObjects.forEach(car => {
                // Один направленный источник представляет пару фар и движется вместе с машиной.
                const light = new THREE.SpotLight(0xe4efff, 110, 28, Math.PI / 18, 1, 2);
                light.position.set(0, 0.8, -2.3);
                const target = new THREE.Object3D();
                target.position.set(0, 0.08, -15);
                car.add(target);
                car.add(light);
                light.target = target;
                headlights.push(light);
                trafficVehicles.push({ object: car, headlight: light });
            });
            if (loaded.mobility) for (const spawn of loaded.mobility.actorSpawns) {
                const asset = loaded.mobility.actorAssets.find(asset => asset.id === spawn.assetId)!;
                if (asset.mode !== 'pedestrian') continue;
                const object = loaded.objects.get(spawn.nodeId)!;
                const position = object.getWorldPosition(new THREE.Vector3());
                walkers.push({ object, baseX: position.x, startZ: position.z, baseY: position.y, direction: 1, phase: 0 });
            }
            updateTrafficDensity();
            ui.followWalkerPerson.replaceChildren(...walkers.map((person, index) =>
                new Option(`${index + 1} · ${person.object.userData.people_asset || textPedestrian}`, String(index))));
            ui.followWalkerPerson.disabled = !walkers.length;
            railStart = description.camera.street.focusStartZ;
            railEnd = description.camera.street.focusEndZ;
            railFocus = railStart;
            railDistance = description.camera.street.defaultDistance;
            ui.projectVisit.disabled = true;
            instanceStaticEnvironment(city);
            const staticPeople = people.filter(object => {
                for (let parent: THREE.Object3D | null = object;parent && parent !== city;parent = parent.parent) if (networkCarriers.has(parent)) return false;
                return true;
            });
            const peopleReady = loadPeopleLods(city, loaded.mobility ? staticPeople : people).then(() => loaded.mobility ? undefined : loadAnimatedWalkers(city!)).catch(async error => {
                ui.walkStatus.textContent = '';
                notifications.error(await __("City: Walking animations could not be loaded."), error);
            });
            const mobilityInfo = document.querySelector<HTMLElement>('#mobility-status');
            if (mobilityInfo && !loaded.mobility) mobilityInfo.textContent = await __("City: No traffic signal network in this package · legacy traffic");
            const mobilityReady = loaded.mobility ? MobilityView.create(loaded.mobility, loaded.objects, city, loader, loaded.mobilityUrl!, SIGNAL_TIMINGS).then(view => {
                mobilityView = view;
                updateTrafficDensity();
                const people = view.simulation.actors.filter(actor => actor.asset.mode === 'pedestrian').length;
                ui.walkStatus.textContent = formatString(textSkeletalWalkingAndIdlePedestrians, people);
                const info = document.querySelector<HTMLElement>('#mobility-status');
                if (info) info.textContent = formatString(textActiveAreaJunctionsDirectedEdges, view.data.junctions.length, view.data.edges.length);
            }) : Promise.resolve();
            addEventListener('pagehide', () => mobilityView?.dispose(), { once: true });
            console.info(`Улица проектов: ${cars.length} машин, ${walkers.length} пешеходов`);
            updateGlow();
            updateShadows();
            const bounds = new THREE.Box3(new THREE.Vector3().fromArray(description.bounds.min), new THREE.Vector3().fromArray(description.bounds.max));
            const center = bounds.getCenter(new THREE.Vector3());
            const size = bounds.getSize(new THREE.Vector3());
            const span = Math.max(size.x, size.y, size.z, 1);
            citySpan = span;
            updateFog();
            sun.target.position.copy(center);
            sun.position.copy(center).add(new THREE.Vector3(span * 0.3, span * 0.7, span * 0.4));
            const shadowCamera = sun.shadow.camera;
            shadowCamera.left = shadowCamera.bottom = -span * 0.3;
            shadowCamera.right = shadowCamera.top = span * 0.3;
            shadowCamera.near = 0.1;
            shadowCamera.far = span * 2;
            shadowCamera.updateProjectionMatrix();
            // Камера выровнена по оси улицы проектов, немного выше уровня домов.
            updateStreetCamera();
            camera.near = Math.max(span / 10000, 0.1);
            updateFog();
            controls.maxDistance = span * 5;
            controls.update();
            city.traverse(object => {
                if (!object.userData.webDynamic) {
                    object.updateMatrix();
                    object.matrixAutoUpdate = false;
                }
            });
            ui.status.textContent = await __("City: Preparing lighting and materials…");
            await Promise.all([natureMaterials.loadExportedMaterials('/content/3dPortfolioMy/nature-v01/nature_material_contract.json',
                materialSourceHash).catch(async error => notifications.warning(await __("City: Nature materials could not be loaded. Using fallback materials."), error)), peopleReady, mobilityReady, loadBakedStreet(city)]);
            // Prepare actual draws while the loading overlay is visible, not on the first project click.
            warmingInteriors = true;
            ui.canvas.style.visibility = 'hidden';
            city.visible = true;
            updateShadows();
            const warmStatus = document.querySelector<HTMLElement>('#warm-status');
            try {
                const rooms = description.projectPoints.map(point => {
                    const route = description.camera.routes.find(route => route.id === point.routeId)!;
                    return {
                        name: point.id, prepare: () => configureInteriorLights(projects.get(point.id)!),
                        pose: (probe: THREE.PerspectiveCamera) => {
                            probe.position.fromArray(route.points[route.points.length - 1]);
                            probe.lookAt(new THREE.Vector3().fromArray(route.lookAt));
                        }
                    };
                });
                await warmInteriors(renderer, scene, camera, interiorLights, rooms, message => {
                    ui.status.textContent = message;
                    if (warmStatus) warmStatus.textContent = message;
                });
                activeInteriorProject = null;
                lastInteriorProject = null;
                updateInteriorLights();
                await renderer.compileAsync(scene, camera);
                if (warmStatus) warmStatus.textContent = formatString(await __("City: Lighting and materials ready: $1 interiors"), rooms.length);
            } catch (error) {
                if (warmStatus) warmStatus.textContent = '';
                notifications.warning(await __("City: Interior preparation was incomplete. The first visit may take longer."), error);
            } finally {
                activeInteriorProject = null;
                lastInteriorProject = null;
                updateInteriorLights();
                warmingInteriors = false;
                ui.canvas.style.visibility = '';
            }
            cityReady = true;
            void projectPanel.refresh();
            performancePanel.reset();
            ui.status.hidden = true;
        } catch (error) {
            ui.status.hidden = true;
            notifications.error(textFailedToLoadTheCityCheckYourConnectionAndReload, error);
        }
    }

    // Вход в проект и возврат на улицу.
    function configureInteriorLights(project: THREE.Object3D): void {
        const data = navigation.get(pointObjectIds.get(project) || '')?.interiorLighting;
        if (!data) return;
        interiorLights.forEach((light, index) => {
            light.position.fromArray(data.positions[index % data.positions.length]);
            light.distance = data.distance;
            if (lastInteriorProject !== project) light.shadow.needsUpdate = true;
        });
        lastInteriorProject = project;
        activeInteriorProject = project;
        updateInteriorLights();
    }

    async function enterProject(project: THREE.Object3D): Promise<void> {
        if (!city || !cityReady || preparingEntry || flight || returnPath) return;
        stopFollowingWalker();
        const name = pointObjectIds.get(project) || '';
        const catalogProject = projectPanel.placements.get(name);
        if (!catalogProject) return;
        const data = navigation.get(name);
        if (!data) {
            notifications.warning(await __("City: This project has no prepared camera route."));
            return;
        }
        entryProfiler.begin(catalogProject.name);
        const route = description.camera.routes.find(route => route.id === data.routeId)!;
        const points = entryPoints(description.camera.street, railFocus, railDistance, route);
        savedTarget.copy(controls.target);
        returnPath = points.map(point => point.clone()).reverse();
        activeProjectName = catalogProject.name;
        ui.projectSelect.value = name;
        ui.projectVisit.disabled = true;
        const refreshShadows = lastInteriorProject !== project && ui.shadows.checked && ui.interiorLighting.checked;
        preparingEntry = true;
        configureInteriorLights(project);
        entryProfiler.prepared();
        ui.projectMessage.textContent = formatString(await __("City: Preparing lighting for $1…"), catalogProject.name);
        try {
            if (refreshShadows) await refreshInteriorShadows(renderer, scene, camera, interiorLights,
                probe => { probe.position.fromArray(route.points[route.points.length - 1]); probe.lookAt(new THREE.Vector3().fromArray(route.lookAt)); },
                milliseconds => entryProfiler.offscreen(milliseconds));
        } catch (error) {
            interiorLights.forEach(light => { light.shadow.needsUpdate = true; });
            notifications.warning(await __("City: Entry lighting preparation was incomplete."), error);
        } finally {
            preparingEntry = false;
            updateInteriorLights();
        }
        ui.projectMessage.textContent = formatString(await __("City: Entering $1…"), catalogProject.name);
        controls.enabled = false;
        flight = {
            points, path: new CameraPath(points), look: new THREE.Vector3().fromArray(route.lookAt),
            lookStart: controls.target.clone(), elapsed: 0, duration: 1.2, returning: false
        };
        entryProfiler.ready();
    }
    const textReturningToTheStreet = await __("City: Returning to the street…");

    let lastFrame: number | undefined;
    document.addEventListener('visibilitychange', () => { lastFrame = undefined; });
    const textClickAProjectBuildingToVisitIt = await __("City: Click a project building to visit it.");
    const textInside = await __("City: Inside $1");
    // Шаги одного кадра. Порядок вызовов виден в renderFrame().
    function updateStreetLights(now: number): void {

        if (streetLights.length && now - lastLightUpdate > 1000) {
            const direction = controls.target.clone().sub(camera.position);
            direction.y = 0;
            direction.normalize();
            const start = camera.position.clone(); start.y = 0;
            const end = controls.target.clone().addScaledVector(direction, 35); end.y = 0;
            const sightLine = new THREE.Line3(start, end);
            const closest = new THREE.Vector3();
            const flat = new THREE.Vector3();
            const nearest = lampPositions.map((position, index) => ({ position, index }))
                .filter(({ position }) => !bakedStreet?.enabled || !bakedStreet.containsLamp(position))
                .map(({ position, index }) => {
                    flat.set(position.x, 0, position.z);
                    sightLine.closestPointToPoint(flat, true, closest);
                    return { position, index, distance: closest.distanceToSquared(flat) + 0.003 * position.distanceToSquared(camera.position) };
                })
                .sort((a, b) => a.distance - b.distance);
            streetLights.forEach((light, index) => {
                if (index >= dynamicLampCount || !nearest[index]) { light.visible = false; return; }
                light.position.copy(nearest[index].position);
                light.position.y -= 0.25;
                light.target.position.copy(lampTargets[nearest[index].index]);
                light.visible = ui.timeOfDay.value === 'night' && Number(ui.glowStrength.value) > 0 && Number(ui.streetBrightness.value) > 0;
            });
            lastLightUpdate = now;
        }
    }

    function updateTraffic(delta: number): void {

        if (mobilityView) mobilityView.update(ui.streetMotion.checked ? delta : 0);
        if (ui.streetMotion.checked && !flight) {
            movementTime += delta;
            if (!mobilityView) {
                const wrap = (value: number, min: number, max: number): number => min + ((value - min) % (max - min) + (max - min)) % (max - min);
                cars.forEach(car => { car.object.position.z = wrap(car.startZ + car.direction * movementTime * 4, -96, -6); });
                walkers.forEach(person => {
                    person.object.position.z = wrap(person.startZ + person.direction * movementTime * 1.1, -93, -7);
                    person.object.position.x = person.baseX + pedestrianOffset(person.object.userData.web_id || person.object.name, person.object.position.z + 93, 86, .12).offset;
                    person.object.position.y = person.baseY;
                });
            }
        }
    }

    function updateCameraFlight(delta: number): void {

        if (flight) {
            flight.elapsed = Math.min(flight.elapsed + delta, flight.duration);
            const t = flight.elapsed / flight.duration;
            const eased = t * t * (3 - 2 * t);
            flight.path.sample(eased, camera.position);
            camera.lookAt(new THREE.Vector3().lerpVectors(flight.lookStart, flight.look, eased));
            if (t >= 1) {
                if (flight.returning) {
                    controls.target.copy(savedTarget);
                    controls.enabled = true;
                    returnPath = null;
                    projectPanel.updateSelection();
                    activeInteriorProject = null;
                    updateInteriorLights();
                    ui.projectMessage.textContent = textClickAProjectBuildingToVisitIt;
                } else {
                    controls.target.copy(flight.look);
                    const direction = flight.look.clone().sub(camera.position).normalize();
                    interiorYaw = Math.atan2(direction.x, -direction.z);
                    interiorPitch = Math.asin(direction.y);
                    ui.backButton.hidden = false;
                    ui.projectMessage.textContent = formatString(textInside, activeProjectName);
                }
                flight = null;
                projectPanel.updateSelection();
            }
        }
    }

    function updateFollowCamera(): void {

        if (ui.followWalker.checked && walkers.length && !flight && !returnPath) {
            const person = walkers[Number(ui.followWalkerPerson.value)] || walkers[0];
            const position = person.object.getWorldPosition(new THREE.Vector3());
            controls.target.copy(position).add(new THREE.Vector3(0, 0.95, 0));
            const actor = mobilityView?.simulation.actors.find(actor => actor.nodeId === person.object.userData.web_id);
            const forward = actor ? new THREE.Vector3().fromArray(actor.forward) : new THREE.Vector3(0, 0, person.direction);
            const right = new THREE.Vector3(-forward.z, 0, forward.x);
            camera.position.copy(position).addScaledVector(right, 3.6).addScaledVector(forward, 2.6).add(new THREE.Vector3(0, 1.8, 0));
            camera.lookAt(controls.target);
        }
    }

    function renderFrame(now: number): void {
        // Маршруты аналитические: считаем реальное время видимой вкладки.
        // Ограничение ровно одной секундой замораживало бы фазу секундного шага при низком FPS.
        const delta = lastFrame === undefined || document.hidden ? 0 : (now - lastFrame) / 1000;
        lastFrame = now;
        natureMaterials.time.value += Math.min(delta, 0.1);
        if (!cityReady) {
            if (!warmingInteriors) renderer.render(scene, camera);
            return;
        }
        updateStreetLights(now);
        updateTraffic(delta);
        updateCameraFlight(delta);
        performancePanel.update(now, mobilityView);
        updateFollowCamera();
        updatePeopleLods();
        updateAnimatedWalkers();
        ui.streetPosition.disabled = !!flight || !!returnPath || ui.followWalker.checked;
        if (!flight && !returnPath && !ui.followWalker.checked && city) updateStreetCamera();
        const renderStarted = performance.now();
        renderer.render(scene, camera);
        entryProfiler.frame(performance.now() - renderStarted, delta * 1000, renderer.info.render.calls, renderer.info.render.triangles);
    }

    // Подключаем интерфейс только после подготовки состояния и обработчиков.
    function bindCameraControls(): void {
        ui.streetPosition.addEventListener('input', () => {
            if (flight || returnPath || ui.followWalker.checked) return;
            railFocus = THREE.MathUtils.lerp(railStart, railEnd, Number(ui.streetPosition.value) / 100);
            updateStreetCamera();
        });
        ui.canvas.addEventListener('wheel', event => {
            event.preventDefault();
            if (flight || returnPath || ui.followWalker.checked) return;
            railDistance += event.deltaY * (event.deltaMode === 1 ? 0.4 : 0.02);
            updateStreetCamera();
        }, { passive: false });
        ui.canvas.addEventListener('pointerdown', event => {
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            ui.canvas.setPointerCapture(event.pointerId);
            if (activePointers.size > 1) { pointerStart = null; pinchDistance = 0; }
        });
        ui.canvas.addEventListener('pointermove', event => {
            const previous = activePointers.get(event.pointerId);
            if (!previous) return;
            const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (preparingEntry || flight || ui.followWalker.checked) return;
            if (returnPath) {
                interiorYaw += dx * 0.005;
                interiorPitch -= dy * 0.005;
                updateInteriorLook();
            } else if (activePointers.size === 1) {
                railFocus += dy * railDistance * 0.004;
                updateStreetCamera();
            } else {
                const [a, b] = [...activePointers.values()];
                const distance = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinchDistance > 0 && distance > 0) railDistance *= pinchDistance / distance;
                pinchDistance = distance;
                updateStreetCamera();
            }
        });
        ui.canvas.addEventListener('pointerup', releasePointer);
        ui.canvas.addEventListener('pointercancel', event => { releasePointer(event); pointerStart = null; });
        document.addEventListener('keydown', event => {
            if (flight || returnPath || ui.followWalker.checked || (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button,summary'))) return;
            if (['ArrowUp', 'w', 'W', 'ц', 'Ц'].includes(event.key)) railFocus -= 2;
            else if (['ArrowDown', 's', 'S', 'ы', 'Ы'].includes(event.key)) railFocus += 2;
            else return;
            event.preventDefault();
            updateStreetCamera();
        });
        ui.followWalker.addEventListener('change', () => {
            if (ui.followWalker.checked) {
                if (flight || returnPath || !walkers.length) { ui.followWalker.checked = false; return; }
                overviewPosition.copy(camera.position);
                overviewTarget.copy(controls.target);
                controls.enabled = false;
            } else {
                camera.position.copy(overviewPosition);
                controls.target.copy(overviewTarget);
                controls.enabled = true;
                controls.update();
            }
        });
    }

    function bindGraphicsControls(): void {
        ui.timeOfDay.addEventListener('change', () => {
            const night = ui.timeOfDay.value === 'night';
            scene.background = new THREE.Color(night ? 0x080c12 : 0xc9d1d3);
            ambient.color.setHex(night ? 0x9eb5df : 0xe8f4ff);
            ambient.groundColor.setHex(night ? 0x303843 : 0x66717a);
            ambient.intensity = night ? 0.28 : 2.1;
            sun.color.setHex(night ? 0xc8d6ee : 0xffecd5);
            sun.intensity = night ? 0.18 : 2.4;
            ui.sunIntensity.value = String(sun.intensity);
            updateFog();
            updateGlow();
        });
        ui.bakedStreetEnabled.addEventListener('change', updateBakedStreetMode);
        ui.glowStrength.addEventListener('input', updateGlow);
        ui.streetBrightness.addEventListener('input', updateGlow);
        ui.headlightsEnabled.addEventListener('change', updateGlow);
        ui.trafficDensity.addEventListener('input', updateTrafficDensity);
        ui.interiorLighting.addEventListener('change', updateInteriorLights);
        ui.interiorBrightness.addEventListener('input', updateInteriorLights);
        ui.fogEnabled.addEventListener('change', updateFog);
        ui.fogDistance.addEventListener('input', updateFog);
        ui.exposure.addEventListener('input', () => { renderer.toneMappingExposure = Number(ui.exposure.value); });
        ui.sunIntensity.addEventListener('input', () => { sun.intensity = Number(ui.sunIntensity.value); });
        ui.shadows.addEventListener('change', updateShadows);
        ui.vegetationInstancing.addEventListener('change', updateVegetationInstancing);
        ui.peopleLodEnabled.addEventListener('change', () => { sun.shadow.needsUpdate = true; });
        window.addEventListener('resize', resize);
        ui.quality.addEventListener('change', () => {
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, Number(ui.quality.value)));
            resize();
        });
    }

    function bindProjectNavigation(): void {
        ui.canvas.addEventListener('pointerdown', event => {
            pointerStart = activePointers.size === 1 ? { x: event.clientX, y: event.clientY } : null;
        });
        ui.canvas.addEventListener('pointerup', event => {
            if (!pointerStart || !city || !cityReady || flight || returnPath) return;
            const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
            pointerStart = null;
            if (moved > 5) return;
            const rect = ui.canvas.getBoundingClientRect();
            const point = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
            raycaster.near = 0;
            raycaster.far = camera.far;
            raycaster.setFromCamera(point, camera);
            const hitPoint = new THREE.Vector3();
            let nearest = Infinity;
            let selected: THREE.Object3D | undefined;
            navigation.forEach(data => {
                if (!raycaster.ray.intersectBox(data.box, hitPoint)) return;
                const distance = camera.position.distanceToSquared(hitPoint);
                const project = projectPanel.placements.has(data.id) ? projects.get(data.id) : undefined;
                if (project && distance < nearest) { nearest = distance; selected = project; }
            });
            if (selected) activatePoint(pointObjectIds.get(selected)!);
        });
        ui.backButton.addEventListener('click', () => {
            if (!returnPath || flight) return;
            ui.projectMessage.textContent = textReturningToTheStreet;
            ui.backButton.hidden = true;
            flight = {
                points: returnPath, path: new CameraPath(returnPath), look: savedTarget.clone(), lookStart: controls.target.clone(),
                elapsed: 0, duration: 0.9, returning: true
            };
        });
    }

    bindCameraControls();
    bindGraphicsControls();
    bindProjectNavigation();
    renderer.setAnimationLoop(renderFrame);
    void loadCity();
}

void startViewer().catch(error => {
    ui.status.hidden = true;
    notifications.error(ui.status.dataset.failureMessage!, error);
});
