
/** CPU/driver timings around entry; this is not a GPU timer query. */
export class EntryProfiler {
    private started = 0;
    private label = '';
    private prepareMs = 0;
    private readyMs = 0;
    private maxOffscreenMs = 0;
    private samples: { renderMs: number; frameMs: number; calls: number; triangles: number }[] = [];
    private active = false;
    constructor(private output: HTMLElement | null) {}
    begin(label: string): void {
        this.label = label;
        this.started = performance.now();
        this.samples = [];
        this.maxOffscreenMs = 0;
        this.readyMs = 0;
        this.active = true;
    }
    prepared(): void { this.prepareMs = performance.now() - this.started; }
    ready(): void { this.readyMs = performance.now() - this.started; }
    offscreen(milliseconds: number): void { this.maxOffscreenMs = Math.max(this.maxOffscreenMs, milliseconds); }
    frame(renderMs: number, frameMs: number, calls: number, triangles: number): void {
        if (!this.active) return;
        this.samples.push({ renderMs, frameMs, calls, triangles });
        const elapsed = performance.now() - this.started;
        if ((this.samples.length >= 30 && elapsed >= 2000) || elapsed > 8000) {
            const report = { project: this.label, prepareMs: +this.prepareMs.toFixed(1),
                readyMs: +this.readyMs.toFixed(1), maxOffscreenMs: +this.maxOffscreenMs.toFixed(1),
                maxRenderMs: +Math.max(...this.samples.map(s => s.renderMs)).toFixed(1),
                maxFrameMs: +Math.max(...this.samples.map(s => s.frameMs)).toFixed(1),
                firstRenderMs: +this.samples[0].renderMs.toFixed(1),
                maxCalls: Math.max(...this.samples.map(s => s.calls)),
                maxTriangles: Math.max(...this.samples.map(s => s.triangles)), samples: this.samples.length };
            console.info('CITY_ENTRY_PROFILE ' + JSON.stringify(report));
            if (this.output) this.output.dataset.entryProfile = JSON.stringify(report);
            void __("City: Entry: ready $1 ms · max render $2 ms · shadows $3 ms · max frame $4 ms").then(message => {
                if (this.output) this.output.textContent = formatString(message, report.readyMs, report.maxRenderMs, report.maxOffscreenMs, report.maxFrameMs);
            });
            this.active = false;
        }
    }
}
