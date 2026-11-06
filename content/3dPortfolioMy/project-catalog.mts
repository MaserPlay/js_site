export type Project = {
    id: string; 
    name: string;
    description: string; 
    url: string; 
    repository: string | null;
    hidden: boolean; 
    archived: boolean; 
    created: string; 
    updated: string;
};
export type ProjectQuery = {
    sortBy: 'created' | 'last_update' | 'name'; 
    descending: boolean;
    onlyGithub: boolean; 
    archived: 'all' | 'active' | 'archived'
};

export const defaultQuery: ProjectQuery = { sortBy: 'created', descending: false, onlyGithub: false, archived: 'all' };

export function projectUrl(value: string): string | null {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        // The current API emits http links behind its HTTPS reverse proxy.
        if (url.hostname === 'maserplay.ru') url.protocol = 'https:';
        return url.href;
    } catch { return null; }
}

export function parseProjects(value: unknown): Project[] {
    if (!Array.isArray(value)) throw new Error('API проектов: ожидался массив');
    const ids = new Set<string>();
    return value.map(item => {
        if (!item || typeof item.technical_name !== 'string' || !item.technical_name || ids.has(item.technical_name) ||
            typeof item.name !== 'string' || typeof item.hidden !== 'boolean' || typeof item.archived !== 'boolean' ||
            typeof item.created !== 'string' || !Number.isFinite(Date.parse(item.created)) ||
            typeof item.last_update !== 'string' || !Number.isFinite(Date.parse(item.last_update))) throw new Error('API проектов: неверные данные/повторный ID');
        ids.add(item.technical_name);
        return {
            id: item.technical_name, name: item.name, description: String(item.description || ''), url: String(item.project_Page || ''),
            repository: typeof item.repository === 'string' ? item.repository : null, hidden: item.hidden, archived: item.archived,
            created: item.created, updated: item.last_update
        };
    });
}

/** Small explicit predicate table: add a filter here, not in the city loader. */
const filters: ((project: Project, query: ProjectQuery) => boolean)[] = [
    project => !project.hidden,
    (project, query) => !query.onlyGithub || project.repository !== null,
    (project, query) => query.archived === 'all' || project.archived === (query.archived === 'archived')
];
export function selectProjects(projects: Project[], query: ProjectQuery): Project[] {
    const selected = projects.filter(project => filters.every(filter => filter(project, query)));
    selected.sort((a, b) => {
        const order = query.sortBy === 'name' ? a.name.localeCompare(b.name) :
            Date.parse(query.sortBy === 'created' ? a.created : a.updated) - Date.parse(query.sortBy === 'created' ? b.created : b.updated);
        return (query.descending ? -order : order) || a.id.localeCompare(b.id);
    });
    return selected;
}

/** Assign the sorted, visible projects to Blender points in their exported order. */
export function assignProjects(projects: Project[], pointIds: readonly string[]): Map<string, Project> {
    return new Map(pointIds.slice(0, projects.length).map((pointId, index) => [pointId, projects[index]]));
}

export async function fetchProjects(apiUrl: string, query: ProjectQuery): Promise<Project[]> {
    const url = new URL(apiUrl, location.href);
    url.searchParams.set('show_hidden', 'false');
    url.searchParams.set('sort_by', query.sortBy);
    url.searchParams.set('sort_by_descend', String(query.descending));
    url.searchParams.set('only_github', String(query.onlyGithub));
    const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`API проектов: HTTP ${response.status}`);
    return parseProjects(await response.json());
}
