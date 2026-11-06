type NotificationKind = 'error' | 'warning' | 'success';

/** Bootstrap owns toast display; this object handles plain text and console output. */
export const notifications = (() => {
    function show(kind: NotificationKind, message: string, details?: unknown): void {
        const log = kind === 'error' ? console.error : kind === 'warning' ? console.warn : console.info;
        if (details === undefined) log.call(console, message);
        else log.call(console, message, details);

        const container = document.getElementById('notifications');
        if (!container) return;
        const element = document.createElement('div');
        element.className = 'toast border-0 text-bg-' + (kind === 'error' ? 'danger' : kind);
        element.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        element.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
        element.setAttribute('aria-atomic', 'true');

        const row = document.createElement('div');
        row.className = 'd-flex';
        const body = document.createElement('div');
        body.className = 'toast-body';
        body.textContent = message;
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-close me-2 m-auto' + (kind === 'warning' ? '' : ' btn-close-white');
        close.setAttribute('data-bs-dismiss', 'toast');
        close.setAttribute('aria-label', container.dataset.closeLabel!);
        row.append(body, close);
        element.append(row);
        container.append(element);

        const { Toast } = (window as Window & { bootstrap: typeof import('bootstrap') }).bootstrap;
        const toast = Toast.getOrCreateInstance(element, { autohide: kind !== 'error', delay: 8000 });
        element.addEventListener('hidden.bs.toast', () => {
            toast.dispose();
            element.remove();
        }, { once: true });
        toast.show();
    }
    return {
        error: (message: string, details?: unknown) => show('error', message, details),
        warning: (message: string, details?: unknown) => show('warning', message, details),
        success: (message: string) => show('success', message)
    };
})();
