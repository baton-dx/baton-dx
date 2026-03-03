import type { DimensionIntersection, IntersectionResult } from "@baton-dx/core";
import * as p from "@clack/prompts";

/**
 * Display the intersection between developer tools and profile support.
 * Shows which tools/platforms will be synced, which are unsupported, and which are unavailable.
 *
 * Used by `baton init` (after profile selection) and `baton manage` (overview).
 */
export function displayIntersection(intersection: IntersectionResult): void {
    const hasAiData =
        intersection.aiTools.synced.length > 0 ||
        intersection.aiTools.unsupported.length > 0 ||
        intersection.aiTools.unavailable.length > 0;

    const hasIdeData =
        intersection.idePlatforms.synced.length > 0 ||
        intersection.idePlatforms.unsupported.length > 0 ||
        intersection.idePlatforms.unavailable.length > 0;

    if (!hasAiData && !hasIdeData) {
        p.log.info("No tool or IDE intersection data available.");
        return;
    }

    if (hasAiData) {
        displayDimension("AI Tools", intersection.aiTools);
    }

    if (hasIdeData) {
        displayDimension("IDE Platforms", intersection.idePlatforms);
    }
}

/**
 * Display a single dimension (AI tools or IDE platforms) of the intersection.
 */
function displayDimension(label: string, dimension: DimensionIntersection): void {
    const lines: string[] = [];

    if (dimension.synced.length > 0) {
        for (const item of dimension.synced) {
            lines.push(`  \u2713 ${item}`);
        }
    }

    if (dimension.unavailable.length > 0) {
        for (const item of dimension.unavailable) {
            lines.push(`  - ${item} (not installed)`);
        }
    }

    if (dimension.unsupported.length > 0) {
        for (const item of dimension.unsupported) {
            lines.push(`  ~ ${item} (not supported by profile)`);
        }
    }

    if (lines.length > 0) {
        p.note(lines.join("\n"), label);
    }
}

/**
 * Format a compact intersection summary for inline display.
 * Example: "claude-code, cursor (AI) + vscode (IDE)"
 */
export function formatIntersectionSummary(intersection: IntersectionResult): string {
    const parts: string[] = [];

    if (intersection.aiTools.synced.length > 0) {
        parts.push(`${intersection.aiTools.synced.join(", ")} (AI)`);
    }

    if (intersection.idePlatforms.synced.length > 0) {
        parts.push(`${intersection.idePlatforms.synced.join(", ")} (IDE)`);
    }

    if (parts.length === 0) {
        return "No matching tools";
    }

    return parts.join(" + ");
}
