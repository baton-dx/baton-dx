import {
  clearAgentCache,
  detectInstalledAgents,
  getAllAdapters,
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
    const allAdapters = getAllAdapters();
    const currentTools = await getGlobalAiTools();

    spinner.stop("Scan complete.");

    if (detectedAgents.length > 0) {
      p.log.success(
        `Found ${detectedAgents.length} AI tool${detectedAgents.length !== 1 ? "s" : ""} on your system.`,
      );
    } else {
      p.log.warn("No AI tools detected on your system.");
    }

    // --yes flag: save only detected tools (preserves current behavior)
    if (args.yes) {
      const detectedKeys = detectedAgents;
      const hasChanges =
        detectedKeys.length !== currentTools.length ||
        detectedKeys.some((key) => !currentTools.includes(key));

      if (hasChanges) {
        await setGlobalAiTools(detectedKeys);
        p.log.success(`Saved ${detectedKeys.length} detected tool(s) to global config.`);
      } else {
        p.log.info("Global config is already up to date.");
      }

      p.outro("Scan finished.");
      return;
    }

    // Interactive: show multiselect with all 14 tools
    const options = allAdapters.map((adapter) => {
      const isDetected = detectedAgents.includes(adapter.key);
      return {
        value: adapter.key,
        label: isDetected ? `${adapter.name} (detected)` : adapter.name,
      };
    });

    const selected = await p.multiselect({
      message: "Select which AI tools to save:",
      options,
      initialValues: detectedAgents,
    });

    if (p.isCancel(selected)) {
      p.outro("Scan finished (not saved).");
      return;
    }

    const selectedKeys = selected as string[];

    const hasChanges =
      selectedKeys.length !== currentTools.length ||
      selectedKeys.some((key) => !currentTools.includes(key));

    if (hasChanges) {
      await setGlobalAiTools(selectedKeys);
      p.log.success(`Saved ${selectedKeys.length} tool(s) to global config.`);
    } else {
      p.log.info("Global config is already up to date.");
    }

    p.outro("Scan finished.");
  },
});
