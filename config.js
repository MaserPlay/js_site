var fs = require('fs');
var configFolder = "./config"
var json = JSON.parse(fs.readFileSync(configFolder + "/default.json", 'utf8'))
var getEvents = ()=>{
    var final = []
    for(var eventkey in json.events) {
        var event = json.events[eventkey]
        if ((new Date(event.start) < new Date()) && (new Date(event.end) > new Date())){
            final.push(eventkey)
        }
    }
    return final
}
module.exports = {
    json: json,
    getEvents: getEvents,
    IsEventGoing: (name)=>{return getEvents().includes(name)}
} 