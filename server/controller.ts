import * as index from '../index';
import * as fs from 'fs';
import express from "express";
import * as path from 'path';
import { Content, IContent, Style } from "./content_class";

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

app.use("/", express.static("static"));
app.use("/content", express.static("content"));

app.get("/", (req, res) => {
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
    const paramPage = (<string[]>req.params)[0];
    const name = paramPage.replace("/", "")
    if (fs.existsSync("./content/" + name)) {
        const contentClass = getContentClass(name)
        const mayShow = contentClass.mayShow(req)
        if (typeof mayShow == 'number')
        {
            res.sendStatus(mayShow)
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
    if (req.query == null || req.query.code == null || req.query.lang == null) {
        next()
    } else {
        res.send(index.default.i18n.__({ phrase: <string>req.query.code, locale: <string>req.query.lang }))
    }
})

app.use(function (req, res) {
    const status = 404
    res.status(status).render(status.toString(), { "name": status.toString(), "description": res.__(`${status}/Text`) });
});