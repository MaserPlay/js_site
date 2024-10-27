const index = require("../../index")
const fs = require("fs");
const morgan = require('morgan')

const app = index.app

app.use("/", require("express").static("static"));
app.use(morgan('combined'))
app.use(require("cookie-parser")())
app.use(index.i18n.init)
app.use(require("../middleware").main)
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