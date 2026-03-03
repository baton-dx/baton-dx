import { getGlobalAiTools, getGlobalIdePlatforms } from "../config/global-config.js";
import { readProjectPreferences } from "./preferences-io.js";

export interface ResolvedPreferences {
    ai: { source: "global" | "project"; tools: string[] };
    ide: { source: "global" | "project"; platforms: string[] };
}

/**
 * Resolves the effective AI tools and IDE platforms for a project.
 *
 * Resolution chain:
 * 1. If no .baton/preferences.yaml exists → use global config
 * 2. If useGlobal: true → use global config for that dimension
 * 3. If useGlobal: false → use project-level preferences
 *
 * AI and IDE dimensions are resolved independently, allowing mixed configs
 * (e.g., AI from project, IDE from global).
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Resolved preferences with source attribution
 */
export async function resolvePreferences(projectRoot: string): Promise<ResolvedPreferences> {
    const prefs = await readProjectPreferences(projectRoot);

    // No preferences file → everything comes from global
    if (!prefs) {
        const [tools, platforms] = await Promise.all([getGlobalAiTools(), getGlobalIdePlatforms()]);
        return {
            ai: { source: "global", tools },
            ide: { source: "global", platforms },
        };
    }

    // Resolve AI dimension
    const ai = prefs.ai.useGlobal
        ? { source: "global" as const, tools: await getGlobalAiTools() }
        : { source: "project" as const, tools: prefs.ai.tools };

    // Resolve IDE dimension
    const ide = prefs.ide.useGlobal
        ? { source: "global" as const, platforms: await getGlobalIdePlatforms() }
        : { source: "project" as const, platforms: prefs.ide.platforms };

    return { ai, ide };
}
