import { readdir, stat } from "node:fs/promises";
import { getAgentConfig, getAgentPath, getAllAgentKeys } from "@baton-dx/agent-paths";
import { getGlobalAiTools } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

export const aiToolsListCommand = defineCommand({
  meta: {
    name: "list",
    description: "Show saved AI tools from global config and their configuration status",
  },
  args: {
    all: {
      type: "boolean",
      alias: "a",
      description: "Show all supported tools, not just saved ones",
    },
    json: {
      type: "boolean",
      description: "Output machine-readable JSON",
      alias: "j",
    },
  },
  async run({ args }) {
    if (!args.json) {
      p.intro("Baton - AI Tools");
    }

    // Load saved tools from global config
    const savedTools = await getGlobalAiTools();
    const allAgentKeys = getAllAgentKeys();

    // Determine which tools to show
    const keysToShow = args.all ? allAgentKeys : savedTools.length > 0 ? savedTools : allAgentKeys;

    const agentStatuses = await Promise.all(
      keysToShow.map(async (agentKey) => {
        const isSaved = savedTools.includes(agentKey);

        // Count installed configs for this agent
        let skillCount = 0;
        let ruleCount = 0;
        let agentCount = 0;
        let memoryCount = 0;
        let commandCount = 0;

        if (isSaved) {
          skillCount = await countConfigs(agentKey, "skills", "project");
          ruleCount = await countConfigs(agentKey, "rules", "project");
          agentCount = await countConfigs(agentKey, "agents", "project");
          memoryCount = await countConfigs(agentKey, "memory", "project");
          commandCount = await countConfigs(agentKey, "commands", "project");
        }

        // Get path locations for each config type
        const paths = {
          skills: getAgentPath(agentKey, "skills", "project", ""),
          rules: getAgentPath(agentKey, "rules", "project", ""),
          agents: getAgentPath(agentKey, "agents", "project", ""),
          memory: getAgentPath(agentKey, "memory", "project", ""),
          commands: getAgentPath(agentKey, "commands", "project", ""),
        };

        const config = getAgentConfig(agentKey);

        return {
          key: agentKey,
          name: config.name,
          saved: isSaved,
          counts: {
            skills: skillCount,
            rules: ruleCount,
            agents: agentCount,
            memory: memoryCount,
            commands: commandCount,
          },
          paths,
        };
      }),
    );

    // JSON output
    if (args.json) {
      console.log(JSON.stringify(agentStatuses, null, 2));
      return;
    }

    // Formatted output
    if (savedTools.length === 0) {
      p.log.warn("No AI tools saved in global config.");
      p.log.info("Run 'baton ai-tools scan' to detect and save your AI tools.");
      console.log("");
      p.log.info(`All ${allAgentKeys.length} supported tools:`);
      for (const key of allAgentKeys) {
        const config = getAgentConfig(key);
        console.log(`  \x1b[90m- ${config.name}\x1b[0m`);
      }
      p.outro("Run 'baton ai-tools scan' to get started.");
      return;
    }

    console.log(`\nSaved AI tools (${savedTools.length}):\n`);

    for (const agent of agentStatuses) {
      const statusColor = agent.saved ? "\x1b[32m" : "\x1b[90m";
      const status = agent.saved ? "✓" : "✗";
      const resetColor = "\x1b[0m";

      console.log(`${statusColor}${status}${resetColor} ${agent.name.padEnd(20)}`);

      if (agent.saved) {
        const totalConfigs =
          agent.counts.skills +
          agent.counts.rules +
          agent.counts.agents +
          agent.counts.memory +
          agent.counts.commands;

        if (totalConfigs > 0) {
          const details = [];
          if (agent.counts.skills > 0) details.push(`${agent.counts.skills} skills`);
          if (agent.counts.rules > 0) details.push(`${agent.counts.rules} rules`);
          if (agent.counts.agents > 0) details.push(`${agent.counts.agents} agents`);
          if (agent.counts.memory > 0) details.push(`${agent.counts.memory} memory`);
          if (agent.counts.commands > 0) details.push(`${agent.counts.commands} commands`);

          console.log(`  → ${details.join(", ")}`);
        }
      }

      console.log("");
    }

    p.outro(
      "Manage tools: 'baton ai-tools scan' (detect) | 'baton config set default-tools <tools>'",
    );
  },
});

/**
 * Count config files of a given type for an agent
 */
async function countConfigs(
  agentKey: string,
  configType: "skills" | "rules" | "agents" | "memory" | "commands",
  scope: "project" | "global",
): Promise<number> {
  try {
    const basePath = getAgentPath(agentKey, configType, scope, "");
    const dirPath = basePath.replace(/{name}.*$/, "").replace(/\/$/, "");

    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      return 0;
    }

    const items = await readdir(dirPath);
    return items.length;
  } catch (_error) {
    return 0;
  }
}
