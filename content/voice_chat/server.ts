import { Content, IContent } from "../../server/content_class";
import { Request, Response, NextFunction } from 'express';
import * as config from '../../config';
import * as ejs from 'ejs';

export default class extends Content {
    mayShow(req: Readonly<Request>) : boolean{
        return !req.get('User-Agent')!.match(/(iPhone|iPod|iPad|Android|BlackBerry)/)
    }
    async extendedOptions(req: Readonly<Request>) : Promise<object>{
        var paramPage = req.params[0];
        paramPage = paramPage.substring(paramPage.indexOf('/'))
        return {
            "Main": await ejs.renderFile("./content/voice_chat/content/main.ejs", {
                __: req.__
            }),
            "Settings": await ejs.renderFile("./content/voice_chat/content/settings.ejs", {
                __: req.__,
                settings_json: config.json.voice_chat.settings
            }),
            "open_page": !paramPage.replace("/", "") ? "Main" : capitalizeFirstLetter(escapeHtml(paramPage.replace("/", "")))
        }
    }
}

function escapeHtml(str: string) {
    return String(str)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#x60;');
}
function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}