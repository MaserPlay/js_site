import * as fs from 'fs';
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
export {
    json,
    getEvents,
} 
export function IsEventGoing(name : string){
    return getEvents().includes(name)
}