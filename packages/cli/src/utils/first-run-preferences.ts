import {
    getAllAIToolAdapters,
    getGlobalAiTools,
    getGlobalIdePlatforms,
    getRegisteredIdePlatforms,
    readProjectPreferences,
    writeProjectPreferences,
} from "@baton-dx/core";
import * as p from "@clack/prompts";

/**
 * Format an IDE platform key into a display name.
 * Duplicated here to avoid circular dependency with ides/utils.
 */
function formatIdeName(ideKey: string): string {
    const names: Record<string, string> = {
        vscode: "VS Code",
        jetbrains: "JetBrains",
        cursor: "Cursor",
        windsurf: "Windsurf",
        antigravity: "Antigravity",
        zed: "Zed",
    };
    return names[ideKey] ?? ideKey;
}

/**
 * Shows the first-run preferences prompt if .baton/preferences.yaml doesn't exist.
 *
 * Asks the user whether to use global config or customize AI tools and IDEs
 * for this project, then writes the preferences file.
 *
 * @param projectRoot - Absolute path to the project root
 * @param nonInteractive - If true, writes useGlobal: true silently
 * @returns true if preferences were written, false if already existed
 */
export async function promptFirstRunPreferences(
    projectRoot: string,
    nonInteractive: boolean,
): Promise<boolean> {
    const existing = await readProjectPreferences(projectRoot);
    if (existing) {
        return false;
    }

    // --yes mode: write useGlobal: true silently
    if (nonInteractive) {
        await writeProjectPreferences(projectRoot, {
            version: "1.0",
            ai: { useGlobal: true, tools: [] },
            ide: { useGlobal: true, platforms: [] },
        });
        return true;
    }

    // AI tools prompt
    const aiMode = await p.select({
        message: "How do you want to configure AI tools for this project?",
        options: [
            { value: "global", label: "Use global config", hint: "recommended" },
            { value: "customize", label: "Customize for this project" },
        ],
    });

    if (p.isCancel(aiMode)) {
        return false;
    }

    let aiUseGlobal = true;
    let aiTools: string[] = [];

    if (aiMode === "customize") {
        const globalTools = await getGlobalAiTools();
        const allAdapters = getAllAIToolAdapters();

        const selected = await p.multiselect({
            message: "Select AI tools for this project:",
            options: allAdapters.map((adapter) => ({
                value: adapter.key,
                label: globalTools.includes(adapter.key)
                    ? `${adapter.name} (in global config)`
                    : adapter.name,
            })),
            initialValues: globalTools,
        });

        if (p.isCancel(selected)) {
            return false;
        }

        aiUseGlobal = false;
        aiTools = selected as string[];
    }

    // IDE platforms prompt
    const ideMode = await p.select({
        message: "How do you want to configure IDE platforms for this project?",
        options: [
            { value: "global", label: "Use global config", hint: "recommended" },
            { value: "customize", label: "Customize for this project" },
        ],
    });

    if (p.isCancel(ideMode)) {
        return false;
    }

    let ideUseGlobal = true;
    let idePlatforms: string[] = [];

    if (ideMode === "customize") {
        const globalPlatforms = await getGlobalIdePlatforms();
        const allIdeKeys = getRegisteredIdePlatforms();

        const selected = await p.multiselect({
            message: "Select IDE platforms for this project:",
            options: allIdeKeys.map((ideKey) => ({
                value: ideKey,
                label: globalPlatforms.includes(ideKey)
                    ? `${formatIdeName(ideKey)} (in global config)`
                    : formatIdeName(ideKey),
            })),
            initialValues: globalPlatforms,
        });

        if (p.isCancel(selected)) {
            return false;
        }

        ideUseGlobal = false;
        idePlatforms = selected as string[];
    }

    await writeProjectPreferences(projectRoot, {
        version: "1.0",
        ai: { useGlobal: aiUseGlobal, tools: aiTools },
        ide: { useGlobal: ideUseGlobal, platforms: idePlatforms },
    });

    return true;
}
