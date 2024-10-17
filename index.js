const express = require("express");
const handlebars = require("express-handlebars");
const path = require('path')
const I18n = require('i18n')

const port = 3000
const app = express();
let httpServer = require("http").Server(app);
module.exports = app
module.exports = httpServer
// var router = express.Router();

const customHandlebars = handlebars.create({ layoutsDir: "./views",defaultLayout: './base/main'});

const i18n = new I18n.I18n({
  locales: ['en', 'ru'],
  directory: path.join(__dirname, 'locales')
})

app.engine("handlebars", customHandlebars.engine);
app.set("view engine", "handlebars");
app.use("/", express.static("static"));

module.exports = {
    app: app,
    httpServer: httpServer,
    i18n: i18n
}
require("./server/voice_chat");

httpServer.listen(port, () => {
console.log(`Server running on port ${port}; http://localhost:${port}`);
});

require("./server/controllers/controller")