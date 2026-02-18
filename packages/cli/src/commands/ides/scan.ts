import {
  clearIdeCache,
  detectInstalledIdes,
  getGlobalIdePlatforms,
  getRegisteredIdePlatforms,
  setGlobalIdePlatforms,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { formatIdeName } from "./utils.js";

export const idesScanCommand = defineCommand({
  meta: {
    name: "scan",
    description: "Scan your system for IDE platforms and save results to global config",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Automatically save detected platforms without confirmation",
    },
  },
  async run({ args }) {
    p.intro("Baton - IDE Platform Scanner");

    const spinner = p.spinner();
    spinner.start("Scanning for IDE platforms...");

    // Clear cache to force fresh detection
    clearIdeCache();

    const detectedIdes = await detectInstalledIdes();
    const allIdeKeys = getRegisteredIdePlatforms();
    const currentPlatforms = await getGlobalIdePlatforms();

    spinner.stop("Scan complete.");

    // Categorize IDEs
    const installed: { key: string; name: string }[] = [];
    const notInstalled: { key: string; name: string }[] = [];

    for (const ideKey of allIdeKeys) {
      const entry = { key: ideKey, name: formatIdeName(ideKey) };

      if (detectedIdes.includes(ideKey)) {
        installed.push(entry);
      } else {
        notInstalled.push(entry);
      }
    }

    // Display results
    if (installed.length > 0) {
      p.log.success(`Found ${installed.length} IDE platform${installed.length !== 1 ? "s" : ""}:`);
      for (const ide of installed) {
        const alreadySaved = currentPlatforms.includes(ide.key);
        const badge = alreadySaved ? " (saved)" : " (new)";
        console.log(`  \x1b[32m✓\x1b[0m ${ide.name}${badge}`);
      }
    } else {
      p.log.warn("No IDE platforms detected on your system.");
      p.outro("Scan finished.");
      return;
    }

    if (notInstalled.length > 0) {
      console.log("");
      p.log.info(`Not detected (${notInstalled.length}):`);
      for (const ide of notInstalled) {
        console.log(`  \x1b[90m✗ ${ide.name}\x1b[0m`);
      }
    }

    // Save detected platforms to global config
    const detectedKeys = installed.map((i) => i.key);
    const hasChanges =
      detectedKeys.length !== currentPlatforms.length ||
      detectedKeys.some((key) => !currentPlatforms.includes(key));

    if (hasChanges) {
      console.log("");
      let shouldSave = args.yes;

      if (!shouldSave) {
        const confirm = await p.confirm({
          message: "Save detected platforms to global config (~/.baton/config.yaml)?",
        });

        if (p.isCancel(confirm)) {
          p.outro("Scan finished (not saved).");
          return;
        }

        shouldSave = confirm;
      }

      if (shouldSave) {
        await setGlobalIdePlatforms(detectedKeys);
        p.log.success("Platforms saved to global config.");
      }
    } else {
      console.log("");
      p.log.info("Global config is already up to date.");
    }

    p.outro("Scan finished.");
  },
});
