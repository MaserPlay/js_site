import { ui } from './viewer-ui.mjs';
import { notifications } from './notifications.mjs';
import {
    assignProjects, defaultQuery, fetchProjects, projectUrl, selectProjects,
    type Project, type ProjectQuery
} from './project-catalog.mjs';

interface ProjectPanelOptions {
    apiUrl: string;
    canEnter(): boolean;
    onVisit(pointId: string): void;
}

export interface ProjectPanel {
    readonly placements: ReadonlyMap<string, Project>;
    setPoints(pointIds: readonly string[]): void;
    updateSelection(): void;
    refresh(): Promise<void>;
}

/** The catalog and its controls know project IDs and point IDs, never scene meshes. */
export async function createProjectPanel(options: ProjectPanelOptions): Promise<ProjectPanel> {
    const noPointText = await __('City: $1 — no available city point');
    const summaryText = await __('City: API: $1 projects · $2 available points');
    let pointIds: readonly string[] = [];
    let catalog: Project[] = [];
    let placements = new Map<string, Project>();
    let latestRequest = 0;

    function query(): ProjectQuery {
        return {
            ...defaultQuery,
            sortBy: ui.projectSort.value as ProjectQuery['sortBy'],
            descending: ui.projectDescending.checked,
            onlyGithub: ui.projectGithub.checked,
            archived: ui.projectArchived.value as ProjectQuery['archived']
        };
    }

    function updateSelection(): void {
        const project = placements.get(ui.projectSelect.value);
        ui.projectVisit.disabled = !options.canEnter() || !project;
        ui.projectSummary.textContent = project
            ? new DOMParser().parseFromString(project.description, 'text/html').body.textContent
            : '';
        const url = project ? projectUrl(project.url) : null;
        ui.projectLink.hidden = !url;
        if (url) ui.projectLink.href = url;
        else ui.projectLink.removeAttribute('href');
    }

    function render(): void {
        const selectedProjectId = placements.get(ui.projectSelect.value)?.id;
        const visibleProjects = selectProjects(catalog, query());
        placements = assignProjects(visibleProjects, pointIds);
        const pointByProject = new Map([...placements].map(([pointId, project]) => [project.id, pointId]));
        const items = visibleProjects.map(project => {
            const pointId = pointByProject.get(project.id);
            const item = new Option(pointId ? project.name : formatString(noPointText, project.name),
                pointId ?? `unbound:${project.id}`);
            item.disabled = !pointId;
            return item;
        });
        ui.projectSelect.replaceChildren(...items);
        ui.projectSelect.disabled = !items.length;
        ui.projectSelect.value = (selectedProjectId ? pointByProject.get(selectedProjectId) : undefined)
            ?? items.find(item => !item.disabled)?.value ?? '';
        ui.projectStatus.textContent = formatString(summaryText, visibleProjects.length, placements.size);
        updateSelection();
    }

    async function refresh(): Promise<void> {
        const request = ++latestRequest;
        placements.clear();
        catalog = [];
        ui.projectSelect.replaceChildren();
        updateSelection();
        ui.projectRefresh.disabled = true;
        try {
            ui.projectStatus.textContent = await __('City: Refreshing projects…');
            const projects = await fetchProjects(options.apiUrl, { ...defaultQuery, onlyGithub: false });
            if (request !== latestRequest) return;
            catalog = projects;
            render();
        } catch (error) {
            if (request !== latestRequest) return;
            catalog = [];
            render();
            notifications.error(await __('City: Projects could not be loaded. Try refreshing them.'), error);
        } finally {
            if (request === latestRequest) ui.projectRefresh.disabled = false;
        }
    }

    ui.projectSelect.addEventListener('change', updateSelection);
    for (const control of [ui.projectSort, ui.projectDescending, ui.projectGithub, ui.projectArchived]) {
        control.addEventListener('change', render);
    }
    ui.projectRefresh.addEventListener('click', () => { void refresh(); });
    ui.projectVisit.addEventListener('click', () => {
        const pointId = ui.projectSelect.value;
        if (options.canEnter() && placements.has(pointId)) options.onVisit(pointId);
    });

    return {
        get placements() { return placements; },
        setPoints(ids) { pointIds = [...ids]; render(); },
        updateSelection,
        refresh
    };
}
