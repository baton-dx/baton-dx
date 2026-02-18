import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";
import { aiToolsCommand } from "./commands/ai-tools/index.js";
import { configCommand } from "./commands/config.js";
import { diffCommand } from "./commands/diff.js";
import { idesCommand } from "./commands/ides/index.js";
import { initCommand } from "./commands/init.js";
import { manageCommand } from "./commands/manage.js";
import { profileCommand } from "./commands/profile/index.js";
import { sourceCommand } from "./commands/source/index.js";
import { syncCommand } from "./commands/sync.js";
import { updateCommand } from "./commands/update.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
let packageJson: { version?: string } = {};
try {
  packageJson = JSON.parse(await readFile(join(__dirname, "../package.json"), "utf-8"));
} catch {
  // Gracefully handle missing or malformed package.json
}

const main = defineCommand({
  meta: {
    name: "baton",
    version: packageJson.version,
    description:
      "The package manager for Developer Experience & AI configuration. Manages Skills, Rules, Agents, Memory Files as versioned profiles.",
  },
  args: {
    version: {
      type: "boolean",
      alias: "v",
      description: "Show version number",
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Suppress all interactive prompts (non-interactive mode)",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be done without writing any files",
    },
    verbose: {
      type: "boolean",
      description: "Enable debug logging",
    },
  },
  subCommands: {
    init: initCommand,
    sync: syncCommand,
    update: updateCommand,
    diff: diffCommand,
    manage: manageCommand,
    config: configCommand,
    source: sourceCommand,
    profile: profileCommand,
    "ai-tools": aiToolsCommand,
    ides: idesCommand,
  },
  run({ args }) {
    // Show help when no arguments provided
    if (Object.keys(args).length === 0) {
      console.log(`baton v${packageJson.version}`);
      console.log("");
      console.log("The package manager for Developer Experience & AI configuration.");
      console.log("");
      console.log("Usage:");
      console.log("  baton <command> [options]");
      console.log("");
      console.log("Available commands:");
      console.log("  init       Initialize Baton in your project");
      console.log("  sync       Sync all configurations to installed AI tools");
      console.log("  update     Check for and apply updates to installed packages");
      console.log("  diff       Compare local files with remote source versions");
      console.log("  manage     Interactive project management wizard");
      console.log("  config     Show dashboard overview or configure settings");
      console.log("");
      console.log("Resource commands:");
      console.log("  source     Manage source repositories (create, list, connect, disconnect)");
      console.log("  profile    Manage profiles (create, list, remove)");
      console.log("  ai-tools   Manage AI tool detection and configuration");
      console.log("  ides       Manage IDE platform detection and configuration");
      console.log("");
      console.log("Global Options:");
      console.log("  --help, -h         Show this help message");
      console.log("  --version, -v      Show version number");
      console.log("  --yes, -y          Suppress all interactive prompts");
      console.log("  --dry-run          Show what would be done without writing files");
      console.log("  --verbose          Enable debug logging");
      return;
    }
  },
});

runMain(main);
