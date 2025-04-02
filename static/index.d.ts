declare global {
    interface String {
        capitalize(): string;
        format(): string;
    }
}
interface Localization{
    [key: string] : string
}
declare function __(code: string, lang? : string): Promise<string>;
declare function getLocale(): string;
declare function escapeHtml(str: string): string;
declare function setupFullscreen(fullscreenButton: string, fullscreenexitButton: string, fullscreenDiv: string);