import { getAllAdapters, getGlobalAiTools, setGlobalAiTools } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

export const aiToolsConfigureCommand = defineCommand({
  meta: {
    name: "configure",
    description: "Manually configure which AI tools Baton manages",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Keep current selection unchanged (no-op)",
    },
  },
  async run({ args }) {
    p.intro("Baton - Configure AI Tools");

    const currentTools = await getGlobalAiTools();

    // --yes flag is a no-op (keeps current selection unchanged)
    if (args.yes) {
      if (currentTools.length > 0) {
        p.log.info(`Current AI tools: ${currentTools.join(", ")}`);
      } else {
        p.log.info("No AI tools currently configured.");
      }
      p.outro("No changes made.");
      return;
    }

    const allAdapters = getAllAdapters();

    const options = allAdapters.map((adapter) => {
      const isSaved = currentTools.includes(adapter.key);
      return {
        value: adapter.key,
        label: isSaved ? `${adapter.name} (currently saved)` : adapter.name,
      };
    });

    const selected = await p.multiselect({
      message: "Select which AI tools to save:",
      options,
      initialValues: currentTools,
    });

    if (p.isCancel(selected)) {
      p.outro("No changes made.");
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
      p.log.info("No changes made.");
    }

    p.outro("Configuration complete.");
  },
});
