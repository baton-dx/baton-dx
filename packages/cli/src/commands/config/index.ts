import { join } from "node:path";
import { getAIToolConfig } from "@baton-dx/ai-tool-paths";
import type { ProjectManifest } from "@baton-dx/core";
import {
    getGlobalAiTools,
    getGlobalIdePlatforms,
    getGlobalSources,
    loadProjectManifest,
    resolvePreferences,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { buildIntersection } from "../../utils/build-intersection.js";
import { formatIntersectionSummary } from "../../utils/intersection-display.js";
import { configSetCommand } from "./set.js";

async function showDashboard(): Promise<void> {
    p.intro("Baton Dashboard");

    // Fetch all data in parallel
    const [sources, aiTools, idePlatforms, projectManifest] = await Promise.all([
        getGlobalSources(),
        getGlobalAiTools(),
        getGlobalIdePlatforms(),
        loadProjectManifestSafe(),
    ]);

    // --- Global Sources ---
    console.log("");
    p.log.step("Global Sources");
    if (sources.length === 0) {
        p.log.info("  No sources configured. Run: baton source connect <url>");
    } else {
        for (const source of sources) {
            const defaultBadge = source.default ? " (default)" : "";
            const desc = source.description ? ` — ${source.description}` : "";
            p.log.info(`  ${source.name}${defaultBadge}: ${source.url}${desc}`);
        }
    }

    // --- Developer Tools ---
    console.log("");
    p.log.step("Developer Tools");

    // Use resolved preferences if in a project directory, otherwise show global config
    if (projectManifest) {
        const prefs = await resolvePreferences(process.cwd());
        const resolvedAiTools = prefs.ai.tools;
        const resolvedIdePlatforms = prefs.ide.platforms;

        if (resolvedAiTools.length === 0 && resolvedIdePlatforms.length === 0) {
            p.log.info("  No tools configured. Run: baton ai-tools scan && baton ides scan");
        } else {
            if (resolvedAiTools.length > 0) {
                const toolNames = resolvedAiTools.map((key) => {
                    try {
                        return getAIToolConfig(key).name;
                    } catch {
                        return key;
                    }
                });
                const aiSourceLabel =
                    prefs.ai.source === "project" ? "project preferences" : "global config";
                p.log.info(`  AI Tools: ${toolNames.join(", ")} (from ${aiSourceLabel})`);
            }
            if (resolvedIdePlatforms.length > 0) {
                const ideSourceLabel =
                    prefs.ide.source === "project" ? "project preferences" : "global config";
                p.log.info(
                    `  IDE Platforms: ${resolvedIdePlatforms.join(", ")} (from ${ideSourceLabel})`,
                );
            }
        }
    } else {
        if (aiTools.length === 0 && idePlatforms.length === 0) {
            p.log.info("  No tools configured. Run: baton ai-tools scan && baton ides scan");
        } else {
            if (aiTools.length > 0) {
                const toolNames = aiTools.map((key) => {
                    try {
                        return getAIToolConfig(key).name;
                    } catch {
                        return key;
                    }
                });
                p.log.info(`  AI Tools: ${toolNames.join(", ")} (from global config)`);
            }
            if (idePlatforms.length > 0) {
                p.log.info(`  IDE Platforms: ${idePlatforms.join(", ")} (from global config)`);
            }
        }
    }

    // --- Current Project ---
    console.log("");
    p.log.step("Current Project");
    if (!projectManifest) {
        p.log.info("  Not inside a Baton project. Run: baton init");
    } else if (projectManifest.profiles.length === 0) {
        p.log.info("  No profiles installed. Run: baton manage");
    } else {
        for (const profile of projectManifest.profiles) {
            const version = profile.version ? ` (${profile.version})` : "";
            p.log.info(`  ${profile.source}${version}`);
        }
    }

    // --- Active Intersections ---
    if (projectManifest && projectManifest.profiles.length > 0) {
        const hasDeveloperTools = aiTools.length > 0 || idePlatforms.length > 0;

        if (hasDeveloperTools) {
            const developerTools = { aiTools, idePlatforms };
            console.log("");
            p.log.step("Active Intersections");

            for (const profile of projectManifest.profiles) {
                try {
                    const intersection = await buildIntersection(
                        profile.source,
                        developerTools,
                        process.cwd(),
                    );
                    if (intersection) {
                        const summary = formatIntersectionSummary(intersection);
                        p.log.info(`  ${profile.source}: ${summary}`);
                    }
                } catch {
                    // Best-effort — skip if intersection cannot be computed
                }
            }
        }
    }

    console.log("");
    p.outro("Manage tools: 'baton ai-tools configure' | 'baton ides configure'");
}

async function loadProjectManifestSafe(): Promise<ProjectManifest | null> {
    try {
        return await loadProjectManifest(join(process.cwd(), "baton.yaml"));
    } catch {
        return null;
    }
}

export const configCommand = defineCommand({
    meta: {
        name: "config",
        description: "Show Baton dashboard overview or configure settings",
    },
    subCommands: {
        set: configSetCommand,
    },
    async run() {
        await showDashboard();
    },
});
