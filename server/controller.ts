import * as index from '../index';
import * as fs from 'fs';
import express from "express";
import * as path from 'path';
import { Content, IContent, Style } from "./content_class";
import getByReq from './device';

const app = index.default.app

export var content_classes: Map<string, IContent> = new Map<string, IContent>()

fs.readdirSync(path.resolve("./content")).forEach(async (name) => { // import all modules
    const filePath = path.join(__dirname, "..", "./content", name, "server.js")
    if (fs.existsSync(filePath)) {
        content_classes.set(name, new ((await import(filePath)).default)(name));
    } else {
        content_classes.set(name, new Content(name));
    }
});

function getContentClass(name: string): IContent {
    return content_classes.get(name)!
}

function isSiteSupport(req: express.Request) {
    const device = getByReq.getByReq(req)
    return !(device?.bot || ["desktop", "smartphone", "tablet"].includes(device?.device?.type ?? ""))
}
function sendSiteSupportStatus(req: express.Request, res: express.Response, next : express.NextFunction) {
    if (isSiteSupport(req))
    {
        res.status(400)
        next()
        return true
    }
}

app.use("/", express.static("static"));
app.use("/content", express.static("content"));

app.get("/", (req, res, next) => {
    if (sendSiteSupportStatus(req,res, next)) return
    
    const content = fs.readdirSync("./content").filter(item => getContentClass(item).mayShow(req)).map(dirent => ({ id: dirent, name: res.__(dirent) }))
    content.sort((a,b)=>{
        return getContentClass(a.id).createdAt() < getContentClass(b.id).createdAt() ? 1 : -1
    })
    res.render("index", {
        "eachcontent": content,
        "name": res.__("Index"),
        "description": res.__("Things in Javascript"),
        "styleOfPage": Style.Standart
    });
});

app.get("/sitemap.xml", (req, res) => {
    const content = fs.readdirSync("./content").filter(item => getContentClass(item).mayShow(req));
    var returnXml = "<?xml version='1.0' encoding='UTF-8' ?>";
    returnXml += "<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>";
    returnXml += "<url><loc>https://js.maserplay.ru</loc><priority>1.0</priority></url>";
    content.forEach(cont => {
        returnXml += `<url><loc>https://js.maserplay.ru/content/${cont}</loc><priority>0.8</priority></url>`;
    });
    returnXml += "</urlset>";
    res.type('application/xml');
    res.send(returnXml);
})

app.get('/content/*',async (req, res, next) => {
    if (sendSiteSupportStatus(req,res, next)) return
    const paramPage = (<string[]>req.params)[0];
    const name = paramPage.replace("/", "")
    if (fs.existsSync("./content/" + name)) {
        const contentClass = getContentClass(name)
        const mayShow = contentClass.mayShow(req)
        if (typeof mayShow == 'number')
        {
            res.statusCode = (mayShow)
            return
        } else if (typeof mayShow == 'boolean' && mayShow) {
            res.render("../content/" + name, Object.assign({
                "name": res.__(name),
                "description": res.__(`${name} description`),
                "styleOfPage": contentClass.style(req)
            }, await contentClass.extendedOptions(req)))
            return
        }
    }
    next()
})


app.get('/api/locale', (req, res, next) => {
    if (sendSiteSupportStatus(req,res, next)) return
    if (req.query == null || req.query.code == null || req.query.lang == null) {
        next()
    } else {
        res.send(index.default.i18n.__({ phrase: <string>req.query.code, locale: <string>req.query.lang }))
    }
})

app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    if (res.headersSent) return; // We don't do anything if the response has already been sent.
    res.statusCode = res.statusCode === 200 ? 404 : res.statusCode;
    type ErrorInfo = {name: string, description:string}

    let status : ErrorInfo;
    if (err)
    {
        res.status(500)
        if (err instanceof Error)
        {
            status = {"name": err.name + ": " + err.message, "description": (err.stack ?? "")}
        } else {
            status = {"name": `${res.statusCode}`, "description": `${err}`}
        }
    } else {
        status = {"name": res.statusCode.toString(), "description": res.__(`${res.statusCode}/Text`)}
    }
    return res.render("error", Object.assign(status, {"styleOfPage": Style.Standart}));
});