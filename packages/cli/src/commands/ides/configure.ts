import {
  getGlobalIdePlatforms,
  getRegisteredIdePlatforms,
  setGlobalIdePlatforms,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { formatIdeName } from "./utils.js";

export const idesConfigureCommand = defineCommand({
  meta: {
    name: "configure",
    description: "Manually configure which IDE platforms Baton manages",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Keep current selection unchanged (no-op)",
    },
  },
  async run({ args }) {
    p.intro("Baton - Configure IDE Platforms");

    const currentPlatforms = await getGlobalIdePlatforms();

    // --yes flag is a no-op (keeps current selection unchanged)
    if (args.yes) {
      if (currentPlatforms.length > 0) {
        p.log.info(`Current IDE platforms: ${currentPlatforms.join(", ")}`);
      } else {
        p.log.info("No IDE platforms currently configured.");
      }
      p.outro("No changes made.");
      return;
    }

    const allIdeKeys = getRegisteredIdePlatforms();

    const options = allIdeKeys.map((ideKey) => {
      const isSaved = currentPlatforms.includes(ideKey);
      return {
        value: ideKey,
        label: isSaved ? `${formatIdeName(ideKey)} (currently saved)` : formatIdeName(ideKey),
      };
    });

    const selected = await p.multiselect({
      message: "Select which IDE platforms to save:",
      options,
      initialValues: currentPlatforms,
    });

    if (p.isCancel(selected)) {
      p.outro("No changes made.");
      return;
    }

    const selectedKeys = selected as string[];

    const hasChanges =
      selectedKeys.length !== currentPlatforms.length ||
      selectedKeys.some((key) => !currentPlatforms.includes(key));

    if (hasChanges) {
      await setGlobalIdePlatforms(selectedKeys);
      p.log.success(`Saved ${selectedKeys.length} platform(s) to global config.`);
    } else {
      p.log.info("No changes made.");
    }

    p.outro("Configuration complete.");
  },
});
