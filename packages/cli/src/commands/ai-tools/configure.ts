import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  getAllAdapters,
  getGlobalAiTools,
  readProjectPreferences,
  setGlobalAiTools,
  writeProjectPreferences,
} from "@baton-dx/core";
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
      description:
        "Keep current selection unchanged (no-op), or with --project write useGlobal: true",
    },
    project: {
      type: "boolean",
      description: "Configure AI tools for this project instead of globally",
    },
  },
  async run({ args }) {
    if (args.project) {
      await runProjectMode(args.yes ?? false);
    } else {
      await runGlobalMode(args.yes ?? false);
    }
  },
});

async function runGlobalMode(nonInteractive: boolean): Promise<void> {
  p.intro("Baton - Configure AI Tools");

  const currentTools = await getGlobalAiTools();

  // --yes flag is a no-op (keeps current selection unchanged)
  if (nonInteractive) {
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
}

async function runProjectMode(nonInteractive: boolean): Promise<void> {
  p.intro("Baton - Configure AI Tools (Project)");

  const projectRoot = process.cwd();
  const manifestPath = resolve(projectRoot, "baton.yaml");

  // Check that baton.yaml exists
  try {
    await stat(manifestPath);
  } catch {
    p.cancel("No baton.yaml found in current directory. Run `baton init` first.");
    process.exit(1);
  }

  // --yes with --project writes useGlobal: true
  if (nonInteractive) {
    const existing = await readProjectPreferences(projectRoot);
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: { useGlobal: true, tools: existing?.ai.tools ?? [] },
      ide: existing?.ide ?? { useGlobal: true, platforms: [] },
    });
    p.log.info("Set AI tools to use global config for this project.");
    p.outro("Configuration complete.");
    return;
  }

  const globalTools = await getGlobalAiTools();
  const allAdapters = getAllAdapters();

  // Show context
  if (globalTools.length > 0) {
    p.log.info(`Global AI tools: ${globalTools.join(", ")}`);
  }

  const options = allAdapters.map((adapter) => {
    const isGlobal = globalTools.includes(adapter.key);
    return {
      value: adapter.key,
      label: isGlobal ? `${adapter.name} (in global config)` : adapter.name,
    };
  });

  const selected = await p.multiselect({
    message: "Select AI tools for this project:",
    options,
    initialValues: globalTools,
  });

  if (p.isCancel(selected)) {
    p.outro("No changes made.");
    return;
  }

  const selectedKeys = selected as string[];

  // Follow-up: use selection or fall back to global?
  const mode = await p.select({
    message: "How should this project resolve AI tools?",
    options: [
      { value: "project", label: "Use selection above" },
      { value: "global", label: "Use global config" },
    ],
  });

  if (p.isCancel(mode)) {
    p.outro("No changes made.");
    return;
  }

  const existing = await readProjectPreferences(projectRoot);

  if (mode === "project") {
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: { useGlobal: false, tools: selectedKeys },
      ide: existing?.ide ?? { useGlobal: true, platforms: [] },
    });
    p.log.success(`Project configured with ${selectedKeys.length} AI tool(s).`);
  } else {
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: { useGlobal: true, tools: [] },
      ide: existing?.ide ?? { useGlobal: true, platforms: [] },
    });
    p.log.success("Project configured to use global AI tools.");
  }

  p.outro("Configuration complete.");
}
