const __ = (()=>{
  const localeCache = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();

  return function(code: string): Promise<string> {
    const lang = getLocale();

    const key = `${lang}:${code}`;

    if (localeCache.has(key)) {
        return Promise.resolve(localeCache.get(key)!);
    }

    if (pending.has(key)) {
        return pending.get(key)!;
    }

    const request = new Promise<string>((resolve, reject) => {
        $.ajax({
            url: "/api/locale",
            data: {
                code,
                lang
            }
        })
        .done((data: string) => {
          localeCache.set(key, data);
          pending.delete(key);
          resolve(data)
        })
        .fail((err: any) => {
          pending.delete(key);
          reject(err)
        });
    });

    pending.set(key, request);
    return request;
};
})()

function getLocale(): string {
    const cookie = document.cookie.match(/lang=([^;]+)/);
    const lang = cookie?.[1];

    return !lang || lang === "auto_locale"
        ? navigator.language
        : lang;
};
function setupFullscreen(
    fullscreenButton: string,
    fullscreenexitButton: string,
    fullscreenDiv: string
): void {

    const el = $(fullscreenDiv)[0] as HTMLElement;

    if (!el.requestFullscreen) {
        $(fullscreenButton).remove();
        $(fullscreenexitButton).hide();
        return;
    }

    const changeHandlerCallback = () => {
        if (document.fullscreenElement) {
            $(fullscreenButton).hide();
            $(fullscreenexitButton).show();
        } else {
            $(fullscreenexitButton).hide();
            $(fullscreenButton).show();
        }
    };

    document.addEventListener("fullscreenchange", changeHandlerCallback);

    $(fullscreenButton).on("click", () => {
        el.requestFullscreen();
    });

    $(fullscreenexitButton).on("click", () => {
        document.exitFullscreen();
    });
};
(() => {

    $('.scChngThm').on('click', function () {
        document.cookie = `theme=${$(this).attr("val")};path=/`;
        document.location.reload();
        return false;
    });

    $('.scChngLang').on('click', function () {
        document.cookie = `lang=${$(this).attr("val")};path=/`;
        document.location.reload();
        return false;
    });

    function getCookie(name: string): string | null {
        const cookie = document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='));

        return cookie ? cookie.split('=')[1] : null;
    }

    function getTheme(): string {
        return getCookie("theme") ?? "light";
    }

    $('#theme-change')
        .removeClass("bi-patch-question-fill");

    switch (getTheme()) {
        case 'light':
            $('#theme-change').addClass("bi-sun-fill");
            break;

        case 'dark':
            $('#theme-change').addClass("bi-moon-fill");
            break;

        default:
            console.error(`cannot find ${getTheme()} in this`);
            $('#theme-change').addClass("bi-patch-question-fill");
            break;
    }

    for (const popover of document.getElementsByClassName("popovers_cls")) {
        new bootstrap.Popover(popover as Element);
    }

})();