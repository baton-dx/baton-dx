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
      return parts.join("\n\n");
    case "prepend":
      return [...parts].reverse().join("\n\n");
    case "skip":
      return parts[0];
    default:
      // "replace" — last one wins
      return parts[parts.length - 1];
  }
}
