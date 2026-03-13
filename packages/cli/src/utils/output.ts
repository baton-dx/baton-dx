import pc from "picocolors";

// --- Table Renderer ---

export interface TableColumn {
    header: string;
    width: number;
    align?: "left" | "right";
}

/**
 * Render data as an ASCII table with box-drawing characters.
 * Each cell is truncated/padded to the column width.
 */
export function renderTable(columns: TableColumn[], rows: string[][]): string {
    const pad = (str: string, width: number, align: "left" | "right" = "left"): string => {
        const truncated = str.length > width ? `${str.slice(0, width - 3)}...` : str;
        return align === "right" ? truncated.padStart(width) : truncated.padEnd(width);
    };

    const topBorder = `┌${columns.map((c) => "─".repeat(c.width + 2)).join("┬")}┐`;
    const headerRow = `│${columns.map((c) => ` ${pad(c.header, c.width)} `).join("│")}│`;
    const separator = `├${columns.map((c) => "─".repeat(c.width + 2)).join("┼")}┤`;
    const bottomBorder = `└${columns.map((c) => "─".repeat(c.width + 2)).join("┴")}┘`;

    const dataRows = rows.map(
        (row) => `│${columns.map((c, i) => ` ${pad(row[i] ?? "", c.width, c.align)} `).join("│")}│`,
    );

    return [topBorder, headerRow, separator, ...dataRows, bottomBorder].join("\n");
}

// --- JSON Output ---

export interface JsonEnvelope<T> {
    success: boolean;
    data?: T;
    warnings?: string[];
    errors?: string[];
}

/**
 * Output a success JSON envelope to stdout and exit.
 */
export function outputJson<T>(data: T, options?: { warnings?: string[]; errors?: string[] }): void {
    const envelope: JsonEnvelope<T> = {
        success: true,
        data,
    };
    if (options?.warnings?.length) envelope.warnings = options.warnings;
    if (options?.errors?.length) envelope.errors = options.errors;
    console.log(JSON.stringify(envelope, null, 2));
}

/**
 * Output an error JSON envelope to stdout and exit with code 1.
 */
export function outputJsonError(code: string, message: string): never {
    const envelope: JsonEnvelope<never> = {
        success: false,
        errors: [`${code}: ${message}`],
    };
    console.log(JSON.stringify(envelope, null, 2));
    process.exit(1);
}

// --- Output Context ---

export interface OutputContext {
    json: boolean;
    verbose: boolean;
}

/**
 * Extract output flags from citty args.
 * Works with both command-local args and inherited parent args.
 * Handles undefined args gracefully (e.g. in tests calling run() directly).
 */
export function getOutputContext(args: Record<string, unknown> | undefined): OutputContext {
    return {
        json: Boolean(args?.json),
        verbose: Boolean(args?.verbose),
    };
}

// --- Color helpers (re-exports from picocolors for consistency) ---

export { pc };
