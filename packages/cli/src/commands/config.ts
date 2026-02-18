import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { getAgentConfig } from "@baton-dx/agent-paths";
import type { ProjectManifest } from "@baton-dx/core";
import {
  getGlobalAiTools,
  getGlobalIdePlatforms,
  getGlobalSources,
  loadProjectManifest,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { parse, stringify } from "yaml";
import { buildIntersection } from "../utils/build-intersection.js";
import { formatIntersectionSummary } from "../utils/intersection-display.js";

interface BatonConfig {
  "cache-dir"?: string;
  "default-scope"?: "project" | "global";
  "symlink-mode"?: boolean;
  "default-tools"?: string[];
}

const CONFIG_FILE = join(homedir(), ".baton", "config.yaml");
const VALID_KEYS = ["cache-dir", "default-scope", "symlink-mode", "default-tools"] as const;

async function loadConfig(): Promise<BatonConfig> {
  try {
    await access(CONFIG_FILE);
  } catch {
    return {};
  }
  const content = await readFile(CONFIG_FILE, "utf-8");
  return parse(content) as BatonConfig;
}

async function saveConfig(config: BatonConfig): Promise<void> {
  const configDir = dirname(CONFIG_FILE);
  await mkdir(configDir, { recursive: true });
  await writeFile(CONFIG_FILE, stringify(config), "utf-8");
}

async function showDashboard(): Promise<void> {
  p.intro("Baton Dashboard");

  // Fetch all data in parallel
  const [sources, aiTools, idePlatforms, projectManifest] = await Promise.all([
    getGlobalSources(),
    getGlobalAiTools(),
    getGlobalIdePlatforms(),
    loadProjectManifestSafe(),
  ]);

  // --- Global Sources ---
  console.log("");
  p.log.step("Global Sources");
  if (sources.length === 0) {
    p.log.info("  No sources configured. Run: baton source connect <url>");
  } else {
    for (const source of sources) {
      const defaultBadge = source.default ? " (default)" : "";
      const desc = source.description ? ` — ${source.description}` : "";
      p.log.info(`  ${source.name}${defaultBadge}: ${source.url}${desc}`);
    }
  }

  // --- Developer Tools ---
  console.log("");
  p.log.step("Developer Tools");
  if (aiTools.length === 0 && idePlatforms.length === 0) {
    p.log.info("  No tools configured. Run: baton ai-tools scan && baton ides scan");
  } else {
    if (aiTools.length > 0) {
      const toolNames = aiTools.map((key) => {
        try {
          return getAgentConfig(key).name;
        } catch {
          return key;
        }
      });
      p.log.info(`  AI Tools: ${toolNames.join(", ")}`);
    }
    if (idePlatforms.length > 0) {
      p.log.info(`  IDE Platforms: ${idePlatforms.join(", ")}`);
    }
  }

  // --- Current Project ---
  console.log("");
  p.log.step("Current Project");
  if (!projectManifest) {
    p.log.info("  Not inside a Baton project. Run: baton init");
  } else if (projectManifest.profiles.length === 0) {
    p.log.info("  No profiles installed. Run: baton manage");
  } else {
    for (const profile of projectManifest.profiles) {
      const version = profile.version ? ` (${profile.version})` : "";
      p.log.info(`  ${profile.source}${version}`);
    }
  }

  // --- Active Intersections ---
  if (projectManifest && projectManifest.profiles.length > 0) {
    const hasDeveloperTools = aiTools.length > 0 || idePlatforms.length > 0;

    if (hasDeveloperTools) {
      const developerTools = { aiTools, idePlatforms };
      console.log("");
      p.log.step("Active Intersections");

      for (const profile of projectManifest.profiles) {
        try {
          const intersection = await buildIntersection(
            profile.source,
            developerTools,
            process.cwd(),
          );
          if (intersection) {
            const summary = formatIntersectionSummary(intersection);
            p.log.info(`  ${profile.source}: ${summary}`);
          }
        } catch {
          // Best-effort — skip if intersection cannot be computed
        }
      }
    }
  }

  console.log("");
  p.outro("Use 'baton config list' to view configuration settings");
}

async function loadProjectManifestSafe(): Promise<ProjectManifest | null> {
  try {
    return await loadProjectManifest(join(process.cwd(), "baton.yaml"));
  } catch {
    return null;
  }
}

export const configCommand = defineCommand({
  meta: {
    name: "config",
    description: "Show Baton dashboard overview or configure settings (set, get, list)",
  },
  args: {
    action: {
      type: "positional",
      description: "Action: set, get, or list",
      required: false,
    },
    key: {
      type: "positional",
      description: "Configuration key",
      required: false,
    },
    value: {
      type: "positional",
      description: "Configuration value (for set)",
      required: false,
    },
  },
  async run({ args }) {
    const action = args.action as string | undefined;
    const key = args.key as string | undefined;
    const value = args.value as string | undefined;

    // Show dashboard if no action provided
    if (!action) {
      await showDashboard();
      return;
    }

    const selectedAction = action;

    if (selectedAction === "list") {
      p.intro("⚙️  Baton Configuration");

      const config = await loadConfig();
      if (Object.keys(config).length === 0) {
        p.outro("No configuration set. Using defaults.");
        return;
      }

      console.log("");
      for (const [configKey, configValue] of Object.entries(config)) {
        console.log(
          `${configKey}: ${Array.isArray(configValue) ? configValue.join(", ") : configValue}`,
        );
      }
      console.log("");

      p.outro("Configuration loaded");
      return;
    }

    if (selectedAction === "get") {
      if (!key) {
        p.intro("⚙️  Baton Configuration");
        p.outro("Error: Missing key argument. Usage: baton config get <key>");
        process.exit(1);
      }

      if (!VALID_KEYS.includes(key as (typeof VALID_KEYS)[number])) {
        p.intro("⚙️  Baton Configuration");
        p.outro(`Error: Invalid key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      const config = await loadConfig();
      const configValue = config[key as keyof BatonConfig];

      if (configValue === undefined) {
        p.intro("⚙️  Baton Configuration");
        p.outro(`"${key}" is not set (using default)`);
        return;
      }

      console.log(Array.isArray(configValue) ? configValue.join(", ") : configValue);
      return;
    }

    if (selectedAction === "set") {
      if (!key || !value) {
        p.intro("⚙️  Baton Configuration");
        p.outro("Error: Missing arguments. Usage: baton config set <key> <value>");
        process.exit(1);
      }

      if (!VALID_KEYS.includes(key as (typeof VALID_KEYS)[number])) {
        p.intro("⚙️  Baton Configuration");
        p.outro(`Error: Invalid key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      p.intro("⚙️  Baton Configuration");

      const config = await loadConfig();

      // Type-safe value parsing based on key
      if (key === "default-scope") {
        if (value !== "project" && value !== "global") {
          p.outro('Error: default-scope must be either "project" or "global"');
          process.exit(1);
        }
        config["default-scope"] = value;
      } else if (key === "symlink-mode") {
        if (value !== "true" && value !== "false") {
          p.outro('Error: symlink-mode must be either "true" or "false"');
          process.exit(1);
        }
        config["symlink-mode"] = value === "true";
      } else if (key === "default-tools") {
        // Parse comma-separated list
        config["default-tools"] = value.split(",").map((s) => s.trim());
      } else if (key === "cache-dir") {
        config["cache-dir"] = value;
      }

      await saveConfig(config);

      p.outro(
        `✓ Set ${key} = ${Array.isArray(config[key as keyof BatonConfig]) ? (config[key as keyof BatonConfig] as string[]).join(", ") : config[key as keyof BatonConfig]}`,
      );
      return;
    }

    p.intro("⚙️  Baton Configuration");
    p.outro(`Error: Unknown action "${selectedAction}". Use: set, get, or list`);
    process.exit(1);
  },
});
