const express = require("express");
const expressLayouts = require('express-ejs-layouts');
const ejs = require('ejs')
const path = require('path')
const I18n = require('i18n')
const config = require("./config")
const morgan = require('morgan')
const ioServer = require("socket.io").Server; // Импортируйте класс Server

const app = express();
const httpServer = require("node:http").createServer(app);
const io = new ioServer(httpServer)

//mini js
const fs = require("fs");
var UglifyJS = require("uglify-js");
var minijs = (name)=>{fs.writeFileSync(name + ".min.js", UglifyJS.minify(fs.readFileSync(name + ".js", "utf8")).code, "utf8");}

const filePath = `./static/index.js`;
if (fs.existsSync(filePath)) {
  minijs(filePath.replace(".js", ""));
}

fs.readdirSync("./content").forEach((dirent) => {
  const filePath = `../content/${dirent}/index.js`;
  if (fs.existsSync(filePath)) {
    minijs(filePath.replace(".js", ""));
  }
});


const i18n = new I18n.I18n({
  locales: config.json.locales, 
  defaultLocale: 'en',
  cookie: 'lang',
  directory: path.join(__dirname, 'locales'),
  queryParameter: 'lang',
  retryInDefaultLocale : true,
  directoryPermissions: 0o755, // <-- Здесь задаются права
})

app.use(expressLayouts);
app.engine("ejs", ejs.renderFile);
app.set("view engine", "ejs");
app.set("layout", "./base/main.ejs");
app.use(morgan('combined'))
app.use(require("cookie-parser")())
app.use(i18n.init)
app.use(require("./server/middleware"))
app.use(require("compression")())
var favicon_name = "favicon-default"
switch (config.getEvents()[0]) {
    case "snow":
        favicon_name = "favicon-snow"
        break;
}
app.use("/favicon.svg", require("express").static(`static/${favicon_name}.svg`))
app.use("/favicon.ico", require("express").static(`static/${favicon_name}.ico`))


module.exports = {
  app: app,
  httpServer: httpServer,
  i18n: i18n,
  io: io,
  Server: httpServer.listen(config.json.port, () => {console.log(`Server running on port ${config.json.port}; http://localhost:${config.json.port}`);})
};

fs.readdirSync(path.resolve(__dirname, "./server")).forEach((file) => {
  if (file.endsWith(".js")) {
    const filePath = path.join(__dirname, "server", file);
    require(filePath);
  }
});
