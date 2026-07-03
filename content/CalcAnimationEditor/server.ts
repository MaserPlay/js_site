import { Content, Style } from "../../server/content_class";
import { Request } from "express";

export default class extends Content{
    style(_req: Readonly<Request>): Style {
        return Style.Fullscreen
    }
}