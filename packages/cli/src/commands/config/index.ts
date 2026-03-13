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
import { getOutputContext, outputJson } from "../../utils/output.js";
import { configSetCommand } from "./set.js";

async function showDashboard(json: boolean): Promise<void> {
    // Fetch all data in parallel
    const [sources, aiTools, idePlatforms, projectManifest] = await Promise.all([
        getGlobalSources(),
        getGlobalAiTools(),
        getGlobalIdePlatforms(),
        loadProjectManifestSafe(),
    ]);

    if (json) {
        const resolvedPrefs = projectManifest ? await resolvePreferences(process.cwd()) : null;

        outputJson({
            sources: sources.map((s) => ({
                name: s.name,
                url: s.url,
                default: s.default ?? false,
                description: s.description ?? null,
            })),
            aiTools: resolvedPrefs ? resolvedPrefs.ai.tools : aiTools,
            idePlatforms: resolvedPrefs ? resolvedPrefs.ide.platforms : idePlatforms,
            project: projectManifest
                ? {
                      profiles: projectManifest.profiles.map((pr) => ({
                          source: pr.source,
                          version: pr.version ?? null,
                      })),
                  }
                : null,
        });
        return;
    }

    p.intro("Baton Dashboard");

    // Resolve effective tools — project preferences override global if set
    let resolvedAiTools: string[];
    let resolvedIdePlatforms: string[];

    if (projectManifest) {
        const prefs = await resolvePreferences(process.cwd());
        resolvedAiTools = prefs.ai.tools;
        resolvedIdePlatforms = prefs.ide.platforms;
    } else {
        resolvedAiTools = aiTools;
        resolvedIdePlatforms = idePlatforms;
    }

    // --- Global Sources ---
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
    p.log.step("Developer Tools");

    if (projectManifest) {
        const prefs = await resolvePreferences(process.cwd());

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
                p.log.info(`  AI Tools: ${toolNames.join(", ")} (from global config)`);
            }
            if (resolvedIdePlatforms.length > 0) {
                p.log.info(
                    `  IDE Platforms: ${resolvedIdePlatforms.join(", ")} (from global config)`,
                );
            }
        }
    }

    // --- Current Project ---
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
        const hasDeveloperTools = resolvedAiTools.length > 0 || resolvedIdePlatforms.length > 0;

        if (hasDeveloperTools) {
            const developerTools = {
                aiTools: resolvedAiTools,
                idePlatforms: resolvedIdePlatforms,
            };
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
    async run({ args }) {
        const { json } = getOutputContext(args);
        await showDashboard(json);
    },
});
