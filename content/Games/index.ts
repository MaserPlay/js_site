function RunTetris(canvasId: string, onGameOver: () => void = () => { alert("game over") }) {
    type Vector = [number, number]
    type FigureMaks = ReadonlyArray<ReadonlyArray<number>>
    type Color = string | CanvasGradient | CanvasPattern
    enum RotateFigure {
        LEFT,
        DOWN,
        RIGHT,
        UP
    };
    class Figure {
        private _position: Vector = [canvas.width / 2 / squareSize[0], 0]
        get XPos() {
            return this._position[0]
        }
        set XPos(val: number) {
            if (this.checkCollision([val, this.YPos])) {
                return
            } else {
                this._position[0] = val
            }
        }
        get YPos() {
            return this._position[1]
        }
        set YPos(val: number) {
            if (this.checkCollision([this.XPos, val])) {
                return
            } else {
                this._position[1] = val
            }
        }
        get Pos() {
            return [this.XPos, this.YPos]
        }
        set Pos(val: Vector) {
            this._position = val
        }
        private readonly _positions_mask: FigureMaks
        private _rotate: RotateFigure = RotateFigure.UP
        get rotate(){
            return this._rotate
        }
        set rotate(r : RotateFigure)
        {
            this._rotate = r
        }
        get positionsMask() {
            return this._positions_mask
        }
        get positions(): Vector[] {
            const final: Vector[] = []
            for (let XPos = 0; XPos < this.positionsMask.length; XPos++) {
                for (let YPos = 0; YPos < this.positionsMask[XPos].length; YPos++) {
                    if (this.positionsMask[XPos][YPos])
                        final.push([YPos, XPos])
                }
            }
            return final
        }
        style: Color
        constructor(array: FigureMaks, style: Color) {
            this._positions_mask = array
            this.style = style
        }
        moveDown() {
            if (canvas.height / squareSize[1] - this.getHeight() > this.YPos)
                this.YPos += 1
        }
        isDown(): boolean {
            return !(canvas.height / squareSize[1] - this.getHeight() > this.YPos) || this.checkCollision([this.XPos, this.YPos + 1])
        }
        draw() {
            context.fillStyle = this.style;
            this.positions.forEach((pos) => {
                context.fillRect((this.XPos + pos[0]) * squareSize[0], (this.YPos + pos[1]) * squareSize[1], squareSize[0], squareSize[1]);
            })
        }
        getWidth(): number {
            return this.positionsMask[0].length
        }
        getHeight(): number {
            return this.positionsMask.length
        }
        /**
         * check collision of this and another figures
         * @returns true if have collision
         */
        checkCollision(thisPos: Vector = this.Pos): boolean {
            return storredFirures.some((fig) =>
                this.positions.some((possThis) =>
                    fig.positions.some((possFig) => {
                        const thisX = thisPos[0] + possThis[0];
                        const thisY = thisPos[1] + possThis[1];
                        const figX = fig.Pos[0] + possFig[0];
                        const figY = fig.Pos[1] + possFig[1];
                        return thisX === figX && thisY === figY;
                    })
                )
            );
        }
    }

    const FiguresMasks: ReadonlyArray<FigureMaks> = [

        [[1, 0],
        [1, 1]],

        [[1, 1],
        [1, 1]],

        [[1, 1, 1]]
    ]

    const Colors: ReadonlyArray<Color> = [
        'blue',
        'green',
        'gray'
    ]

    const squareSize: Vector = [50, 50]
    const canvas = document.getElementById(canvasId)! as HTMLCanvasElement
    const context = canvas.getContext('2d')!;

    let currentFigure = new Figure(FiguresMasks[Math.floor(Math.random() * FiguresMasks.length)], Colors[Math.floor(Math.random() * Colors.length)])
    let storredFirures: Readonly<Figure>[] = []
    let gameOver: boolean = false
    setInterval(moveAndDraw, 500)

    window.addEventListener("keypress", (e: KeyboardEvent) => {
        switch (e.code) {
            case "KeyD":
                {
                    if (canvas.width / squareSize[0] - currentFigure.getWidth() > currentFigure.XPos)
                        currentFigure.XPos += 1
                    break;
                }
            case "KeyA":
                {
                    if (currentFigure.XPos > 0)
                        currentFigure.XPos -= 1
                    break;
                }
            case "KeyS":
                {
                    moveAndDraw()
                    break;
                }
        }
        draw()
    })

    draw();

    function draw() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        currentFigure.draw()
        storredFirures.forEach(fig => {
            fig.draw()
        });
    }

    function moveAndDraw() {
        if (gameOver) {
            return
        }
        currentFigure.moveDown()
        if (currentFigure.isDown()) {
            storredFirures.push(currentFigure)
            currentFigure = new Figure(FiguresMasks[Math.floor(Math.random() * FiguresMasks.length)], Colors[Math.floor(Math.random() * Colors.length)])
            gameOver = currentFigure.checkCollision()
            if (gameOver) {
                onGameOver()
            }
        }
        draw()
    }
}
RunTetris("canvas", () => {
    alert("game over")
    RunTetris("canvas")
})