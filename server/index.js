const express = require("express");
const handlebars = require("express-handlebars");

const port = 3000
const app = express();
let httpServer = require("http").Server(app);
module.exports = app
module.exports = httpServer
// var router = express.Router();

const customHandlebars = handlebars.create({ layoutsDir: "./views",defaultLayout: './base/main'});

app.engine("handlebars", customHandlebars.engine);
app.set("view engine", "handlebars");
app.use("/", express.static("static"));

module.exports = {
    app: app,
    httpServer: httpServer
}
require("./voice_chat");

httpServer.listen(port, () => {
console.log(`Server running on port ${port}; http://localhost:${port}`);
});

require("./controllers/controller")