$(document).ready(function () {
    interface CppDataType {
        byte: number;
        val: string;
        max_val: bigint;
        min_val: bigint;
    }
    // Standard integer widths for the selected compiler target (8-bit bytes).
    const platforms: Record<string, { intBytes: number; longBytes: number }> = {
        "windows-msvc-x64": { intBytes: 4, longBytes: 4 },
        "windows-clang-x64": { intBytes: 4, longBytes: 4 },
        "windows-mingw-x64": { intBytes: 4, longBytes: 4 },
        "windows-msvc-x86": { intBytes: 4, longBytes: 4 },
        "linux-gcc-x64": { intBytes: 4, longBytes: 8 },
        "linux-clang-x64": { intBytes: 4, longBytes: 8 },
        "linux-gcc-x86": { intBytes: 4, longBytes: 4 },
        "macos-clang-arm64": { intBytes: 4, longBytes: 8 },
        "macos-clang-x64": { intBytes: 4, longBytes: 8 }
    };

    function integerType(val: string, byte: number, signed: boolean): CppDataType {
        const bits = BigInt(byte * 8);
        return {
            byte,
            val,
            max_val: (1n << (signed ? bits - 1n : bits)) - 1n,
            min_val: signed ? -(1n << (bits - 1n)) : 0n
        };
    }

    function getCppDataTypes(platform: { intBytes: number; longBytes: number }): CppDataType[] {
        // Explicit signed/unsigned char avoid compiler flags changing plain char signedness.
        return [
            integerType("signed char", 1, true),
            integerType("unsigned char", 1, false),
            integerType("short", 2, true),
            integerType("unsigned short", 2, false),
            integerType("int", platform.intBytes, true),
            integerType("unsigned int", platform.intBytes, false),
            integerType("long", platform.longBytes, true),
            integerType("unsigned long", platform.longBytes, false),
            integerType("long long", 8, true),
            integerType("unsigned long long", 8, false)
        ].sort((a, b) => a.byte - b.byte);
    }

    function readInteger(selector: string): bigint | null {
        const raw = String($(selector).val() ?? "").trim();
        const valid = /^[+-]?\d+$/.test(raw);
        $(selector).toggleClass("is-invalid", !valid).attr("aria-invalid", String(!valid));
        return valid ? BigInt(raw) : null;
    }

    function calculate(): void {
        const button = $("#btn");
        const bytes = readInteger("#bytes");
        const store_up = readInteger("#StoreTo");
        const store_down = readInteger("#StoreUp");
        const answer = $("#answer");

        if (bytes === null || store_up === null || store_down === null) {
            answer.text(String(button.attr("data-error-integer")));
            return;
        }
        if (bytes <= 0n) {
            $("#bytes").addClass("is-invalid").attr("aria-invalid", "true");
            answer.text(String(button.attr("data-error-bytes")));
            return;
        }
        if (store_down > store_up) {
            $("#StoreUp, #StoreTo").addClass("is-invalid").attr("aria-invalid", "true");
            answer.text(String(button.attr("data-error-range")));
            return;
        }

        const platformKey = String($("#platform").val() ?? "");
        const platform = Object.hasOwn(platforms, platformKey) ? platforms[platformKey] : undefined;
        if (!platform) {
            $("#platform").addClass("is-invalid").attr("aria-invalid", "true");
            answer.text(String(button.attr("data-error-platform")));
            return;
        }
        $("#platform").removeClass("is-invalid").attr("aria-invalid", "false");
        const type = getCppDataTypes(platform).find((element) =>
            element.byte <= bytes && store_up <= element.max_val && store_down >= element.min_val);
        answer.text(type?.val ?? String(button.attr("data-not-found")));
    }

    $("#btn").on("click", calculate);
    $("#platform").on("change", calculate);
});
