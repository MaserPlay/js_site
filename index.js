const express = require("express");
const handlebars = require("express-handlebars");
const path = require('path')
const I18n = require('i18n')
const config = require("./config")
const ioServer = require("socket.io").Server; // Импортируйте класс Server

const app = express();
const httpServer = require("node:http").createServer(app);
const io = new ioServer(httpServer)

//mini js
const fs = require("fs");
var UglifyJS = require("uglify-js");
var minijs = (name)=>{fs.writeFileSync(name + ".min.js", UglifyJS.minify(fs.readFileSync(name + ".js", "utf8")).code, "utf8");}
fs.readdirSync("./static/content").forEach((dirent) => {
  const filePath = `./static/content/${dirent}/index.js`;
  if (fs.existsSync(filePath)) {
    minijs(filePath.replace(".js", ""));
  }
});


const customHandlebars = handlebars.create({ layoutsDir: "./views",defaultLayout: './base/main'});

const i18n = new I18n.I18n({
  locales: config.json.locales, 
  defaultLocale: 'en',
  cookie: 'lang',
  directory: path.join(__dirname, 'locales'),
})

app.engine("handlebars", customHandlebars.engine);
app.set("view engine", "handlebars");


module.exports = {
  app: app,
  httpServer: httpServer,
  i18n: i18n,
  customHandlebars: customHandlebars,
  io: io,
  Server: httpServer.listen(config.json.port, () => {console.log(`Server running on port ${config.json.port}; http://localhost:${config.json.port}`);})
};

fs.readdirSync(path.resolve(__dirname, "./server")).forEach((file) => {
  if (file.endsWith(".js")) {
    const filePath = path.join(__dirname, "server", file);
    require(filePath);
  }
});
