import { Request, Response, NextFunction } from 'express';
export interface IContent{
    name : Readonly<string>;
    mayShow(req: Readonly<Request>) : boolean;
    extendedOptions(req: Readonly<Request>) : Promise<object>;
}
export class Content implements IContent{
    name : Readonly<string>;
    constructor(name : Readonly<string>){
        this.name = name;
    }
    mayShow(req: Readonly<Request>) : boolean{
        return true
    }
    async extendedOptions(req: Readonly<Request>) : Promise<object> {
        return {}
    }
}