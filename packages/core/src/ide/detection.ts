import { constants, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { evaluateDetection } from "../detection/mechanisms.js";
import { idePlatformRegistry } from "./platform-registry.js";

/**
 * Cache for detected IDE platforms (valid for process lifetime)
 */
let cachedIdes: string[] | null = null;

/**
 * Check if a command exists in PATH
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    const { execa } = await import("execa");
    await execa("which", [command]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect if a specific IDE platform is installed.
 * Uses detectionConfig (structured OR-of-ANDs) when present,
 * otherwise falls back to legacy detection string array.
 */
async function isIdeInstalled(ideKey: string): Promise<boolean> {
  const ideConfig = idePlatformRegistry[ideKey];
  if (!ideConfig) return false;

  // Prefer structured detectionConfig when available
  if (ideConfig.detectionConfig) {
    return evaluateDetection(ideConfig.detectionConfig);
  }

  // Legacy fallback: check each detection method
  for (const detection of ideConfig.detection) {
    // If detection string starts with ~/, it's a directory path
    if (detection.startsWith("~/")) {
      const dirPath = join(homedir(), detection.slice(2));
      if (await directoryExists(dirPath)) {
        return true;
      }
    }
    // If detection string starts with ., it's a directory path relative to home
    else if (detection.startsWith(".")) {
      const dirPath = join(homedir(), detection);
      if (await directoryExists(dirPath)) {
        return true;
      }
    }
    // Otherwise, treat it as a CLI binary name
    else {
      if (await commandExists(detection)) {
        return true;
      }
    }
  }

  return false;
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
