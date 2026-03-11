import type { ParsedDirective } from "./types.js";

/**
 * Regex to match baton directives inside HTML comments.
 *
 * Matches: <!-- baton:include src="..." --> , <!-- baton:if tool="..." --> , <!-- baton:endif -->
 * Does NOT match regular HTML comments or unknown directive types.
 */
const DIRECTIVE_REGEX = /<!--\s*baton:(include|if|else|endif)\b([^>]*?)-->/g;

/**
 * Regex to match fenced code block delimiters (``` or ~~~, with optional info string).
 */
const FENCE_REGEX = /^(`{3,}|~{3,})/gm;

/**
 * Compute ranges of fenced code blocks in content.
 *
 * Tracks opening/closing fences and returns [start, end] index pairs.
 * Directives inside these ranges should be ignored.
 */
export function findCodeBlockRanges(content: string): Array<[start: number, end: number]> {
    const ranges: Array<[number, number]> = [];
    let openStart: number | null = null;
    let openFenceChar: string | null = null;
    let openFenceLen = 0;

    for (const match of content.matchAll(FENCE_REGEX)) {
        const fence = match[1];
        const fenceChar = fence[0]; // ` or ~
        const fenceLen = fence.length;
        const lineEnd = content.indexOf("\n", match.index + fence.length);
        const endPos = lineEnd === -1 ? content.length : lineEnd + 1;

        if (openStart === null) {
            // Opening fence
            openStart = match.index;
            openFenceChar = fenceChar;
            openFenceLen = fenceLen;
        } else if (fenceChar === openFenceChar && fenceLen >= openFenceLen) {
            // Closing fence (same char, at least same length)
            ranges.push([openStart, endPos]);
            openStart = null;
            openFenceChar = null;
            openFenceLen = 0;
        }
        // Different char or shorter fence → ignore (stays inside the open block)
    }

    // Unclosed fence block extends to end of content
    if (openStart !== null) {
        ranges.push([openStart, content.length]);
    }

    return ranges;
}

/** Check if an index falls inside any code block range. */
function isInsideCodeBlock(index: number, ranges: Array<[number, number]>): boolean {
    return ranges.some(([start, end]) => index >= start && index < end);
}

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
    const codeBlockRanges = findCodeBlockRanges(content);

    for (const match of content.matchAll(DIRECTIVE_REGEX)) {
        // Skip directives inside fenced code blocks
        if (isInsideCodeBlock(match.index, codeBlockRanges)) {
            continue;
        }

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
