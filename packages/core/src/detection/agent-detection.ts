import { AGENT_PATHS } from "@baton-dx/agent-paths";
import { evaluateDetection } from "./mechanisms.js";

/**
 * Cache for detected agents (valid for process lifetime)
 */
let cachedAgents: string[] | null = null;

/**
 * Detect if a specific agent is installed using structured detectionConfig.
 */
async function isAgentInstalled(agentKey: string): Promise<boolean> {
  const agentConfig = AGENT_PATHS.find((agent) => agent.key === agentKey);
  if (!agentConfig?.detectionConfig) return false;

  return evaluateDetection(agentConfig.detectionConfig);
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
