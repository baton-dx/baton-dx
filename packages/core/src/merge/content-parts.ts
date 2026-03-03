/**
 * Normalize markdown whitespace:
 * - Collapse 3+ consecutive newlines to exactly 2 (max 1 blank line)
 * - Ensure file ends with a single trailing newline
 *
 * Idempotent — safe to apply multiple times.
 */
export function normalizeMarkdown(content: string): string {
  return content.replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
}

/**
 * Merge content parts according to the specified merge strategy.
 *
 * @param parts - Non-empty array of content strings to merge
 * @param strategy - Merge strategy: "append", "prepend", "skip", or "replace" (default)
 * @returns Merged content string
 */
export function mergeContentParts(parts: string[], strategy: string): string {
  switch (strategy) {
    case "append":
      return normalizeMarkdown(parts.join("\n\n"));
    case "prepend":
      return normalizeMarkdown([...parts].reverse().join("\n\n"));
    case "skip":
      return parts[0];
    default:
      // "replace" — last one wins
      return parts[parts.length - 1];
  }
}
