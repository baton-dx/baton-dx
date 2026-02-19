import { constants, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AGENT_PATHS } from "@baton-dx/agent-paths";
import { evaluateDetection } from "./mechanisms.js";

/**
 * Cache for detected agents (valid for process lifetime)
 */
let cachedAgents: string[] | null = null;

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
 * Detect if a specific agent is installed.
 * Uses detectionConfig (structured OR-of-ANDs) when present,
 * otherwise falls back to legacy detection string array.
 */
async function isAgentInstalled(agentKey: string): Promise<boolean> {
  const agentConfig = AGENT_PATHS.find((agent) => agent.key === agentKey);
  if (!agentConfig) return false;

  // Prefer structured detectionConfig when available
  if (agentConfig.detectionConfig) {
    return evaluateDetection(agentConfig.detectionConfig);
  }

  // Legacy fallback: check each detection method
  for (const detection of agentConfig.detection) {
    // If detection string starts with ~/, it's a directory path
    if (detection.startsWith("~/")) {
      const dirPath = join(homedir(), detection.slice(2));
      if (await directoryExists(dirPath)) {
        return true;
      }
    }
    // If detection string starts with ., it's also a directory path relative to home
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
 * Detect all installed AI agents
 * Results are cached for the duration of the process
 */
export async function detectInstalledAgents(): Promise<string[]> {
  // Return cached result if available
  if (cachedAgents !== null) {
    return cachedAgents;
  }

  const installedAgents: string[] = [];

  // Check each agent in parallel
  const detectionPromises = AGENT_PATHS.map(async (agent) => {
    const isInstalled = await isAgentInstalled(agent.key);
    return isInstalled ? agent.key : null;
  });

  const results = await Promise.all(detectionPromises);

  // Filter out null results
  for (const result of results) {
    if (result !== null) {
      installedAgents.push(result);
    }
  }

  // Cache the result
  cachedAgents = installedAgents;

  return installedAgents;
}

/**
 * Clear the agent detection cache
 * Useful for testing or when agent installation state may have changed
 */
export function clearAgentCache(): void {
  cachedAgents = null;
}

/**
 * Override agent detection with a specific list of agents
 * Used when --agents flag is provided
 */
export function setDetectedAgents(agents: string[]): void {
  cachedAgents = [...agents];
}
