(() => {
    const canvas = $('#canvas')[0] as HTMLCanvasElement
    const context = canvas.getContext('2d')!;

    const canvas_container = document.getElementById("canvas-container")!;
    const time_show = document.getElementById("time")!;
    
    const objHtmlList = $(".elements-list");
    setCanvasSize(); // применить сразу при загрузке

    var objects : string[] = []
    var newId = 0
    var scale = 50
    var offestX = 0
    var offestY = 0
    var tOffset = 0

    function loop() {
        context.clearRect(0,0,canvas.width, canvas.height)

        const time = (performance.now() - tOffset) / 1000;
        time_show.textContent = "t=" + time.toFixed(4)
        for (const obj of objects) {
            context.beginPath();
            const x = getAndShowErrorIdNeed((obj + "-x"), time)
            const y = getAndShowErrorIdNeed((obj + "-y"), time)
            const scaleE = getAndShowErrorIdNeed((obj + "-scale"), time)
            context.arc(
                x * scale + canvas.width / 2 + offestX, 
                y * scale + canvas.height / 2 + offestY, 
                Math.abs(scaleE * scale), 
                0, 2 * Math.PI, false);
            context.fillStyle = getValue(obj + "-color")
            context.fill();
        }
        requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    document.getElementById("reset_t")?.addEventListener("click", (e) => {
        tOffset = performance.now()
    })
    document.getElementById("to_home")?.addEventListener("click", (e) => {
        offestX = 0;
        offestY = 0;
        scale = 50;
    })
    document.getElementById("add")?.addEventListener("click", async (e) => {
        const id = (newId++).toString()
        objHtmlList.append(await genGameObjectHtml(id))
        objects.push(id)
        document.getElementById(id + "-trash")?.addEventListener("click", () => {
            var index = objects.indexOf(id);
            if (index !== -1) {
                objects.splice(index, 1);
            }
            document.getElementById(id + "-div")?.remove()
        })
    })

    window.addEventListener('resize', setCanvasSize);
    canvas_container.addEventListener("wheel", (e) => {
        e.preventDefault(); // чтобы не срабатывал обычный скролл страницы

        const zoomSpeed = 0.001; // чувствительность

        scale *= Math.exp(-e.deltaY * zoomSpeed);
    })
    let lastX = 0;
    let lastY = 0;
    let dragging = false;

    canvas.addEventListener("pointerdown", (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;

        canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        lastX = e.clientX;
        lastY = e.clientY;

        offestX += dx;
        offestY += dy;

        loop();
    });

    canvas.addEventListener("pointerup", (e) => {
        dragging = false;
        canvas.releasePointerCapture(e.pointerId);
    });

    function setCanvasSize() {
        // CSS-размеры уже 100vw/100vh, но внутренние размеры должны совпадать
        canvas.width = canvas_container.clientWidth;
        canvas.height = canvas_container.clientHeight;
    }
    __("Content/CalcAnimationEditor/Formula/X")
    __("Content/CalcAnimationEditor/Formula/Y")
    __("Content/CalcAnimationEditor/Formula/Scale")
    async function genGameObjectHtml(idNamePrefix: string) {
        return `<div class="card w-100" id="${idNamePrefix}-div">
                    <div class="card-body">
                        <h5 class="card-title d-flex align-items-center gap-2">
                            <span class="badge"><input type="color" id="${idNamePrefix}-color" style="width: 1.5rem; height: 1.5rem;"></span>
                            <div class="evals">
                                <div>
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/X")}" id="${idNamePrefix}-x">
                                <div class="invalid-feedback" id="${idNamePrefix}-x-error"></div>
                                </div>
                                <div>
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/Y")}" id="${idNamePrefix}-y">
                                <div class="invalid-feedback" id="${idNamePrefix}-y-error"></div>
                                </div>
                                <div>
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/Scale")}" id="${idNamePrefix}-scale">
                                <div class="invalid-feedback" id="${idNamePrefix}-scale-error"></div>
                                </div>
                            </div>
                        </h5>
                        <button type="button" class="btn btn-secondary bi bi-trash3" id="${idNamePrefix}-trash">
                        </button>
                    </div>
                </div>`
    }
    function runEvalNumber(text:string, time:number) {

        const evalFunc = new Function('t', 's', `const { PI, sin, cos, E, acos, asin, tan, atan, abs, log, sqrt, exp } = Math; const x = t; return eval(s);`);
        const returnVal = evalFunc(time, text);
        if (typeof returnVal == 'number')
        {
            return returnVal
        }
        throw new Error(returnVal + " not a number")
    }
    function getValue(id: string) {
        return (document.getElementById(id) as HTMLInputElement).value
    }
    function getAndShowErrorIdNeed(id_val: string, time: number) {
        document.getElementById(id_val)!.classList.remove("is-invalid")
        
        try {
            return runEvalNumber(getValue(id_val), time)
        } catch (e:unknown) {
            const error = e instanceof Error ? e.message : String(e);
            document.getElementById(id_val)?.classList.add("is-invalid")
            document.getElementById(id_val + "-error")!.textContent = error
            console.error(error)
            return 0
        }
    }

    setupFullscreen("#fullscreen", "#exit_fullscreen", "#fullscreen_div")
})()