import express from 'express';
import { siteSupport } from './middleware';
import { pagesRouter, errorHandler } from './pages';
import { apiRouter, sitemap } from './api';

/** Registration order: public files, sitemap, device check, dynamic routes, errors. */
export function registerRoutes(app: express.Express): void {
    app.use('/', express.static('static'));
    app.use('/content', express.static('content'));
    app.get('/sitemap.xml', sitemap);
    app.use(siteSupport);
    app.use(pagesRouter);
    app.use('/api', apiRouter);
    app.use((req, res, next) => { errorHandler(null, req, res, next); });
    app.use(errorHandler);
}
