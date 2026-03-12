/**
 * Normalize markdown whitespace:
 * - Collapse 3+ consecutive newlines to exactly 2 (max 1 blank line)
 * - Ensure file ends with a single trailing newline
 *
 * Idempotent — safe to apply multiple times.
 */
export function normalizeMarkdown(content: string): string {
    return `${content.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/**
 * Merge content parts according to the specified merge strategy.
 *
 * v2 supports two strategies:
 * - "concat" (default): join all parts with \n\n and normalize whitespace
 * - "replace": last part wins
 *
 * @param parts - Non-empty array of content strings to merge
 * @param strategy - Merge strategy: "concat" or "replace"
 * @returns Merged content string
 */
export function mergeContentParts(parts: string[], strategy: string): string {
    switch (strategy) {
        case "replace":
            return parts[parts.length - 1];
        default:
            // "concat" and any unknown strategy: join
            return normalizeMarkdown(parts.join("\n\n"));
    }
}
