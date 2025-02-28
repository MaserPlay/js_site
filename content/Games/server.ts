import { Content, IContent } from "../../server/content_class";
import { Request, Response, NextFunction } from 'express';

export default class extends Content {
    mayShow(req: Readonly<Request>) : boolean{
        return !req.get('User-Agent')!.match(/(iPhone|iPod|iPad|Android|BlackBerry)/)
    }
    createdAt(){
        return new Date(2025, 2, 14)
    }
}