import { Router, type Request, type Response } from 'express';
import { getVisibleContent } from './content-registry';

export const apiRouter = Router();

apiRouter.get('/locale', (req, res, next) => {
    const { code, lang } = req.query;
    if (code == null || lang == null) { next(); return; }
    const codes = Array.isArray(code) ? code : [code];
    if (typeof lang !== 'string' || !codes.every(value => typeof value === 'string')) {
        res.sendStatus(400);
        return;
    }
    const result: Record<string, string> = Object.create(null);
    for (const code of codes) result[code as string] = res.__({ phrase: code as string, locale: lang });
    res.json(result);
});

export function sitemap(req: Request, res: Response): void {
    const urls = getVisibleContent(req).map(([name]) =>
        `<url><loc>https://js.maserplay.ru/content/${encodeURIComponent(name)}</loc><priority>0.8</priority></url>`);
    res.type('application/xml').send(
        `<?xml version='1.0' encoding='UTF-8' ?>` +
        `<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>` +
        `<url><loc>https://js.maserplay.ru</loc><priority>1.0</priority></url>` + urls.join('') + '</urlset>');
}

