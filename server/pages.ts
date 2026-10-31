import { Router, type Request, type Response, type NextFunction } from 'express';
import { Style, renderPage, type PageOptions } from './content_class';
import { getContentClass, getVisibleContent } from './content-registry';

interface HomePageOptions extends PageOptions {
    eachcontent: { id: string; name: string }[];
}

export const pagesRouter = Router();

pagesRouter.get('/', (req, res) => {
    const content = getVisibleContent(req).sort(([, a], [, b]) =>
        b.createdAt().getTime() - a.createdAt().getTime());
    renderPage<HomePageOptions>(res, 'index', {
        eachcontent: content.map(([id]) => ({ id, name: res.__(id) })),
        name: res.__('Index'),
        description: res.__('Things in Javascript'),
        styleOfPage: Style.Standart
    });
});

pagesRouter.get('/content/:path', async (req, res, next) => {
    const name = req.params.path;
    const content = getContentClass(name);
    if (!content) { next(); return; }
    try {
        const access = content.mayShow(req);
        if (typeof access === 'number') { res.status(access); next(); return; }
        if (!access) { next(); return; }
        
        renderPage(res, '../content/' + name, {
            name: res.__(name),
            description: res.__(`${name} description`),
            styleOfPage: content.style(req),
            ...await content.extendedOptions(req)
        });
    } catch (error) { next(error); }
});

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
    if (res.headersSent) { next(error); return; }
    if (error) res.status(500);
    else if (res.statusCode === 200) res.status(404);

    if (error instanceof Error) {
        renderPage(res, 'error', { 
            name: error.name + ': ' + error.message, 
            description: error.stack ?? '', 
            styleOfPage: Style.Standart 
        });
    } else if (error) {
        renderPage(res, 'error', { 
            name: String(res.statusCode), 
            description: String(error), 
            styleOfPage: Style.Standart 
        });
    } else {
        renderPage(res, 'error', { 
            name: String(res.statusCode), 
            description: res.__(`${res.statusCode}/Text`), 
            styleOfPage: Style.Standart 
        });
    }
}
