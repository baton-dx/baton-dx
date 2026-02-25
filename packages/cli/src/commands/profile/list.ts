import { discoverProfilesInSourceRepo } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { isInSourceRepo } from "../../utils/context-detection.js";
import { buildProfileTree, renderProfileTree } from "../../utils/profile-tree.js";

export const profileListCommand = defineCommand({
  meta: {
    name: "profile list",
    description: `List all profiles in the current source repository

Shows a hierarchy tree and table of all profiles with:
  - Profile name
  - Version from baton.profile.yaml
  - Weight (merge priority)
  - Extends (parent profiles)
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

    // --- Section 1: Hierarchy Tree ---
    const roots = buildProfileTree(profiles);
    const treeOutput = renderProfileTree(roots);
    p.note(treeOutput, "Profile Hierarchy");

    // --- Section 2: Table with weight and extends ---
    const lines: string[] = [];
    lines.push(
      "┌─────────────────────┬─────────┬────────┬──────────────────┬────────────────────────────┐",
    );
    lines.push(
      "│ Name                │ Version │ Weight │ Extends          │ Description                │",
    );
    lines.push(
      "├─────────────────────┼─────────┼────────┼──────────────────┼────────────────────────────┤",
    );

    for (const profile of profiles) {
      const name = profile.name.slice(0, 19).padEnd(19);
      const version = (profile.version || "-").slice(0, 7).padEnd(7);
      const weight = String(profile.weight ?? 0).padEnd(6);
      const extendsStr = (profile.extends ?? "—").slice(0, 16).padEnd(16);
      const description = (profile.description || "-").slice(0, 26).padEnd(26);

      lines.push(`│ ${name} │ ${version} │ ${weight} │ ${extendsStr} │ ${description} │`);
    }

    lines.push(
      "└─────────────────────┴─────────┴────────┴──────────────────┴────────────────────────────┘",
    );

    p.note(lines.join("\n"), "Profiles");
    p.outro(`Found ${profiles.length} profile${profiles.length === 1 ? "" : "s"}`);
    process.exit(0);
  },
});
