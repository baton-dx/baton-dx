import { readdir } from "node:fs/promises";
import { loadProfileManifestSafe as loadProfileManifest } from "./load-profile-safe.js";

/**
 * Information about a discovered profile
 */
export interface ProfileInfo {
    /**
     * Profile name (from manifest or inferred from directory)
     */
    name: string;

    /**
     * Relative path to the profile from the source root
     * - "." for root profile
     * - "frontend" for sub-profile in frontend/
     */
    path: string;

    /**
     * Profile version from manifest
     */
    version: string;

    /**
     * Profile description from manifest (optional)
     */
    description?: string;
}

/**
 * Discovers all profiles in a source repository
 *
 * This function:
 * 1. Scans the root directory for baton.profile.yaml
 * 2. Scans one level deep for sub-profiles
 * 3. Loads manifest metadata (name, version, description) for each profile
 *
 * @param sourceRoot - Absolute path to the source repository root
 * @returns Array of ProfileInfo objects for all discovered profiles
 * @throws Error if manifest files are invalid or cannot be read
 */
export async function discoverProfiles(sourceRoot: string): Promise<ProfileInfo[]> {
    const profiles: ProfileInfo[] = [];

    // Check for root profile
    const rootManifest = await loadProfileManifest(sourceRoot, ".");
    if (rootManifest) {
        profiles.push({
            name: rootManifest.name,
            path: ".",
            version: rootManifest.version,
            description: rootManifest.description,
        });
    }

    // Scan one level deep for sub-profiles
    try {
        const entries = await readdir(sourceRoot, { withFileTypes: true });

        for (const entry of entries) {
            // Only check directories (skip files)
            if (!entry.isDirectory()) {
                continue;
            }

            // Skip hidden directories and common non-profile directories
            if (entry.name.startsWith(".") || entry.name === "node_modules") {
                continue;
            }

            const subProfilePath = entry.name;
            const manifest = await loadProfileManifest(sourceRoot, subProfilePath);

            if (manifest) {
                profiles.push({
                    name: manifest.name,
                    path: subProfilePath,
                    version: manifest.version,
                    description: manifest.description,
                });
            }
        }
    } catch (_error) {
        // If readdir fails, just return root profile (if found)
        // This allows discovery to work even if permissions are restricted
    }

    return profiles;
}
