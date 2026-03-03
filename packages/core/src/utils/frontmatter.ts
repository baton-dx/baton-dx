import { parse } from "yaml";

/**
 * Parsed frontmatter result
 */
export interface ParsedFrontmatter {
    /** Parsed YAML data */
    data: Record<string, unknown>;
    /** Content after frontmatter */
    content: string;
}

/**
 * Parse YAML frontmatter from a markdown string.
 * Expects the standard `---` delimited format.
 *
 * @param raw - Raw markdown string (may or may not contain frontmatter)
 * @returns Parsed frontmatter data and remaining content
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
    const trimmed = raw.trimStart();

    if (!trimmed.startsWith("---")) {
        return { data: {}, content: raw };
    }

    // Find closing ---
    const endIndex = trimmed.indexOf("\n---", 3);
    if (endIndex === -1) {
        return { data: {}, content: raw };
    }

    const yamlBlock = trimmed.slice(4, endIndex);
    const content = trimmed.slice(endIndex + 4).trimStart();

    try {
        const data = parse(yamlBlock);
        return {
            data: typeof data === "object" && data !== null ? data : {},
            content,
        };
    } catch {
        // Invalid YAML - return raw content
        return { data: {}, content: raw };
    }
}
