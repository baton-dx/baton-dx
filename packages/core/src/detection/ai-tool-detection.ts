import { AI_TOOL_PATHS } from "@baton-dx/ai-tool-paths";
import { evaluateDetection } from "./mechanisms.js";

/**
 * Cache for detected AI tools (valid for process lifetime)
 */
let cachedAITools: string[] | null = null;

/**
 * Detect if a specific AI tool is installed using structured detectionConfig.
 */
async function isAIToolInstalled(toolKey: string): Promise<boolean> {
    const toolConfig = AI_TOOL_PATHS.find((agent) => agent.key === toolKey);
    if (!toolConfig?.detectionConfig) return false;

    return evaluateDetection(toolConfig.detectionConfig);
}

/**
 * Detect all installed AI tools
 * Results are cached for the duration of the process
 */
export async function detectInstalledAITools(): Promise<string[]> {
    // Return cached result if available
    if (cachedAITools !== null) {
        return cachedAITools;
    }

    const installedAITools: string[] = [];

    // Check each tool in parallel
    const detectionPromises = AI_TOOL_PATHS.map(async (agent) => {
        const isInstalled = await isAIToolInstalled(agent.key);
        return isInstalled ? agent.key : null;
    });

    const results = await Promise.all(detectionPromises);

    // Filter out null results
    for (const result of results) {
        if (result !== null) {
            installedAITools.push(result);
        }
    }

    // Cache the result
    cachedAITools = installedAITools;

    return installedAITools;
}

/**
 * Clear the AI tool detection cache
 * Useful for testing or when tool installation state may have changed
 */
export function clearAIToolCache(): void {
    cachedAITools = null;
}

/**
 * Override AI tool detection with a specific list of tools
 * Used when --agents flag is provided
 */
export function setDetectedAITools(tools: string[]): void {
    cachedAITools = [...tools];
}
