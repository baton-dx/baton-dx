import {
    getGlobalIdePlatforms,
    getRegisteredIdePlatforms,
    idePlatformRegistry,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getOutputContext, outputJson, pc } from "../../utils/output.js";
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
    },
    async run({ args }) {
        const { json } = getOutputContext(args);

        if (!json) {
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
        if (json) {
            outputJson({ platforms: platformStatuses });
            return;
        }

        // Formatted output
        if (savedPlatforms.length === 0) {
            p.log.warn("No IDE platforms saved in global config.");
            p.log.info("Run 'baton ides scan' to detect and save your IDE platforms.");
            p.log.info(`All ${allIdeKeys.length} supported platforms:`);
            for (const key of allIdeKeys) {
                const entry = idePlatformRegistry[key];
                p.log.info(`  ${pc.dim(`- ${formatIdeName(key)} (${entry?.targetDir ?? key})`)}`);
            }
            p.outro("Run 'baton ides scan' to get started.");
            return;
        }

        p.log.step(`Saved IDE platforms (${savedPlatforms.length}):`);

        for (const platform of platformStatuses) {
            const status = platform.saved
                ? `${pc.green("✓")} ${platform.name.padEnd(20)} → ${platform.targetDir}`
                : `${pc.dim("✗")} ${platform.name.padEnd(20)} → ${platform.targetDir}`;

            p.log.info(status);
        }

        p.outro("Manage platforms: 'baton ides scan' (detect)");
    },
});
