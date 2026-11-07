import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { type IContent } from './content_class';

const contentClasses = loadContentClasses()

/** Called once at startup, before the server begins accepting requests. */
export async function loadContentClasses() {
    const directory = path.resolve(__dirname, '../content');
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    const contentClasses = new Map<string, IContent>();
    await Promise.all(
        entries.map(async (entry) => {
            if (!entry.isDirectory()) return;
            const file = path.join(directory, entry.name, 'server.js');
            try {
                const instance: IContent = await fs.promises.access(file)
                    .then(async v => new (await import(file)).default(entry.name))
                contentClasses.set(entry.name, instance);
            } catch (error) {
                console.error(`Unable to load content ${entry.name}:`, error);
            }
        })
    )
    return contentClasses
}

export async function getContentClass(name: string): Promise<IContent | undefined> {
    return (await contentClasses).get(name);
}

export async function getContentEntries(): Promise<[string, IContent][]> {
    return [...(await contentClasses)];
}

export async function getVisibleContent(request: Request) {
    return (await getContentEntries()).filter(([name, content]) => {
        try { return content.mayShow(request) === true; }
        catch (error) { console.error(`Unable to check content ${name}:`, error); return false; }
    });
}

