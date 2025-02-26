import { Request, Response, NextFunction } from 'express';
export interface IContent{
    name : Readonly<string>;
    mayShow(req: Readonly<Request>) : boolean | number;
    extendedOptions(req: Readonly<Request>) : Promise<object>;
    lastModification() : Date;
    createdAt() : Date;
}
export class Content implements IContent{
    name;
    constructor(name : Readonly<string>){
        this.name = name;
    }
    mayShow(req: Readonly<Request>){
        return true
    }
    async extendedOptions(req: Readonly<Request>){
        return {}
    }
    createdAt(){
        return new Date(1900, 1)
    }
    lastModification(){
        return new Date(1900, 1)
    }
}