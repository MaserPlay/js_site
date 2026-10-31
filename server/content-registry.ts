import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Content, type IContent } from './content_class';

const contentClasses = new Map<string, IContent>();

/** Called once at startup, before the server begins accepting requests. */
export async function loadContentClasses(): Promise<void> {
    const directory = path.resolve(__dirname, '../content');
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    contentClasses.clear();
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const file = path.join(directory, entry.name, 'server.js');
        try {
            const instance: IContent = fs.existsSync(file)
                ? new (await import(file)).default(entry.name)
                : new Content(entry.name);
            contentClasses.set(entry.name, instance);
        } catch (error) {
            console.error(`Unable to load content ${entry.name}:`, error);
        }
    }
}

export function getContentClass(name: string): IContent | undefined {
    return contentClasses.get(name);
}

export function getContentEntries(): [string, IContent][] {
    return [...contentClasses];
}

export function getVisibleContent(request: Request) {
    return getContentEntries().filter(([name, content]) => {
        try { return content.mayShow(request) === true; }
        catch (error) { console.error(`Unable to check content ${name}:`, error); return false; }
    });
}

