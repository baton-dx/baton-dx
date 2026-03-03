import { evaluateDetection } from "../detection/mechanisms.js";
import { idePlatformRegistry } from "./platform-registry.js";

/**
 * Cache for detected IDE platforms (valid for process lifetime)
 */
let cachedIdes: string[] | null = null;

/**
 * Detect if a specific IDE platform is installed using structured detectionConfig.
 */
async function isIdeInstalled(ideKey: string): Promise<boolean> {
    const ideConfig = idePlatformRegistry[ideKey];
    if (!ideConfig) return false;

    return evaluateDetection(ideConfig.detectionConfig);
}

/**
 * Detect all installed IDE platforms.
 * Results are cached for the duration of the process.
 */
export async function detectInstalledIdes(): Promise<string[]> {
    if (cachedIdes !== null) {
        return cachedIdes;
    }

    const ideKeys = Object.keys(idePlatformRegistry);

    // Check each IDE in parallel
    const detectionPromises = ideKeys.map(async (ideKey) => {
        const isInstalled = await isIdeInstalled(ideKey);
        return isInstalled ? ideKey : null;
    });

    const results = await Promise.all(detectionPromises);

    const installedIdes = results.filter((result): result is string => result !== null);

    // Cache the result
    cachedIdes = installedIdes;

    return installedIdes;
}

/**
 * Clear the IDE detection cache.
 * Useful for testing or when IDE installation state may have changed.
 */
export function clearIdeCache(): void {
    cachedIdes = null;
}

/**
 * Override IDE detection with a specific list of platforms.
 * Used for testing or when platforms are explicitly configured.
 */
export function setDetectedIdes(ides: string[]): void {
    cachedIdes = [...ides];
}
