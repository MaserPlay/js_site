(() => {
    function runEval(text:string, time:number) {
        const x = time
        const t = time

        const { PI, sin, cos } = Math;
        try {
            return eval(text) as number;
        } catch (e : any) {
            console.error(e)
            return 0
        }
    }
    function getValue(id: string) {
        return (document.getElementById(id) as HTMLInputElement).value
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
            const x = runEval(getValue(obj + "-x"), time)
            const y = runEval(getValue(obj + "-y"), time)
            const scaleE = runEval(getValue(obj + "-scale"), time)
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
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/Y")}" id="${idNamePrefix}-y">
                                <input type="text" class="form-control flex-grow-1" placeholder="${await __("Content/CalcAnimationEditor/Formula/Scale")}" id="${idNamePrefix}-scale">
                            </div>
                        </h5>
                        <button type="button" class="btn btn-secondary bi bi-trash3" id="${idNamePrefix}-trash">
                        </button>
                    </div>
                </div>`
    }

    setupFullscreen("#fullscreen", "#exit_fullscreen", "#fullscreen_div")
})()