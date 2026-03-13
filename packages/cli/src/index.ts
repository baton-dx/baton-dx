import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isFirstRun } from "@baton-dx/core";
import { defineCommand, runMain } from "citty";
import { aiToolsCommand } from "./commands/ai-tools/index.js";
import { applyCommand } from "./commands/apply.js";
import { authCommand } from "./commands/auth/index.js";
import { configCommand } from "./commands/config/index.js";
import { diffCommand } from "./commands/diff.js";
import { idesCommand } from "./commands/ides/index.js";
import { initCommand } from "./commands/init.js";
import { manageCommand } from "./commands/manage.js";
import { previewCommand } from "./commands/preview.js";
import { profileCommand } from "./commands/profile/index.js";
import { selfUpdateCommand } from "./commands/self-update.js";
import { sourceCommand } from "./commands/source/index.js";
import { syncCommand } from "./commands/sync.js";

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
        json: {
            type: "boolean",
            alias: "j",
            description: "Output machine-readable JSON (for CI/CD integration)",
        },
    },
    subCommands: {
        init: initCommand,
        apply: applyCommand,
        sync: syncCommand,
        diff: diffCommand,
        preview: previewCommand,
        manage: manageCommand,
        config: configCommand,
        auth: authCommand,
        source: sourceCommand,
        profile: profileCommand,
        "ai-tools": aiToolsCommand,
        ides: idesCommand,
        "self-update": selfUpdateCommand,
    },
    async run({ args }) {
        // First-run hint (non-blocking)
        if (await isFirstRun()) {
            console.log("Tip: run `baton init` to set up Baton in your project.\n");
        }

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
            console.log("  apply      Apply locked configurations (deterministic, reproducible)");
            console.log("  sync       Fetch latest versions, sync, and update lockfile");
            console.log("  diff       Compare local files with remote source versions");
            console.log("  preview    Preview processed output for a specific AI tool");
            console.log("  manage     Interactive project management wizard");
            console.log("  config     Show dashboard overview or configure settings");
            console.log("");
            console.log("Resource commands:");
            console.log(
                "  source     Manage source repositories (create, list, connect, disconnect)",
            );
            console.log("  profile    Manage profiles (create, list, remove)");
            console.log("  ai-tools   Manage AI tool detection and configuration");
            console.log("  ides       Manage IDE platform detection and configuration");
            console.log("  auth       Authentication diagnostics (auth status)");
            console.log("");
            console.log("Maintenance:");
            console.log("  self-update  Update Baton to the latest stable version");
            console.log("");
            console.log("Global Options:");
            console.log("  --help, -h         Show this help message");
            console.log("  --version, -v      Show version number");
            console.log("  --yes, -y          Suppress all interactive prompts");
            console.log("  --dry-run          Show what would be done without writing files");
            console.log("  --verbose          Enable debug logging");
            console.log("  --json, -j         Output machine-readable JSON");
            return;
        }
    },
});

runMain(main);
