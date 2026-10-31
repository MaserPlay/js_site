const __ = (()=>{
    const localeCache = new Map<string, string>();
    const pending = new Map<string[], Promise<LocaleResponse>>();
    
    interface LocaleResponse {
        [code: string]: string;
    }
    
    interface LocalePromises {
        [code: string]: Promise<string> | null;
    }

    function translate(code: string): Promise<string>;
    function translate(code: string[]): Promise<LocaleResponse>;

    function translate(code: string | string[]): Promise<string | LocaleResponse> {
        const lang = getLocale();

        const formatKey = (lang:string, code:string) => `${lang}:${code}`

        const tryGetLocaleOrNull = (code:string) => {
            const key = formatKey(lang, code)
            if (localeCache.has(key)) {
                return Promise.resolve(localeCache.get(key)!);
            }

            try {
                const localStorageKey = localStorage.getItem(key)
                if (localStorageKey != null) {
                    localeCache.set(key, localStorageKey);
                    return Promise.resolve(localStorageKey!);
                }
            } catch (e) {
                console.warn("Failed to get cached locale:", e);
            }

            for (const [keys, promise] of pending) {
                const index = keys.indexOf(key);

                if (index !== -1) {
                    return promise.then(values => values[code]);
                }
            }
            return null
        }
        
        const result : LocalePromises = Object.fromEntries(
            Array.isArray(code) ? code.map((c) => [c, tryGetLocaleOrNull(c)]) : [[code, tryGetLocaleOrNull(code)]]
        )

        const findByRequest = Object.entries(result).filter(([, value]) => value === null);

        if (findByRequest.length > 0) {
            const requestCodes = findByRequest.map(([k, v]) => k)
            const requestKeys = requestCodes.map((v) => formatKey(lang, v))
            const request = new Promise<LocaleResponse>((resolve, reject) => {
                $.ajax({
                    url: "/api/locale",
                    traditional: true,
                    data: {
                        code: requestCodes,
                        lang
                    },
                    dataType: "json"
                })
                .done((data: LocaleResponse) => {
                    for (const [code, translation] of Object.entries(data)) {
                        const key = formatKey(lang, code);
                        localeCache.set(key, translation);
                        try {
                            localStorage.setItem(key, translation);
                        } catch (e) {
                            console.warn("Failed to cache locale:", e);
                        }
                    }
                    
                    pending.delete(requestKeys);
                    resolve(data)
                })
                .fail((err: any) => {
                    pending.delete(requestKeys);
                    console.error(err)
                    reject(err)
                });
            });

            pending.set(requestKeys, request);
            requestCodes.forEach((reqCode) => {
                result[reqCode] = request.then((req) => req[reqCode])
            })
        }
        return Array.isArray(code) ? 
        Promise.all(
                Object.entries(result).map(async ([key, promise]) => [
                    key,
                    await promise
                ])
            ).then(entries => Object.fromEntries(entries))
        : result[code]!
    };
    return translate;
})()

function formatString(
    template: string,
    ...args: (string | number)[]
): string {
    return template.replace(/\$(\d+)/g, (match, index: string) =>
        args[Number(index) - 1]?.toString() ?? match
    );
}

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