const http = require("http");
const fs = require("fs");
const morgan = require('morgan')
const express = require("express");
const handlebars = require("express-handlebars");

const port = 3000
const app = express();
// var router = express.Router();

const customHandlebars = handlebars.create({ layoutsDir: "./views",defaultLayout: './base/main'});

app.engine("handlebars", customHandlebars.engine);
app.set("view engine", "handlebars");
app.use("/", express.static("static"));


http.createServer(app).listen(port, () => {
console.log(`Server running on port ${port}`);
});

app.use(morgan('combined'))

app.get("/" , (req , res)=>{
        res.render("index", {"content": fs.readdirSync("./views/content").map(dirent => dirent)});
    });
app.get('/content/*', (req,res) => {
    res.render("content/" + req.params[0])
   })

app.use(function(req,res){
    res.status(404).render("404");
});

require("./voice_chat");