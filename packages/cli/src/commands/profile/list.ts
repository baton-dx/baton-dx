import { discoverProfilesInSourceRepo } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { isInSourceRepo } from "../../utils/context-detection.js";
import { getOutputContext, outputJson, outputJsonError, renderTable } from "../../utils/output.js";
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
    run: async ({ args }) => {
        const { json } = getOutputContext(args);

        // Check if we're in a source repo
        const inSourceRepo = await isInSourceRepo();
        if (!inSourceRepo) {
            if (json) {
                outputJsonError(
                    "NOT_SOURCE_REPO",
                    "Not in a source repository. Run this command from a directory containing baton.source.yaml",
                );
            }
            p.intro("List Profiles");
            p.outro(
                "Error: Not in a source repository. Run this command from a directory containing baton.source.yaml",
            );
            process.exit(1);
        }

        const cwd = process.cwd();
        const profiles = await discoverProfilesInSourceRepo(cwd);

        if (json) {
            outputJson({
                profiles: profiles.map((profile) => ({
                    name: profile.name,
                    version: profile.version || null,
                    weight: profile.weight ?? 0,
                    extends: profile.extends ?? null,
                    description: profile.description || null,
                })),
            });
            return;
        }

        p.intro("List Profiles");

        if (profiles.length === 0) {
            p.outro("No profiles found.");
            process.exit(0);
        }

        // --- Section 1: Hierarchy Tree ---
        const roots = buildProfileTree(profiles);
        const treeOutput = renderProfileTree(roots);
        p.note(treeOutput, "Profile Hierarchy");

        // --- Section 2: Table with weight and extends ---
        const columns = [
            { header: "Name", width: 19 },
            { header: "Version", width: 7 },
            { header: "Weight", width: 6 },
            { header: "Extends", width: 16 },
            { header: "Description", width: 26 },
        ];

        const rows = profiles.map((profile) => [
            profile.name,
            profile.version || "-",
            String(profile.weight ?? 0),
            profile.extends ?? "—",
            profile.description || "-",
        ]);

        p.note(renderTable(columns, rows), "Profiles");
        p.outro(`Found ${profiles.length} profile${profiles.length === 1 ? "" : "s"}`);
        process.exit(0);
    },
});
