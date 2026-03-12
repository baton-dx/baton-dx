import type { BatonOwnedKey, ParsedFrontmatter } from "./types.js";
import { BATON_OWNED_KEYS } from "./types.js";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?\n)?---(?:\n|$)/;

export function parseFrontmatter(content: string): ParsedFrontmatter {
    const match = content.match(FRONTMATTER_REGEX);

    if (!match) {
        return {
            metadata: {},
            batonMetadata: {},
            contentStripped: content,
            contentSelectiveStripped: content,
            hasFrontmatter: false,
        };
    }

    const yamlBlock = match[1] ?? "";
    // Slice past the matched block; if the closing --- had no trailing newline
    // match[0] ends at the string boundary, so slicing gives an empty string.
    const body = content.slice(match[0].length);

    // Simple YAML key-value parser (no nested objects needed for frontmatter)
    const metadata: Record<string, unknown> = {};
    for (const line of yamlBlock.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (key) metadata[key] = value;
    }

    // Extract Baton-owned keys — driven by BATON_OWNED_KEYS so additions are automatic
    const batonMetadata: Partial<Record<BatonOwnedKey, string>> = {};
    for (const key of BATON_OWNED_KEYS) {
        if (typeof metadata[key] === "string") batonMetadata[key] = metadata[key] as string;
    }

    // Build selective-stripped content (remove only Baton keys, keep tool keys)
    const toolKeys = Object.entries(metadata).filter(
        ([key]) => !(BATON_OWNED_KEYS as readonly string[]).includes(key),
    );
    const contentSelectiveStripped =
        toolKeys.length > 0
            ? `---\n${toolKeys.map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n${body}`
            : body;

    return {
        metadata,
        batonMetadata,
        contentStripped: body,
        contentSelectiveStripped,
        hasFrontmatter: true,
    };
}
