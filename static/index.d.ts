declare global {
    interface String {
        capitalize(): string;
        format(): string;
    }
}
declare function __(code: string, lang? : string): Promise<string>;
declare function getLocale(): string;
declare function escapeHtml(str: string): string;