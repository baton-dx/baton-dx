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

/** Legacy merge strategies that are no longer supported in v2. */
const LEGACY_STRATEGIES = new Set([
    "deep",
    "append",
    "prepend",
    "skip",
    "prompt",
    "directory",
    "import",
]);

/**
 * Merge content parts according to the specified merge strategy.
 *
 * v2 supports only two strategies:
 * - "concat" (default): join all parts with \n\n and normalize whitespace
 * - "replace": last part wins
 *
 * Legacy strategies cause hard errors.
 *
 * @param parts - Non-empty array of content strings to merge
 * @param strategy - Merge strategy: "concat" or "replace"
 * @returns Merged content string
 * @throws Error if a legacy strategy is used
 */
export function mergeContentParts(parts: string[], strategy: string): string {
    if (LEGACY_STRATEGIES.has(strategy)) {
        throw new Error(
            `Merge strategy "${strategy}" is no longer supported in v2. ` +
                `Use "concat" (join with \\n\\n) or "replace" (last wins). ` +
                `See migration guide: docs/04-creating-profiles.md`,
        );
    }

    switch (strategy) {
        case "concat":
            return normalizeMarkdown(parts.join("\n\n"));
        default:
            // "replace" — last one wins
            return parts[parts.length - 1];
    }
}
