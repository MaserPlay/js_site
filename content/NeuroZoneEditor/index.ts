(() => {
    class Vector2{
        private data : [number, number]
        // Объявления перегрузок
        constructor();
        constructor(xy: number);
        constructor(x: number, y: number);
        
        // Реализация конструктора
        constructor(XorXY?: number, Y?: number) {
            if (XorXY == null)
            {
                this.data = [0,0];
            } else if (Y == null) {
                this.data = [XorXY, XorXY];
            } else {
                this.data = [XorXY, Y];
            }
        }

        get x() {
            return this.data[0]
        }
        get y() {
            return this.data[1]
        }
        set x(val : number) {
            this.data[0] = val
        }
        set y(val : number) {
            this.data[1] = val
        }
        toString(): string {
            return `Vector2(${this.x}, ${this.y})`;
        }
        toSaveObj() : [number, number] {
            return this.data
        }
        static distance(a : Vector2, b : Vector2){
            const differense = new Vector2(a.x - b.x, a.y - b.y);
            return Math.sqrt(differense.x * differense.x + differense.y * differense.y)
        }
    }
    const canvas = $('#canvas')[0] as HTMLCanvasElement
    const context = canvas.getContext('2d')!;
    const zoneHtmlList = $(".elements-list");
    const fileInput = $("#fileInput");
    const addZone = $("#addZone");
    var loadedData: SaveableZone[] | undefined = undefined
    fileInput.on("change", (event) => {
        // Правильное получение файла
        const inputElement = event.target as HTMLInputElement;
        const file = inputElement.files?.[0];

        if (file) {
            // Дальнейшая обработка файла
            console.log("Выбран файл:", file.name);

            initEditor(file, loadedData);
        } else {
            console.log("Файл не выбран");
        }
    });

    $("#import_nvidia").on("click", function(){
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = e => {
            const file = input?.files?.[0]
            if (file) {
                // 3. Создаем FileReader для чтения файла
                const reader = new FileReader();

                // 4. Настраиваем обработчик успешного чтения
                reader.onload = (event) => {
                    // 5. Парсим JSON данные
                    const data = (event.target?.result as string);
                    console.log("Данные успешно загружены:", data);

                    if (loadedData)
                    {
                        loadedData.length = 0
                    } else {
                        loadedData = []
                    }
                    data.split("\n").forEach((stroke)=>{
                        const currZone : SaveableZone = {
                            name: stroke.split("=")[0],
                            colorHex: undefined,
                            positions: []
                        }
                        const positions = stroke.split("=")?.[1]?.split(";") ?? []
                        for (let i = 0; i < positions.length; i+=2) {
                            currZone.positions.push(new Vector2(Number(positions[i]), Number(positions[i + 1])))
                        }
                        loadedData?.push(currZone)
                    })

                    fileInput.trigger('click')
                };

                // 7. Настраиваем обработчик ошибок
                reader.onerror = () => {
                    console.error("Ошибка чтения файла");
                };

                // 8. Запускаем чтение файла
                reader.readAsText(file);
            } else {
                console.error("File dont exsists")
                // Обработка случая, когда файл не выбран
            }
        }
        input.click();
    });
    
    $("#import_json").on("click", function(){
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = input?.files?.[0]
            if (file) {
                // 3. Создаем FileReader для чтения файла
                const reader = new FileReader();

                // 4. Настраиваем обработчик успешного чтения
                reader.onload = (event) => {
                    try {
                        // 5. Парсим JSON данные
                        loadedData = JSON.parse(event.target?.result as string);

                        if (!loadedData)
                        {
                            return
                        }

                        for (let i = 0; i < loadedData.length; i++) {
                            // @ts-ignore
                            loadedData[i].positions = savedZone.positions.map((vec)=>new Vector2(vec[0], vec[1]));
                        }

                        console.log("Данные успешно загружены:", loadedData);
                        fileInput.trigger('click')
                    } catch (error) {
                        console.error("Ошибка парсинга JSON:", error);
                    }
                };

                // 7. Настраиваем обработчик ошибок
                reader.onerror = () => {
                    console.error("Ошибка чтения файла");
                };

                // 8. Запускаем чтение файла
                reader.readAsText(file);
            } else {
                console.error("File dont exsists")
                // Обработка случая, когда файл не выбран
            }
        }
        input.click();
    });

    interface SaveableZone {
        positions: Vector2[];
        colorHex: string | undefined;
        name: string | undefined;
    }
    async function initEditor(imageFile: Readonly<File>, saveZone : SaveableZone[] | undefined) {
        const img = await readImageToImageHtml(await readFileAsDataURL(imageFile));
        const zoneList : Zone[] = []
        var newZoneIndex = 0;
        var currZoneIndex : number = -1
        const dragPointIndexes : [number, number] = [-1,-1]
        class Zone implements SaveableZone {
            positions : Vector2[];
            colorHex : string;
            htmlPrefix : string;
            name : string;
            private $element: string = ""; // Сохраняем ссылку на HTML-элемент
            constructor(nameHtmlOrSaveZone?: SaveableZone) {
                if (nameHtmlOrSaveZone)
                {
                    // Если передан SaveableZone (восстановление из сохранённого объекта)
                    const savedZone = nameHtmlOrSaveZone as SaveableZone;
                    this.htmlPrefix = savedZone.name ?? newZoneIndex.toString();
                    this.name = savedZone.name ?? newZoneIndex.toString();
                    this.colorHex = savedZone.colorHex ?? "#000000";
                    this.positions = savedZone.positions;
                } else {
                    // Если передана строка (новый Zone)
                    this.htmlPrefix = newZoneIndex.toString();
                    this.name = newZoneIndex.toString();
                    this.colorHex = "#000000"; // Значение по умолчанию
                    this.positions = []; // Пустой массив позиций
                }
                this.configureHtml();
            }
            toSaveObject(): SaveableZone {
                const clone: SaveableZone = {
                    colorHex: this.colorHex,
                    name: this.name,
                    positions: this.positions
                };

                return clone;
            }
            private configureHtml() {
                zoneHtmlList.append(genZoneHtml(this.htmlPrefix));
                this.$element = `#${this.htmlPrefix}-div`; // Сохраняем jQuery-объект
                $(`#${this.htmlPrefix}-text`).val(this.name)
                $(`#${this.htmlPrefix}-text`).on("input", ()=> {
                    this.name = $(`#${this.htmlPrefix}-text`).val()?.toString() ?? ""
                })
                $(`#${this.htmlPrefix}-color`).val(this.colorHex)
                $(`#${this.htmlPrefix}-color`).on("input", ()=> {
                    this.colorHex = $(`#${this.htmlPrefix}-color`).val()?.toString() ?? ""
                })
                $(`#${this.htmlPrefix}-trash`).on("click", ()=> {
                    this.remove(); // Вызываем метод remove
                })
                $(`#${this.htmlPrefix}-select`).on("click", ()=> {
                    this.select();
                })
            }
            select(){
                currZoneIndex = zoneList.findIndex(zone => zone === this);
                // Show on ui
                for (let i = 0; i < zoneList.length; i++) {
                    $(`#${zoneList[i].htmlPrefix}-select`).prop("disabled",false);
                    $(`#${zoneList[i].htmlPrefix}-select`).text("Select")
                }
                $(`#${this.htmlPrefix}-select`).prop("disabled",true);
                $(`#${this.htmlPrefix}-select`).text("Selected")
            }
            // Метод для корректного удаления зоны
            remove() {
                // 1. Удаляем из массива
                const index = zoneList.findIndex(zone => zone === this);
                if (index !== -1) {
                    zoneList.splice(index, 1);
                }
        
                // 2. Удаляем HTML-элемент
                $(this.$element).remove()
            }
            render(){
                if (this.positions.length >= 1) {
                    context.beginPath();
                    context.moveTo(this.positions[0].x, this.positions[0].y);
                    
                    this.positions.forEach(pos => {
                        context.lineTo(pos.x, pos.y);
                    });
                    context.closePath();
                    context.fillStyle = this.colorHex;
                    context.lineWidth = 1;
                    context.fill();
                    context.stroke();
                }
            }
        }
        if (saveZone)
        {
            saveZone.forEach(saveZ => {
                zoneList.push(new Zone(saveZ))
            });
        }
        canvas.height = img.height
        canvas.width = img.width
        fileInput.hide();
        addZone.prop("disabled",false);
        addZone.on("click", ()=>{
            newZoneIndex++
            zoneList.push(new Zone());
            zoneList[zoneList.length - 1].select()
        })

        canvas.onmousedown = (e)=>{
            const rect = canvas.getBoundingClientRect();
            const mouse: Vector2 = convertViewToImageCords(new Vector2(e.clientX - rect.left, e.clientY - rect.top));
            for (let i = 0; i < zoneList.length; i++) {
                for (let posi = 0; posi < zoneList[i].positions.length; posi++) {
                    if (Vector2.distance(mouse, zoneList[i].positions[posi]) <= 30)
                    {
                        dragPointIndexes[0] = i;
                        dragPointIndexes[1] = posi;
                        return
                    }
                }
            }
            if (zoneList[currZoneIndex])
            {
                zoneList[currZoneIndex].positions.push(mouse)
            }
        }
        canvas.onmouseup = (e)=>{
            dragPointIndexes[0] = -1;
            dragPointIndexes[1] = -1;
        }
        canvas.onmousemove = (e)=>{
            const rect = canvas.getBoundingClientRect();
            const mouse: Vector2 = convertViewToImageCords(new Vector2(e.clientX - rect.left, e.clientY - rect.top));
            if (zoneList[dragPointIndexes[0]] != null && zoneList[dragPointIndexes[0]].positions[dragPointIndexes[1]] != null)
            {
                zoneList[dragPointIndexes[0]].positions[dragPointIndexes[1]] = mouse
            }
        }

        function loop() {
            context.clearRect(0,0,canvas.width, canvas.height)
            context.drawImage(img, 0, 0, canvas.width, canvas.height)
            context.globalAlpha = 0.8
            zoneList.forEach(zone => {
                zone.render()
            });
            context.globalAlpha = 1
            requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
        loop()
        
        $("#export_json").prop("disabled",false);
        $("#export_json").on("click", function () {
            const exportData: object[] = zoneList.map(zone => {
                const saved = zone.toSaveObject();
                return {
                    ...saved,
                    positions: saved.positions.map(pos => pos.toSaveObj())
                };
            });
            
            download('NeuroZoneEditorProject.json', JSON.stringify(exportData, null, 2));
        });
        
        $("#export_nvidia").prop("disabled",false);
        $("#export_nvidia").on("click", function () {
            var downloadObj : SaveableZone[] = []
            zoneList.forEach(zone => {
                downloadObj.push(zone.toSaveObject())
            });
            var saveText : string = ""
            downloadObj.forEach(DObj => {
                saveText += "roi-" + DObj.name + "="
                DObj.positions.forEach(pos => {
                    saveText += Math.trunc(pos.x) + ";" + Math.trunc(pos.y) + ";"
                });
                saveText = (saveText.slice(0, -1) + '\n');
            });
            download('NeuroZoneEditorNvidiaProject.txt', saveText);
        })
        $("#import_nvidia").prop("disabled",true);
        $("#import_json").prop("disabled",true);
        
        function convertViewToImageCords(position:Vector2) : Vector2 {
            const rect = canvas.getBoundingClientRect();
            const ratio = new Vector2(img.width / rect.width, img.height / rect.height)
            return new Vector2(position.x * ratio.x, position.y * ratio.y)
        }
        function download(filename : string, text : string) {
            var pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
            pom.setAttribute('download', filename);
        
            if (document.createEvent) {
                var event = document.createEvent('MouseEvents');
                event.initEvent('click', true, true);
                pom.dispatchEvent(event);
            }
            else {
                pom.click();
            }
        }
        function readFileAsDataURL(file: Readonly<File>): Promise<string> {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
    
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    
                reader.readAsDataURL(file);
            });
        }
        function readImageToImageHtml(image: string): Promise<HTMLImageElement> {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('onError in Image'));
                img.src = image;
            });
        }    
        function genZoneHtml(idNamePrefix: string): string {
            return `<div class="card w-100" id="${idNamePrefix}-div">
                        <div class="card-body">
                            <h5 class="card-title d-flex align-items-center gap-2">
                                <span class="badge"><input type="color" id="${idNamePrefix}-color" style="width: 1.5rem; height: 1.5rem;" /></span>
                                <input type="text" class="form-control flex-grow-1" id="${idNamePrefix}-text">
                            </h5>
                            <button type="button" class="btn btn-secondary bi bi-trash3" id="${idNamePrefix}-trash"></button>
                            <button type="button" class="btn btn-primary" id="${idNamePrefix}-select">Select</button>
                        </div>
                    </div>`;
        }
    }

    setupFullscreen("#fullscreen", "#exit_fullscreen", "#fullscreen_div")
    // fullscreenDiv.addEventListener('mousemove', (e) => {

    //     // Получаем координаты относительно fullscreenDiv
    //     const rect = fullscreenDiv.getBoundingClientRect();
    //     var mouse: Vector = [e.clientX - rect.left, e.clientY - rect.top];

    //     // Проверяем, находится ли курсор в левом нижнем углу (50x50px)
    //     const inCorner = mouse[1] > rect.height - 20 && mouse[0] < 20;
    //     console.log(inCorner ? 'in corner!!!' : "not in corner");

    //     // if (inCorner) {
    //     //   cornerButton.classList.remove('hidden');
    //     // } else if (!cornerButton.matches(':hover')) {
    //     //   cornerButton.classList.add('hidden');
    //     // }
    //   });
})()
