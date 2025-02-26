import express, { Express, Request, Response } from "express";
import * as expressLayouts from 'express-ejs-layouts';
import * as ejs from 'ejs';
import * as path from 'path';
import * as I18n from 'i18n';
import * as config from './config';
import * as fs from 'fs';
import * as morgan from 'morgan';
import * as node_http from 'node:http';
import * as compression from 'compression';
import * as cookie_parser from 'cookie-parser';
import * as middleware from './server/middleware';
import ioServer, { Server } from "socket.io"; // Импортируйте класс Server

const app = express();
const httpServer = node_http.createServer(app);
const io = new ioServer.Server(httpServer)


const i18n = new I18n.I18n({
  locales: config.json.locales,
  defaultLocale: 'en',
  cookie: 'lang',
  directory: path.join(__dirname, 'locales'),
  queryParameter: 'lang',
  retryInDefaultLocale: true,
  directoryPermissions: <string> <unknown>0o755, // <-- Здесь задаются права
})

app.use(expressLayouts.default);
app.engine("ejs", ejs.renderFile);
app.set("view engine", "ejs");
app.set("layout", "./base/main.ejs");
app.use(morgan.default('combined'))
app.use(cookie_parser.default())
app.use(i18n.init)
app.use(middleware.default)
app.use(compression.default())
var favicon_name = "favicon-default"
switch (config.getEvents()[0]) {
  case "snow":
    favicon_name = "favicon-snow"
    break;
}
app.use("/favicon.svg", express.static(`static/${favicon_name}.svg`))
app.use("/favicon.ico", express.static(`static/${favicon_name}.ico`))

const ex = {
  app: app,
  httpServer: httpServer,
  i18n: i18n,
  io: io,
  Server: httpServer.listen(config.json.port, () => { console.log(`Server running on port ${config.json.port}; http://localhost:${config.json.port}`); })
};

export default ex;

fs.readdirSync(path.resolve(__dirname, "./server")).forEach((file : string) => { // import all modules
  if (file.endsWith(".js")) {
    const filePath = path.join(__dirname, "server", file);
    require(filePath);
  }
});
