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
    private lastModificationDate : Date | undefined
    private createdAtDate : Date | undefined
    constructor(name : Readonly<string>){
        this.name = name;
        this.calcDates();
    }
    mayShow(req: Readonly<Request>){
        return true
    }
    async extendedOptions(req: Readonly<Request>){
        return {}
    }
    createdAt(){
        return this.createdAtDate ?? new Date(0)
    }
    lastModification(){
        return this.lastModificationDate ?? new Date(0)
    }
    private async calcDates() {
        console.log("")
        console.log(`Requesting to "https://api.github.com/repos/MaserPlay/js_site/commits?path=content/${this.name}"`)
        const githubCommitInfo = await fetch(`https://api.github.com/repos/MaserPlay/js_site/commits?path=content/${this.name}`);
        if (!githubCommitInfo.ok)
        {
            console.error(`Github sent an unsuccessful response to "https://api.github.com/repos/MaserPlay/js_site/commits?path=content/${this.name}" response.\n ${githubCommitInfo.status}\n${await githubCommitInfo.text() ?? ""}`)
            return
        }
        const data : GitHubCommits | undefined | any = await githubCommitInfo.json()
        if (!isGitHubCommits(data))
        {
            console.error(`Github sent not GitHubCommits to "https://api.github.com/repos/MaserPlay/js_site/commits?path=content/${this.name}" response.\n ${githubCommitInfo.status}\n${await githubCommitInfo.text() ?? ""}`)
            return
        }
        this.lastModificationDate = new Date(data[0].commit.committer.date)
        this.createdAtDate = new Date(data.at(-1)!.commit.committer.date)
        console.log(`Last modification date of ${this.name} (from github) is ${this.lastModificationDate}`)
        console.log(`Creation date of ${this.name} (from github) is ${this.createdAtDate}`)
        console.log("")
    }
}
function isGitHubCommit(obj: any): obj is GitHubCommit {
    return obj && typeof obj === 'object' &&
        typeof obj.sha === 'string' &&
        typeof obj.node_id === 'string' &&
        typeof obj.commit === 'object' &&
        typeof obj.url === 'string' &&
        typeof obj.html_url === 'string' &&
        typeof obj.comments_url === 'string' &&
        // Можно добавить более детальные проверки для вложенных объектов
        // если это критично для вашего приложения
        Array.isArray(obj.parents);
}
function isGitHubCommits(data: any): data is GitHubCommits {
    return Array.isArray(data) && 
           (data.length === 0 || isGitHubCommit(data[0]));
}