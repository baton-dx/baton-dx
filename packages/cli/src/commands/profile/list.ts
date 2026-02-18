import { discoverProfilesInSourceRepo } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { isInSourceRepo } from "../../utils/context-detection.js";

export const profileListCommand = defineCommand({
  meta: {
    name: "profile list",
    description: `List all profiles in the current source repository

Shows a table of all profiles with:
  - Profile name (root profile marked with "(root)")
  - Version from baton.profile.yaml
  - Description from profile manifest

Examples:
  baton profile list

Note: Must be run from a source repository (directory with baton.source.yaml)`,
  },
  run: async () => {
    p.intro("List Profiles");

    // Check if we're in a source repo
    const inSourceRepo = await isInSourceRepo();
    if (!inSourceRepo) {
      p.outro(
        "Error: Not in a source repository. Run this command from a directory containing baton.source.yaml",
      );
      process.exit(1);
    }

    const cwd = process.cwd();

    // Discover all profiles in the profiles/ directory
    const profiles = await discoverProfilesInSourceRepo(cwd);

    if (profiles.length === 0) {
      p.outro("No profiles found.");
      process.exit(0);
    }

    // Build table output
    const lines: string[] = [];
    lines.push("┌─────────────────────┬─────────┬────────────────────────────────────┐");
    lines.push("│ Name                │ Version │ Description                        │");
    lines.push("├─────────────────────┼─────────┼────────────────────────────────────┤");

    for (const profile of profiles) {
      const name = profile.name;
      const version = profile.version || "-";
      const description = profile.description || "-";

      // Pad columns to fixed width
      const namePadded = name.padEnd(19);
      const versionPadded = version.padEnd(7);
      const descPadded = description.padEnd(34);

      lines.push(`│ ${namePadded} │ ${versionPadded} │ ${descPadded} │`);
    }

    lines.push("└─────────────────────┴─────────┴────────────────────────────────────┘");

    p.note(lines.join("\n"), "Profiles");
    p.outro(`Found ${profiles.length} profile${profiles.length === 1 ? "" : "s"}`);
    process.exit(0);
  },
});
