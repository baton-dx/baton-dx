import { execFile } from "node:child_process";
import {
  checkLatestVersion,
  detectInstallMethod,
  formatInstallCommand,
  isUpdateAvailable,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { readCurrentVersion } from "../utils/read-current-version.js";

export const selfUpdateCommand = defineCommand({
  meta: {
    name: "self-update",
    description: "Update Baton to the latest stable version",
  },
  args: {
    changelog: {
      type: "boolean",
      description: "Show release notes for the new version",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "Check for updates without performing the update",
      default: false,
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompt",
      default: false,
    },
  },
  async run({ args }) {
    p.intro("baton self-update");

    const currentVersion = await readCurrentVersion();

    // Check latest version
    const s = p.spinner();
    s.start("Checking for updates...");

    let latestVersion: string;
    try {
      const result = await checkLatestVersion();
      latestVersion = result.version;
    } catch (error) {
      s.stop("Failed to check for updates");
      p.log.error(error instanceof Error ? error.message : "Unknown error occurred");
      p.outro("Update check failed.");
      process.exit(1);
    }

    s.stop("Version check complete");

    // Compare versions
    const { updateAvailable } = isUpdateAvailable(currentVersion, latestVersion);
    if (!updateAvailable) {
      p.log.success(`Already up to date (v${currentVersion}).`);
      p.outro("No update needed.");
      return;
    }

    // Detect install method
    const installMethod = await detectInstallMethod();
    const displayCommand = formatInstallCommand(installMethod);

    p.log.info(
      [
        `Current version: v${currentVersion}`,
        `Latest version:  v${latestVersion}`,
        installMethod.type !== "unknown" ? `Install method:  ${installMethod.type}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    // Handle unknown install method
    if (installMethod.type === "unknown") {
      p.log.warn("Could not detect installation method.");
      p.log.message(
        [
          "Please update manually using one of:",
          "  npm install -g @baton-dx/cli@latest",
          "  pnpm update -g @baton-dx/cli --latest",
          "  bun update -g @baton-dx/cli --latest",
          "  brew upgrade baton-dx",
        ].join("\n"),
      );
      p.outro("Manual update required.");
      return;
    }

    // Dry-run: stop here
    if (args["dry-run"]) {
      p.log.info(`Would run: ${displayCommand}`);
      p.outro("Dry run complete.");
      return;
    }

    // Changelog (optional)
    if (args.changelog) {
      const changelogUrl = `https://github.com/baton-dx/baton/releases/tag/v${latestVersion}`;
      p.log.info(`Release notes: ${changelogUrl}`);
    }

    // Confirmation prompt
    if (!args.yes) {
      const confirmed = await p.confirm({
        message: `Update to v${latestVersion}?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.outro("Update cancelled.");
        return;
      }
    }

    // Execute update
    const updateSpinner = p.spinner();
    updateSpinner.start(`Running: ${displayCommand}`);

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(installMethod.bin, installMethod.args, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      updateSpinner.stop(`Successfully updated to v${latestVersion}`);
      p.outro("Update complete!");
    } catch (error) {
      updateSpinner.stop("Update failed");
      const message = error instanceof Error ? error.message : "Unknown error";
      p.log.error(`Failed to run: ${displayCommand}`);
      p.log.error(message);
      p.outro("Update failed. Please try updating manually.");
      process.exit(1);
    }
  },
});
