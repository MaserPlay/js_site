import express, { Express, Request, Response } from "express";
import * as expressLayouts from 'express-ejs-layouts';
import * as ejs from 'ejs';
import * as path from 'path';
import * as I18n from 'i18n';
import * as config from './config';
import { loadContentClasses } from './server/content-registry';
import { registerRoutes } from './server/controller';
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
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);
app.set("layout extractMetas", true);
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
  Server: httpServer
};

export default ex;

// The voice-chat module still uses the existing exported io instance.
require('./server/voice_chat');

async function start(): Promise<void> {
  await loadContentClasses();
  registerRoutes(app);
  httpServer.listen(config.json.port, () => {
    console.log(`Server running on port ${config.json.port}; http://localhost:${config.json.port}`);
  });
}

void start().catch(error => {
  console.error('Unable to start site:', error);
  process.exitCode = 1;
  io.close();
});
