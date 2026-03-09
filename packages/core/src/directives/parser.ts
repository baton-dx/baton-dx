import type { ParsedDirective } from "./types.js";

/**
 * Regex to match baton directives inside HTML comments.
 *
 * Matches: <!-- baton:include src="..." --> , <!-- baton:if tool="..." --> , <!-- baton:endif -->
 * Does NOT match regular HTML comments or unknown directive types.
 */
const DIRECTIVE_REGEX = /<!--\s*baton:(include|if|endif)\b([^>]*?)-->/g;

/**
 * Extract key="value" attribute pairs from a directive's attribute string.
 * Uses a linear scan instead of regex to avoid ReDoS.
 */
function parseAttributes(input: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    let i = 0;
    while (i < input.length) {
        // Skip whitespace
        while (i < input.length && input[i] === " ") i++;
        if (i >= input.length) break;

        // Read key (up to '=')
        const keyStart = i;
        while (i < input.length && input[i] !== "=" && input[i] !== " ") i++;
        if (i >= input.length || input[i] !== "=") break;
        const key = input.slice(keyStart, i);
        i++; // skip '='

        // Expect opening quote
        if (i >= input.length || input[i] !== '"') break;
        i++; // skip '"'

        // Read value (up to closing quote)
        const valStart = i;
        while (i < input.length && input[i] !== '"') i++;
        if (i >= input.length) break;
        attrs[key] = input.slice(valStart, i);
        i++; // skip closing '"'
    }
    return attrs;
}

/**
 * Parse all baton directives from content.
 *
 * @param content - Markdown/text content to scan
 * @returns Array of parsed directives in document order
 */
export function parseDirectives(content: string): ParsedDirective[] {
    const directives: ParsedDirective[] = [];

    for (const match of content.matchAll(DIRECTIVE_REGEX)) {
        const type = match[1] as ParsedDirective["type"];
        const attrString = match[2] || "";

        directives.push({
            type,
            attributes: parseAttributes(attrString),
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            raw: match[0],
        });
    }

    return directives;
}
