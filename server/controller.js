const index = require("../index")
const fs = require("fs");
const morgan = require('morgan')
const config = require("../config")
const ejs = require("ejs")

const app = index.app

app.use("/", require("express").static("static"));
var favicon_name = "favicon-default"
switch (config.getEvents()[0]) {
    case "snow":
        favicon_name = "favicon-snow"
        break;
}
app.use("/favicon.svg", require("express").static(`static/${favicon_name}.svg`))
app.use("/favicon.ico", require("express").static(`static/${favicon_name}.ico`))
app.use(morgan('combined'))
app.use(require("cookie-parser")())
app.use(index.i18n.init)
app.use(require("./middleware"))
app.use(require("compression")())

app.get("/", (req, res) => {
    var content = fs.readdirSync("./views/content").map(dirent => ({id: dirent, name: res.__(dirent)}))
    if (!config.IsEventGoing("snow")){
        content = content.filter(item => !(item.id=="snow_extension"))
    }
    res.render("index", { 
        "eachcontent": content, 
        "name": res.__("Index"), 
        "description": res.__("Things in Javascript") 
    });
});
app.get("/content/voice_chat/*", async (req, res, next)=>{
    const page = !req.params[0].replace("/", "") ? "main":escapeHtml(req.params[0].replace("/", "")).toLowerCase()
    if (fs.existsSync("./views/content/voice_chat/content/"+page+".ejs")) {
        res.render("content/voice_chat", {
            "name": res.__("voice_chat"),
            "description": res.__(`voice_chat description`),
            "Main": await ejs.renderFile("./views/content/voice_chat/content/main.ejs", {
                __: res.__
            }),
            "Settings": await ejs.renderFile("./views/content/voice_chat/content/settings.ejs", {
                __: res.__,
                settings_json: config.json.voice_chat.settings
            }),
            "open_page": !req.params[0].replace("/", "") ? "Main":capitalizeFirstLetter(escapeHtml(req.params[0].replace("/", "")))
        })
        return
    }
    next()
})
app.get("/content/snow_extension", (req, res, next) => {
    const name = req.params[0].replace("/", "")
    if (config.IsEventGoing("snow"))
    {
        res.render("content/" + name, {
            "name": res.__(name), 
            "description": res.__(`${name} description`)
        })
        return
    }
    next()
})
app.get('/content/*', (req, res, next) => {
    const name = req.params[0].replace("/", "")
    if (fs.existsSync("./views/content/" + name))
    {
        res.render("content/" + name, {
            "name": res.__(name), 
            "description": res.__(`${name} description`)
        })
        return
    }
    next()
})

app.use(function (req, res) {
    res.status(404).render("404", { "name": "404" });
});
function escapeHtml(str) {
  return String(str)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#x60;');
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}