import { getAgentConfig, getAllAgentKeys } from "@baton-dx/agent-paths";
import {
  clearAgentCache,
  detectInstalledAgents,
  getGlobalAiTools,
  setGlobalAiTools,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

export const aiToolsScanCommand = defineCommand({
  meta: {
    name: "scan",
    description: "Scan your system for AI tools and save results to global config",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Automatically save detected tools without confirmation",
    },
  },
  async run({ args }) {
    p.intro("Baton - AI Tool Scanner");

    const spinner = p.spinner();
    spinner.start("Scanning for AI tools...");

    // Clear cache to force fresh detection
    clearAgentCache();

    const detectedAgents = await detectInstalledAgents();
    const allAgentKeys = getAllAgentKeys();
    const currentTools = await getGlobalAiTools();

    spinner.stop("Scan complete.");

    // Categorize agents
    const installed: { key: string; name: string }[] = [];
    const notInstalled: { key: string; name: string }[] = [];

    for (const agentKey of allAgentKeys) {
      const config = getAgentConfig(agentKey);
      const entry = { key: agentKey, name: config.name };

      if (detectedAgents.includes(agentKey)) {
        installed.push(entry);
      } else {
        notInstalled.push(entry);
      }
    }

    // Display results
    if (installed.length > 0) {
      p.log.success(`Found ${installed.length} AI tool${installed.length !== 1 ? "s" : ""}:`);
      for (const agent of installed) {
        const alreadySaved = currentTools.includes(agent.key);
        const badge = alreadySaved ? " (saved)" : " (new)";
        console.log(`  \x1b[32m✓\x1b[0m ${agent.name}${badge}`);
      }
    } else {
      p.log.warn("No AI tools detected on your system.");
      p.outro("Scan finished.");
      return;
    }

    if (notInstalled.length > 0) {
      console.log("");
      p.log.info(`Not detected (${notInstalled.length}):`);
      for (const agent of notInstalled) {
        console.log(`  \x1b[90m✗ ${agent.name}\x1b[0m`);
      }
    }

    // Save detected tools to global config
    const detectedKeys = installed.map((a) => a.key);
    const hasChanges =
      detectedKeys.length !== currentTools.length ||
      detectedKeys.some((key) => !currentTools.includes(key));

    if (hasChanges) {
      console.log("");
      let shouldSave = args.yes;

      if (!shouldSave) {
        const confirm = await p.confirm({
          message: "Save detected tools to global config (~/.baton/config.yaml)?",
        });

        if (p.isCancel(confirm)) {
          p.outro("Scan finished (not saved).");
          return;
        }

        shouldSave = confirm;
      }

      if (shouldSave) {
        await setGlobalAiTools(detectedKeys);
        p.log.success("Tools saved to global config.");
      }
    } else {
      console.log("");
      p.log.info("Global config is already up to date.");
    }

    p.outro("Scan finished.");
  },
});
