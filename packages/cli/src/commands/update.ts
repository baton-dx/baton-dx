import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { syncCommand } from "./sync.js";

export const updateCommand = defineCommand({
    meta: {
        name: "update",
        description: "(deprecated) Use 'baton sync' instead",
    },
    args: {
        "dry-run": {
            type: "boolean",
            description: "Show what would be done without writing files",
            default: false,
        },
        category: {
            type: "string",
            description: "Sync only a specific category: ai, files, or ide",
            required: false,
        },
        yes: {
            type: "boolean",
            description: "Run non-interactively (no prompts)",
            default: false,
        },
        verbose: {
            type: "boolean",
            alias: "v",
            description: "Show detailed output for each placed file",
            default: false,
        },
        check: {
            type: "boolean",
            description:
                "Check if configs are in sync without modifying files (exit 0 = in sync, 1 = stale)",
            default: false,
        },
    },
    async run(context) {
        p.log.warn("`baton update` is deprecated. Use `baton sync` instead.");
        p.log.info("");
        // Delegate to sync — pass full context through
        if (syncCommand.run) {
            await syncCommand.run(context);
        }
    },
});
