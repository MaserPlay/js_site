const express = require("express");
const handlebars = require("express-handlebars");
const path = require('path')
const I18n = require('i18n')

const port = 3000
const app = express();
let httpServer = require("http").Server(app);

//mini js
const fs = require("fs");
var UglifyJS = require("uglify-js");
var minijs = (name)=>{fs.writeFileSync(name + ".min.js", UglifyJS.minify(fs.readFileSync(name + ".js", "utf8")).code, "utf8");}
fs.readdirSync("./static/content").map(dirent => dirent).forEach( (name)=>{
  var name = `./static/content/${name}/index`
  minijs(name)
})
minijs('./static/index')

const customHandlebars = handlebars.create({ layoutsDir: "./views",defaultLayout: './base/main'});

const i18n = new I18n.I18n({
  locales: ['en', 'ru'], 
  defaultLocale: 'en',
  cookie: 'lang',
  directory: path.join(__dirname, 'locales'),
})
module.exports = {
    app: app,
    httpServer: httpServer,
    i18n: i18n,
    customHandlebars: customHandlebars,
}

app.engine("handlebars", customHandlebars.engine);
app.set("view engine", "handlebars");

require("./server/voice_chat");

httpServer.listen(port, () => {
console.log(`Server running on port ${port}; http://localhost:${port}`);
});

require("./server/controller")