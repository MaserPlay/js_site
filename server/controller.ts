import * as index from '../index';
import * as fs from 'fs';
import * as config from '../config';
import * as ejs from 'ejs';
import express from "express";

const app = index.default.app

app.use("/", express.static("static"));
app.use("/content", express.static("content"));

app.get("/", (req, res) => {
    var content = fs.readdirSync("./content").map(dirent => ({ id: dirent, name: res.__(dirent) }))
    if (req.get('User-Agent')!.match(/(iPhone|iPod|iPad|Android|BlackBerry)/)) {
        content = content.filter(item => !(item.id == "Games"))
    }
    res.render("index", {
        "eachcontent": content,
        "name": res.__("Index"),
        "description": res.__("Things in Javascript")
    });
});

app.get('/content/Games', (req, res, next) => {
    if (req.get('User-Agent')!.match(/(iPhone|iPod|iPad|Android|BlackBerry)/)) {
        res.sendStatus(403);
    }
    res.render("../content/Games", {
        "name": res.__("Games"),
        "description": res.__(`Games description`)
    })
})

app.get("/content/voice_chat/*", async (req, res, next) => {
    const paramPage = (<string[]>req.params)[0];
    const page = !paramPage.replace("/", "") ? "main" : escapeHtml(paramPage.replace("/", "")).toLowerCase()
    if (fs.existsSync("./content/voice_chat/content/" + page + ".ejs")) {
        res.render("../content/voice_chat", {
            "name": res.__("voice_chat"),
            "description": res.__(`voice_chat description`),
            "Main": await ejs.renderFile("./content/voice_chat/content/main.ejs", {
                __: res.__
            }),
            "Settings": await ejs.renderFile("./content/voice_chat/content/settings.ejs", {
                __: res.__,
                settings_json: config.json.voice_chat.settings
            }),
            "open_page": !paramPage.replace("/", "") ? "Main" : capitalizeFirstLetter(escapeHtml(paramPage.replace("/", "")))
        })
        return
    }
    next()
})
app.get("/content/snow_extension", (req, res, next) => {
    const name = "snow_extension";
    if (config.IsEventGoing("snow")) {
        res.render("../content/" + name, {
            "name": res.__(name),
            "description": res.__(`${name} description`)
        })
        return
    }
    next()
})
app.get('/content/*', (req, res, next) => {
    const paramPage = (<string[]>req.params)[0];
    const name = paramPage.replace("/", "")
    if (fs.existsSync("./content/" + name)) {
        res.render("../content/" + name, {
            "name": res.__(name),
            "description": res.__(`${name} description`)
        })
        return
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

function escapeHtml(str: string) {
    return String(str)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#x60;');
}
function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}