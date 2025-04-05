import { Content, IContent } from "../../server/content_class";
import { Request, Response, NextFunction } from 'express';

export default class extends Content {
    mayShow(req: Readonly<Request>) : boolean{
        return this.isPc(req);
    }
    createdAt(){
        return new Date(2025, 2, 14)
    }
}