/** Baton-owned frontmatter keys that are stripped at sync time. */
export const BATON_OWNED_KEYS = ["merge", "scope"] as const;

export type BatonOwnedKey = (typeof BATON_OWNED_KEYS)[number];

/** Result of parsing frontmatter from a content file. */
export interface ParsedFrontmatter {
    /** All frontmatter key-value pairs (Baton + tool-relevant) */
    metadata: Record<string, unknown>;
    /** Baton-owned metadata extracted from frontmatter */
    batonMetadata: Partial<Record<BatonOwnedKey, string>>;
    /** Content with entire frontmatter block removed */
    contentStripped: string;
    /** Content with only Baton-owned keys removed (tool keys preserved) — for agents */
    contentSelectiveStripped: string;
    /** Whether frontmatter was present */
    hasFrontmatter: boolean;
}
