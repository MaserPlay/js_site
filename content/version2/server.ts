import { Request } from "express";
import { Content, Style } from "../../server/content_class";

// 3D version 2 of maserplay.ru: the floating garden of projects. Its pages (v2.ru.html, v2.en.html) and files beside
// this one are a static copy exported from the maserplay.ru repository (see README.md); the page shows the one in the
// visitor's language in a frame over the whole window.
export default class extends Content {
    style(_req: Readonly<Request>): Style {
        return Style.Bare
    }
    async extendedOptions(req: Readonly<Request>) {
        return { v2Page: req.getLocale?.() === "en" ? "v2.en.html" : "v2.ru.html" }
    }
    createdAt() {
        return new Date(2026, 9, 31)
    }
}
