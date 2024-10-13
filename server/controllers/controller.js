const app = require("../../index").app
const fs = require("fs");
const morgan = require('morgan')

app.use(morgan('combined'))

app.get("/" , (req , res)=>{
        res.render("index", {"content": fs.readdirSync("./views/content").map(dirent => dirent), "name": "Index"});
    });
app.get('/content/*', (req,res) => {
    res.render("content/" + req.params[0], {"name": req.params[0].replaceAll("/", "")})
   })

app.use(function(req,res){
    res.status(404).render("404");
});