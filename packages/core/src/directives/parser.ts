import type { ParsedDirective } from "./types.js";

/**
 * Regex to match baton directives inside HTML comments.
 *
 * Matches: <!-- baton:include src="..." --> , <!-- baton:if tool="..." --> , <!-- baton:endif -->
 * Does NOT match regular HTML comments or unknown directive types.
 */
const DIRECTIVE_REGEX = /<!--\s*baton:(include|if|endif)\b((?:\s+[\w-]+="[^"]*")*)\s*-->/g;

/**
 * Regex to extract key="value" attribute pairs from the attribute portion.
 */
const ATTR_REGEX = /([\w-]+)="([^"]*)"/g;

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
        const attributes: Record<string, string> = {};

        for (const attrMatch of attrString.matchAll(ATTR_REGEX)) {
            attributes[attrMatch[1]] = attrMatch[2];
        }

        directives.push({
            type,
            attributes,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            raw: match[0],
        });
    }

    return directives;
}
