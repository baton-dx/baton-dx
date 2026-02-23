import { gt } from "semver";
import { z } from "zod";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/@baton-dx/cli/latest";

const npmRegistryResponseSchema = z.object({
  version: z.string(),
  description: z.string().optional(),
});

export interface LatestVersionResult {
  version: string;
  description?: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
}

/**
 * Check if a newer version is available by comparing current vs latest.
 * Uses semver for accurate comparison.
 */
export function isUpdateAvailable(
  currentVersion: string,
  latestVersion: string,
): UpdateCheckResult {
  return {
    currentVersion,
    latestVersion,
    updateAvailable: gt(latestVersion, currentVersion),
  };
}

/**
 * Fetch the latest stable version of @baton-dx/cli from the npm registry.
 * Uses Node.js native fetch (available since Node 18).
 */
export async function checkLatestVersion(): Promise<LatestVersionResult> {
  const response = await fetch(NPM_REGISTRY_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to check for updates: npm registry returned ${response.status}`);
  }

  const parsed = npmRegistryResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Failed to parse version from npm registry response");
  }

  return {
    version: parsed.data.version,
    description: parsed.data.description,
  };
}
