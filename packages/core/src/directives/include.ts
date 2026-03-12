import { readFile, stat } from "node:fs/promises";
import { isAbsolute, normalize, resolve } from "node:path";
import { isBinaryFile } from "../substitution/variables.js";
import { computePlacementTarget } from "./placement.js";
import type { FilePlacement, ParsedDirective } from "./types.js";

/** Maximum file size for inclusion (1 MB) */
const MAX_FILE_SIZE = 1024 * 1024;

/** Prefix for project-relative resolution */
const PROJECT_PREFIX = "@project/";

/**
 * Resolve a single baton:include directive.
 *
 * Resolution roots:
 * - `@project/` prefix → resolve relative to `projectRoot`
 * - No prefix → resolve relative to `profileRoot` (if available), fallback to `projectRoot`
 *
 * Optional defaults:
 * - Profile-relative: `optional` defaults to `false` (missing = bug in profile)
 * - `@project/`: `optional` defaults to `true` (project may not have the file)
 *
 * Missing file behavior: always returns empty string. If `optional=false` and missing,
 * emits warning via onWarning() but still returns empty string.
 *
 * @param directive - The parsed include directive
 * @param projectRoot - Absolute path to the project root
 * @param onWarning - Callback for non-fatal warnings
 * @param profileRoot - Absolute path to the profile's local directory (optional)
 * @returns The replacement text (file content, reference instruction, or empty string)
 */
export async function resolveInclude(
    directive: ParsedDirective,
    projectRoot: string,
    onWarning?: (message: string) => void,
    profileRoot?: string,
    profileName?: string,
    onPlacement?: (placement: FilePlacement) => void,
): Promise<string> {
    const rawSrc = directive.attributes.src;
    if (!rawSrc) {
        onWarning?.("baton:include missing required src attribute");
        return "";
    }

    const mode = directive.attributes.mode || "inline";
    const hint = directive.attributes.hint;

    // Determine resolution root and effective src
    const isProjectRelative = rawSrc.startsWith(PROJECT_PREFIX);
    const src = isProjectRelative ? rawSrc.slice(PROJECT_PREFIX.length) : rawSrc;

    // Determine optional default based on resolution root
    const optionalAttr = directive.attributes.optional;
    let optional: boolean;
    if (optionalAttr !== undefined) {
        optional = optionalAttr === "true";
    } else {
        // @project/ defaults to optional=true, profile-relative defaults to false
        optional = isProjectRelative;
    }

    // Choose resolution root
    const resolveRoot = isProjectRelative ? projectRoot : (profileRoot ?? projectRoot);

    // Reject absolute paths
    if (isAbsolute(src)) {
        onWarning?.(`baton:include src must be relative, got absolute path: ${rawSrc}`);
        return "";
    }

    // Reject path traversal
    const normalized = normalize(src);
    if (normalized.startsWith("..")) {
        onWarning?.(`baton:include src must not traverse outside root: ${rawSrc}`);
        return "";
    }

    const absolutePath = resolve(resolveRoot, normalized);

    // Verify resolved path is within the resolution root
    if (!absolutePath.startsWith(resolveRoot)) {
        onWarning?.(`baton:include resolved path escapes root: ${rawSrc}`);
        return "";
    }

    // Reject binary files
    if (isBinaryFile(absolutePath)) {
        onWarning?.(`baton:include skipping binary file: ${rawSrc}`);
        return "";
    }

    // Check file exists and size
    let fileStats: Awaited<ReturnType<typeof stat>>;
    try {
        fileStats = await stat(absolutePath);
    } catch {
        if (optional) {
            return "";
        }
        onWarning?.(`baton:include file not found: ${rawSrc}`);
        return "";
    }

    if (fileStats.size > MAX_FILE_SIZE) {
        onWarning?.(`baton:include file exceeds 1MB limit: ${rawSrc} (${fileStats.size} bytes)`);
        return "";
    }

    if (fileStats.size === 0) {
        return "";
    }

    if (mode === "link") {
        // Profile-relative link: emit placement and rewrite path to .baton/includes/
        if (!isProjectRelative && profileRoot && profileName && onPlacement) {
            const targetRelative = computePlacementTarget(profileName, src);
            onPlacement({ sourcePath: absolutePath, targetRelative, profileName });
            const rendered = `[${targetRelative}](${targetRelative})`;
            return hint ? hint.replace("{{file}}", rendered) : rendered;
        }
        // @project/ link or no placement callback: use original path
        const rendered = `[${rawSrc}](${rawSrc})`;
        return hint ? hint.replace("{{file}}", rendered) : rendered;
    }

    if (mode === "reference") {
        if (!isProjectRelative && profileRoot && profileName && onPlacement) {
            const targetRelative = computePlacementTarget(profileName, src);
            onPlacement({ sourcePath: absolutePath, targetRelative, profileName });
            const rendered = `@${targetRelative}`;
            return hint
                ? hint.replace("{{file}}", rendered)
                : `See ${rendered} for additional context.`;
        }
        const rendered = `@${rawSrc}`;
        return hint
            ? hint.replace("{{file}}", rendered)
            : `See ${rendered} for additional context.`;
    }

    // Default: inline content (trimmed to avoid stray blank lines at boundaries)
    const content = await readFile(absolutePath, "utf-8");
    return content.trim();
}
