import { readFile, stat } from "node:fs/promises";
import { isAbsolute, normalize, resolve } from "node:path";
import { isBinaryFile } from "../substitution/variables.js";
import type { ParsedDirective } from "./types.js";

/** Maximum file size for inclusion (1 MB) */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Resolve a single baton:include directive.
 *
 * @param directive - The parsed include directive
 * @param projectRoot - Absolute path to the project root
 * @param onWarning - Callback for non-fatal warnings
 * @returns The replacement text (file content, reference instruction, or empty string)
 */
export async function resolveInclude(
    directive: ParsedDirective,
    projectRoot: string,
    onWarning?: (message: string) => void,
): Promise<string> {
    const src = directive.attributes.src;
    if (!src) {
        onWarning?.("baton:include missing required src attribute");
        return "";
    }

    const mode = directive.attributes.mode || "inline";
    const optional = directive.attributes.optional === "true";
    const hint = directive.attributes.hint;

    // Reject absolute paths
    if (isAbsolute(src)) {
        onWarning?.(`baton:include src must be relative, got absolute path: ${src}`);
        return "";
    }

    // Reject path traversal
    const normalized = normalize(src);
    if (normalized.startsWith("..")) {
        onWarning?.(`baton:include src must not traverse outside project root: ${src}`);
        return "";
    }

    const absolutePath = resolve(projectRoot, normalized);

    // Verify resolved path is within project root
    if (!absolutePath.startsWith(projectRoot)) {
        onWarning?.(`baton:include resolved path escapes project root: ${src}`);
        return "";
    }

    // Reject binary files
    if (isBinaryFile(absolutePath)) {
        onWarning?.(`baton:include skipping binary file: ${src}`);
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
        onWarning?.(`baton:include file not found: ${src}`);
        return `<!-- baton:include file not found: ${src} -->`;
    }

    if (fileStats.size > MAX_FILE_SIZE) {
        onWarning?.(`baton:include file exceeds 1MB limit: ${src} (${fileStats.size} bytes)`);
        return "";
    }

    if (fileStats.size === 0) {
        return "";
    }

    if (mode === "link") {
        const rendered = `[${src}](${src})`;
        return hint ? hint.replace("{{file}}", rendered) : rendered;
    }

    if (mode === "reference") {
        const rendered = `@${src}`;
        return hint
            ? hint.replace("{{file}}", rendered)
            : `See ${rendered} for additional context.`;
    }

    // Default: inline content
    const content = await readFile(absolutePath, "utf-8");
    return content;
}
