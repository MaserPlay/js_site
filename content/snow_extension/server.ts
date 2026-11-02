import { Content } from "../../server/content_class";
import { Request } from 'express';

export default class extends Content{
    mayShow(req: Readonly<Request>) : boolean{
        return req.get("User-Agent")?.includes("Firefox") != false;
    }
    createdAt(){
        return new Date(2024, 11, 20)
    }
    lastModification(){
        return new Date(2024, 11, 8)
    }
}