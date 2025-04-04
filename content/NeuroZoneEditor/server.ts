import { Request } from "express";
import { Content, Style } from "../../server/content_class";

export default class extends Content{
    style(_req: Readonly<Request>): Style {
        return Style.Fullscreen
    }
}