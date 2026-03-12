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
 * Legacy strategy names that map to the two active strategies.
 */
const LEGACY_STRATEGY_MAP: Record<string, string> = {
    append: "concat",
    prepend: "concat",
    deep: "replace",
    skip: "replace",
    prompt: "replace",
    directory: "replace",
    import: "replace",
};

/**
 * Normalize a merge strategy, mapping legacy names to active strategies.
 * Returns the effective strategy name.
 */
export function normalizeMergeStrategy(
    strategy: string,
    onWarning?: (message: string) => void,
): string {
    const mapped = LEGACY_STRATEGY_MAP[strategy];
    if (mapped) {
        onWarning?.(`Merge strategy "${strategy}" is deprecated, use "${mapped}" instead`);
        return mapped;
    }
    return strategy;
}

/**
 * Merge content parts according to the specified merge strategy.
 *
 * v2 supports only two strategies:
 * - "concat" (default): join all parts with \n\n and normalize whitespace
 * - "replace": last part wins
 *
 * Legacy strategies are accepted with deprecation mapping (see normalizeMergeStrategy).
 *
 * @param parts - Non-empty array of content strings to merge
 * @param strategy - Merge strategy: "concat" (default) or "replace"
 * @returns Merged content string
 */
export function mergeContentParts(parts: string[], strategy: string): string {
    // Normalize legacy strategy names
    const effective = LEGACY_STRATEGY_MAP[strategy] ?? strategy;

    switch (effective) {
        case "concat":
            return normalizeMarkdown(parts.join("\n\n"));
        case "replace":
            // Last part wins (highest weight, already sorted)
            return parts[parts.length - 1];
        default:
            // Fallback: concat
            return normalizeMarkdown(parts.join("\n\n"));
    }
}
