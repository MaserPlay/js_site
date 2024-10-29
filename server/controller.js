const index = require("../index")
const fs = require("fs");
const morgan = require('morgan')
const config = require("../config")

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
    res.render("index", { 
        "eachcontent": fs.readdirSync("./views/content").map(dirent => ({id: dirent, name: res.__(dirent)})), 
        "name": res.__("Index"), 
        "description": res.__("Things in Javascript") 
    });
});
app.get('/content/*', (req, res, next) => {
    if (fs.existsSync("./views/content/" + req.params[0])) {
        res.render("content/" + req.params[0], {
            "name": res.__(req.params[0].replace("/", "")), 
            "description": res.__(`${req.params[0].replace("/", "")} description`)
        })
        return
    }
    next()
})

app.use(function (req, res) {
    res.status(404).render("404", { "name": "404" });
});