import { Mesh, PerspectiveCamera, PointLight, Scene, Texture, Vector4, WebGLRenderer, WebGLRenderTarget } from 'three';

/** Refresh one cubemap per frame; keep the street's lighting unchanged between passes. */
export async function refreshInteriorShadows(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera,
    lights: PointLight[], pose: (camera: PerspectiveCamera) => void,
    measured: (milliseconds: number) => void): Promise<void> {
    const previousTarget = renderer.getRenderTarget();
    const target = new WebGLRenderTarget(16, 16);
    const probe = camera.clone();
    probe.aspect = 1;
    probe.updateProjectionMatrix();
    pose(probe);
    probe.updateMatrixWorld();
    lights.forEach(light => { light.shadow.needsUpdate = false; light.visible = false; });
    try {
        for (const light of lights) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            lights.forEach(item => { item.visible = true; });
            light.shadow.needsUpdate = true;
            const started = performance.now();
            renderer.setRenderTarget(target);
            renderer.render(scene, probe);
            measured(performance.now() - started);
            renderer.setRenderTarget(previousTarget);
            lights.forEach(item => { item.visible = false; });
        }
    } finally {
        renderer.setRenderTarget(previousTarget);
        target.dispose();
    }
}

/** Real offscreen draws initialize shadow/depth programs and GPU buffers as well as surface shaders. */
export async function warmInteriors(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, lights: PointLight[],
    rooms: { name: string; prepare: () => void; pose: (camera: PerspectiveCamera) => void }[],
    progress: (message: string) => void): Promise<void> {
    const previousTarget = renderer.getRenderTarget();
    const viewport = renderer.getViewport(new Vector4());
    const scissor = renderer.getScissor(new Vector4());
    const scissorTest = renderer.getScissorTest();
    const probe = camera.clone();
    probe.aspect = 1;
    probe.updateProjectionMatrix();
    try {
        const textures = new Set<Texture>();
        scene.traverse(object => {
            if (!(object instanceof Mesh)) return;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
            }
        });
        let uploaded = 0;
        for (const texture of textures) {
            renderer.initTexture(texture);
            uploaded++;
            if (uploaded % 4 === 0) {
                progress(`Подготовка текстур ${uploaded}/${textures.size}…`);
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            }
        }
        for (let i = 0; i < rooms.length; i++) {
            progress(`Подготовка интерьеров ${i + 1}/${rooms.length}…`);
            rooms[i].prepare();
            rooms[i].pose(probe);
            probe.updateMatrixWorld();
            if (i === 0) await renderer.compileAsync(scene, probe);
            // Rehearse exactly the same one-light passes used when entering a room.
            await refreshInteriorShadows(renderer, scene, probe, lights, rooms[i].pose,
                milliseconds => console.info(`CITY_INTERIOR_WARM ${rooms[i].name} ${milliseconds.toFixed(1)}ms`));
            // The first flight frame still sees the STREET with all interior lights enabled.
            // Compile again once real shadow maps exist, then draw both views with that variant.
            lights.forEach(light => { light.visible = true; });
            if (i === 0) await renderer.compileAsync(scene, probe);
            // A regular render target uses linear output and skips the canvas tone-mapping variant.
            // Draw a tiny canvas viewport while the caller keeps the loading screen visible.
            renderer.setRenderTarget(previousTarget);
            renderer.setViewport(0, 0, 16, 16);
            renderer.setScissor(0, 0, 16, 16);
            renderer.setScissorTest(true);
            renderer.render(scene, camera);
            renderer.render(scene, probe);
            renderer.setViewport(viewport);
            renderer.setScissor(scissor);
            renderer.setScissorTest(scissorTest);
            lights.forEach(light => { light.visible = false; });
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
    } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(scissorTest);
    }
}
