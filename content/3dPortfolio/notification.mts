type NotificationKind = 'error' | 'warn' | 'log';

function alert(kind: NotificationKind, msg: string) {
    let bootstrapColor = (() => {
        switch (kind) {
            case 'error':
                return "danger"
            case 'warn':
                return "warning"
            case 'log':
                return "info"
        }
    })()
    const html = `<div class="toast align-items-center text-bg-${bootstrapColor} border-0" role="alert" aria-live="assertive" aria-atomic="true">
  <div class="d-flex">
    <div class="toast-body">
      ${escapeHtml(msg)}
    </div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
  </div>
</div>`
    const container = document.querySelector('.toast-container')!;

    container.insertAdjacentHTML('beforeend', html);

    const element = container.lastElementChild as HTMLElement;
    window.bootstrap.Toast.getOrCreateInstance(element).show();
}

export function addExecptionListeners() {
    window.addEventListener("error", (event) => {
        errorAlert(event.error ?? new Error(event.message));
    });

    // Необработанные ошибки Promise
    window.addEventListener("unhandledrejection", (event) => {
        errorAlert(event.reason);
    });
}

export function error(msg: unknown) {
    console.error(msg)
    errorAlert(msg)
}
export function warn(msg: unknown) {
    console.warn(msg)
    warnAlert(msg)
}
export function log(msg: unknown) {
    console.log(msg)
    logAlert(msg)
}

export function errorAlert(msg: unknown) {
    alert('error', String(msg))
}
export function warnAlert(msg: unknown) {
    alert('warn', String(msg))
}
export function logAlert(msg: unknown) {
    alert('log', String(msg))
}