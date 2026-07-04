(() => {
    function runEvalNumber(text:string, time:number) {
        const x = time
        const t = time

        const evalFunc = new Function('time', 'text', `const { PI, sin, cos } = Math; const x = time; const t = time; return eval(text);`);
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
    const canvas = $('#canvas')[0] as HTMLCanvasElement
    const context = canvas.getContext('2d')!;

    const canvas_container = document.getElementById("canvas-container")!;
    const time_show = document.getElementById("time")!;
    
    const objHtmlList = $(".elements-list");

    var objects : string[] = []
    var newId = 0
    var scale = 50
    
    function setCanvasSize() {
    // CSS-размеры уже 100vw/100vh, но внутренние размеры должны совпадать
    canvas.width = canvas_container.clientWidth;
    canvas.height = canvas_container.clientHeight;
    }
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
        const max = (Math.max(e.deltaX, e.deltaY, e.deltaZ));
        const min = (Math.min(e.deltaX, e.deltaY, e.deltaZ));
        if (Math.abs(max) > Math.abs(min))
        {
            scale += max
        } else {
            scale += min
        }
    })
    setCanvasSize(); // применить сразу при загрузке

    function loop() {
        context.clearRect(0,0,canvas.width, canvas.height)

        const time = performance.now() / 1000;
        time_show.textContent = "t=" + time
        for (const obj of objects) {
            context.beginPath();
            const x = getAndShowErrorIdNeed((obj + "-x"), time)
            const y = getAndShowErrorIdNeed((obj + "-y"), time)
            const scaleE = getAndShowErrorIdNeed((obj + "-scale"), time)
            context.arc(
                x * scale + canvas.width / 2, 
                y * scale + canvas.height / 2, 
                Math.abs(scaleE * scale), 
                0, 2 * Math.PI, false);
            context.fillStyle = getValue(obj + "-color")
            context.fill();
        }
        requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    async function genGameObjectHtml(idNamePrefix: string) {
        return `<div class="card w-100" id="${idNamePrefix}-div">
                    <div class="card-body">
                        <h5 class="card-title d-flex align-items-center gap-2">
                            <span class="badge"><input type="color" id="${idNamePrefix}-color" style="width: 1.5rem; height: 1.5rem;"></span>
                            <div class="evals">
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/X")}" id="${idNamePrefix}-x">
                                <div class="invalid-feedback" id="${idNamePrefix}-x-error"></div>
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/Y")}" id="${idNamePrefix}-y">
                                <div class="invalid-feedback" id="${idNamePrefix}-y-error"></div>
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/Scale")}" id="${idNamePrefix}-scale">
                                <div class="invalid-feedback" id="${idNamePrefix}-scale-error"></div>
                            </div>
                        </h5>
                        <button type="button" class="btn btn-secondary bi bi-trash3" id="${idNamePrefix}-trash">
                        </button>
                    </div>
                </div>`
    }

    setupFullscreen("#fullscreen", "#exit_fullscreen", "#fullscreen_div")
})()