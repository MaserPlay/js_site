function RunTetris(canvasId, onGameOver) {
    if (onGameOver === void 0) { onGameOver = function () { alert("game over"); }; }
    var RotateFigure;
    (function (RotateFigure) {
        RotateFigure[RotateFigure["LEFT"] = 0] = "LEFT";
        RotateFigure[RotateFigure["DOWN"] = 1] = "DOWN";
        RotateFigure[RotateFigure["RIGHT"] = 2] = "RIGHT";
        RotateFigure[RotateFigure["UP"] = 3] = "UP";
    })(RotateFigure || (RotateFigure = {}));
    ;
    var Figure = /** @class */ (function () {
        function Figure(array, style) {
            this._position = [canvas.width / 2 / squareSize[0], 0];
            this._rotate = RotateFigure.UP;
            this._positions_mask = array;
            this.style = style;
        }
        Object.defineProperty(Figure.prototype, "XPos", {
            get: function () {
                return this._position[0];
            },
            set: function (val) {
                if (this.checkCollision([val, this.YPos])) {
                    return;
                }
                else {
                    this._position[0] = val;
                }
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Figure.prototype, "YPos", {
            get: function () {
                return this._position[1];
            },
            set: function (val) {
                if (this.checkCollision([this.XPos, val])) {
                    return;
                }
                else {
                    this._position[1] = val;
                }
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Figure.prototype, "Pos", {
            get: function () {
                return [this.XPos, this.YPos];
            },
            set: function (val) {
                this._position = val;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Figure.prototype, "rotate", {
            get: function () {
                return this._rotate;
            },
            set: function (r) {
                this._rotate = r;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Figure.prototype, "positionsMask", {
            get: function () {
                return this._positions_mask;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Figure.prototype, "positions", {
            get: function () {
                var final = [];
                for (var XPos = 0; XPos < this.positionsMask.length; XPos++) {
                    for (var YPos = 0; YPos < this.positionsMask[XPos].length; YPos++) {
                        if (this.positionsMask[XPos][YPos])
                            final.push([YPos, XPos]);
                    }
                }
                return final;
            },
            enumerable: false,
            configurable: true
        });
        Figure.prototype.moveDown = function () {
            if (canvas.height / squareSize[1] - this.getHeight() > this.YPos)
                this.YPos += 1;
        };
        Figure.prototype.isDown = function () {
            return !(canvas.height / squareSize[1] - this.getHeight() > this.YPos) || this.checkCollision([this.XPos, this.YPos + 1]);
        };
        Figure.prototype.draw = function () {
            var _this = this;
            context.fillStyle = this.style;
            this.positions.forEach(function (pos) {
                context.fillRect((_this.XPos + pos[0]) * squareSize[0], (_this.YPos + pos[1]) * squareSize[1], squareSize[0], squareSize[1]);
            });
        };
        Figure.prototype.getWidth = function () {
            return this.positionsMask[0].length;
        };
        Figure.prototype.getHeight = function () {
            return this.positionsMask.length;
        };
        /**
         * check collision of this and another figures
         * @returns true if have collision
         */
        Figure.prototype.checkCollision = function (thisPos) {
            var _this = this;
            if (thisPos === void 0) { thisPos = this.Pos; }
            return storredFirures.some(function (fig) {
                return _this.positions.some(function (possThis) {
                    return fig.positions.some(function (possFig) {
                        var thisX = thisPos[0] + possThis[0];
                        var thisY = thisPos[1] + possThis[1];
                        var figX = fig.Pos[0] + possFig[0];
                        var figY = fig.Pos[1] + possFig[1];
                        return thisX === figX && thisY === figY;
                    });
                });
            });
        };
        return Figure;
    }());
    var FiguresMasks = [
        [[1, 0],
            [1, 1]],
        [[1, 1],
            [1, 1]],
        [[1, 1, 1]]
    ];
    var Colors = [
        'blue',
        'green',
        'gray'
    ];
    var squareSize = [50, 50];
    var canvas = document.getElementById(canvasId);
    var context = canvas.getContext('2d');
    var currentFigure = new Figure(FiguresMasks[Math.floor(Math.random() * FiguresMasks.length)], Colors[Math.floor(Math.random() * Colors.length)]);
    var storredFirures = [];
    var gameOver = false;
    setInterval(moveAndDraw, 500);
    window.addEventListener("keypress", function (e) {
        switch (e.code) {
            case "KeyD":
                {
                    if (canvas.width / squareSize[0] - currentFigure.getWidth() > currentFigure.XPos)
                        currentFigure.XPos += 1;
                    break;
                }
            case "KeyA":
                {
                    if (currentFigure.XPos > 0)
                        currentFigure.XPos -= 1;
                    break;
                }
            case "KeyS":
                {
                    moveAndDraw();
                    break;
                }
        }
        draw();
    });
    draw();
    function draw() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        currentFigure.draw();
        storredFirures.forEach(function (fig) {
            fig.draw();
        });
    }
    function moveAndDraw() {
        if (gameOver) {
            return;
        }
        currentFigure.moveDown();
        if (currentFigure.isDown()) {
            storredFirures.push(currentFigure);
            currentFigure = new Figure(FiguresMasks[Math.floor(Math.random() * FiguresMasks.length)], Colors[Math.floor(Math.random() * Colors.length)]);
            gameOver = currentFigure.checkCollision();
            if (gameOver) {
                onGameOver();
            }
        }
        draw();
    }
}
RunTetris("canvas", function () {
    alert("game over");
    RunTetris("canvas");
});
