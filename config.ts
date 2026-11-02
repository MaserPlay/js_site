import * as jsonConfig from "./config/default.json"

var getEvents = ()=>{
    var final : string[] = []

    const now = new Date();

    for (const [eventKey, event] of Object.entries(jsonConfig.events)) {
        const start = new Date(now.getFullYear(), event.start.month - 1, event.start.day)
        const end = new Date(now.getFullYear(), event.end.month - 1, event.end.day)

        const active = start < end
            ? now >= start && now < end
            : now >= start || now < end;

        if (active){
            final.push(eventKey)
        }
    }
    return final
}
export {
    jsonConfig as json,
    getEvents,
} 
export function IsEventGoing(name : string){
    return getEvents().includes(name)
}