const index = require("../index")
const fs = require("fs");
const config = require("../config")
const ejs = require("ejs")

const app = index.app

app.use("/", require("express").static("static"));
app.use("/content", require("express").static("content"));

app.get("/", (req, res) => {
    var content = fs.readdirSync("./content").map(dirent => ({id: dirent, name: res.__(dirent)}))
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
    if (fs.existsSync("./content/voice_chat/content/"+page+".ejs")) {
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
            "open_page": !req.params[0].replace("/", "") ? "Main":capitalizeFirstLetter(escapeHtml(req.params[0].replace("/", "")))
        })
        return
    }
    next()
})
app.get("/content/snow_extension", (req, res, next) => {
    const name = "snow_extension";
    if (config.IsEventGoing("snow"))
    {
        res.render("../content/" + name, {
            "name": res.__(name), 
            "description": res.__(`${name} description`)
        })
        return
    }
    next()
})
app.get('/content/*', (req, res, next) => {
    const name = req.params[0].replace("/", "")
    if (fs.existsSync("./content/" + name))
    {
        res.render("../content/" + name, {
            "name": res.__(name), 
            "description": res.__(`${name} description`)
        })
        return
    }
    next()
})

app.get('/api/locale', (req, res, next) => {
    if (req.query == null || req.query.code == null || req.query.lang == null)
    {
        next()
    } else {
        res.send(index.i18n.__(req.query.code, req.query.lang))
    }
})

app.use(function (req, res) {
    res.status(404).render("404", { "name": "404", "description": "404" });
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