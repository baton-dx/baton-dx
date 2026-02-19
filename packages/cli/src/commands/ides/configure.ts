import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  getGlobalIdePlatforms,
  getRegisteredIdePlatforms,
  readProjectPreferences,
  setGlobalIdePlatforms,
  writeProjectPreferences,
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
      description:
        "Keep current selection unchanged (no-op), or with --project write useGlobal: true",
    },
    project: {
      type: "boolean",
      description: "Configure IDE platforms for this project instead of globally",
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
  p.intro("Baton - Configure IDE Platforms");

  const currentPlatforms = await getGlobalIdePlatforms();

  // --yes flag is a no-op (keeps current selection unchanged)
  if (nonInteractive) {
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
}

async function runProjectMode(nonInteractive: boolean): Promise<void> {
  p.intro("Baton - Configure IDE Platforms (Project)");

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
      ai: existing?.ai ?? { useGlobal: true, tools: [] },
      ide: { useGlobal: true, platforms: existing?.ide.platforms ?? [] },
    });
    p.log.info("Set IDE platforms to use global config for this project.");
    p.outro("Configuration complete.");
    return;
  }

  const globalPlatforms = await getGlobalIdePlatforms();
  const allIdeKeys = getRegisteredIdePlatforms();

  // Show context
  if (globalPlatforms.length > 0) {
    p.log.info(`Global IDE platforms: ${globalPlatforms.join(", ")}`);
  }

  const options = allIdeKeys.map((ideKey) => {
    const isGlobal = globalPlatforms.includes(ideKey);
    return {
      value: ideKey,
      label: isGlobal ? `${formatIdeName(ideKey)} (in global config)` : formatIdeName(ideKey),
    };
  });

  const selected = await p.multiselect({
    message: "Select IDE platforms for this project:",
    options,
    initialValues: globalPlatforms,
  });

  if (p.isCancel(selected)) {
    p.outro("No changes made.");
    return;
  }

  const selectedKeys = selected as string[];

  // Follow-up: use selection or fall back to global?
  const mode = await p.select({
    message: "How should this project resolve IDE platforms?",
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
      ai: existing?.ai ?? { useGlobal: true, tools: [] },
      ide: { useGlobal: false, platforms: selectedKeys },
    });
    p.log.success(`Project configured with ${selectedKeys.length} IDE platform(s).`);
  } else {
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: existing?.ai ?? { useGlobal: true, tools: [] },
      ide: { useGlobal: true, platforms: [] },
    });
    p.log.success("Project configured to use global IDE platforms.");
  }

  p.outro("Configuration complete.");
}
