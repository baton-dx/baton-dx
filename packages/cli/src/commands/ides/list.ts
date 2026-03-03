import {
    getGlobalIdePlatforms,
    getRegisteredIdePlatforms,
    idePlatformRegistry,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { formatIdeName } from "./utils.js";

export const idesListCommand = defineCommand({
    meta: {
        name: "list",
        description: "Show saved IDE platforms from global config",
    },
    args: {
        all: {
            type: "boolean",
            alias: "a",
            description: "Show all supported platforms, not just saved ones",
        },
        json: {
            type: "boolean",
            description: "Output machine-readable JSON",
            alias: "j",
        },
    },
    async run({ args }) {
        if (!args.json) {
            p.intro("Baton - IDE Platforms");
        }

        // Load saved platforms from global config
        const savedPlatforms = await getGlobalIdePlatforms();
        const allIdeKeys = getRegisteredIdePlatforms();

        // Determine which platforms to show
        const keysToShow = args.all
            ? allIdeKeys
            : savedPlatforms.length > 0
              ? savedPlatforms
              : allIdeKeys;

        const platformStatuses = keysToShow.map((ideKey) => {
            const isSaved = savedPlatforms.includes(ideKey);
            const entry = idePlatformRegistry[ideKey];

            return {
                key: ideKey,
                name: formatIdeName(ideKey),
                saved: isSaved,
                targetDir: entry?.targetDir ?? "unknown",
            };
        });

        // JSON output
        if (args.json) {
            console.log(JSON.stringify(platformStatuses, null, 2));
            return;
        }

        // Formatted output
        if (savedPlatforms.length === 0) {
            p.log.warn("No IDE platforms saved in global config.");
            p.log.info("Run 'baton ides scan' to detect and save your IDE platforms.");
            console.log("");
            p.log.info(`All ${allIdeKeys.length} supported platforms:`);
            for (const key of allIdeKeys) {
                const entry = idePlatformRegistry[key];
                console.log(
                    `  \x1b[90m- ${formatIdeName(key)} (${entry?.targetDir ?? key})\x1b[0m`,
                );
            }
            p.outro("Run 'baton ides scan' to get started.");
            return;
        }

        console.log(`\nSaved IDE platforms (${savedPlatforms.length}):\n`);

        for (const platform of platformStatuses) {
            const statusColor = platform.saved ? "\x1b[32m" : "\x1b[90m";
            const status = platform.saved ? "✓" : "✗";
            const resetColor = "\x1b[0m";

            console.log(
                `${statusColor}${status}${resetColor} ${platform.name.padEnd(20)} → ${platform.targetDir}`,
            );
        }

        console.log("");
        p.outro("Manage platforms: 'baton ides scan' (detect)");
    },
});
