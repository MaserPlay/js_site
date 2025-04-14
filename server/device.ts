import DeviceDetector from "device-detector-js";
import { Request } from "express";

export = {
    getByStr: getDeviceByStr,
    getByReq: getDeviceByReq
}
function getDeviceByStr(str: string) {
    const deviceDetector = new DeviceDetector();
    return deviceDetector.parse(str);
}
function getDeviceByReq(req: Request) {
    const user_agent = req.get('User-Agent')
    if (user_agent)
    {
        return getDeviceByStr(user_agent)
    } else {
        return undefined
    }
}