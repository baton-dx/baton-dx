import {
    clearIdeCache,
    detectInstalledIdes,
    getGlobalIdePlatforms,
    getRegisteredIdePlatforms,
    setGlobalIdePlatforms,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { formatIdeName } from "./utils.js";

export const idesScanCommand = defineCommand({
    meta: {
        name: "scan",
        description: "Scan your system for IDE platforms and save results to global config",
    },
    args: {
        yes: {
            type: "boolean",
            alias: "y",
            description: "Automatically save detected platforms without confirmation",
        },
    },
    async run({ args }) {
        p.intro("Baton - IDE Platform Scanner");

        const spinner = p.spinner();
        spinner.start("Scanning for IDE platforms...");

        // Clear cache to force fresh detection
        clearIdeCache();

        const detectedIdes = await detectInstalledIdes();
        const allIdeKeys = getRegisteredIdePlatforms();
        const currentPlatforms = await getGlobalIdePlatforms();

        spinner.stop("Scan complete.");

        if (detectedIdes.length > 0) {
            p.log.success(
                `Found ${detectedIdes.length} IDE platform${detectedIdes.length !== 1 ? "s" : ""} on your system.`,
            );
        } else {
            p.log.warn("No IDE platforms detected on your system.");
        }

        // --yes flag: save only detected platforms (preserves current behavior)
        if (args.yes) {
            const hasChanges =
                detectedIdes.length !== currentPlatforms.length ||
                detectedIdes.some((key) => !currentPlatforms.includes(key));

            if (hasChanges) {
                await setGlobalIdePlatforms(detectedIdes);
                p.log.success(
                    `Saved ${detectedIdes.length} detected platform(s) to global config.`,
                );
            } else {
                p.log.info("Global config is already up to date.");
            }

            p.outro("Scan finished.");
            return;
        }

        // Interactive: show multiselect with all 6 IDE platforms
        const options = allIdeKeys.map((ideKey) => {
            const isDetected = detectedIdes.includes(ideKey);
            return {
                value: ideKey,
                label: isDetected ? `${formatIdeName(ideKey)} (detected)` : formatIdeName(ideKey),
            };
        });

        const selected = await p.multiselect({
            message: "Select which IDE platforms to save:",
            options,
            initialValues: detectedIdes,
        });

        if (p.isCancel(selected)) {
            p.outro("Scan finished (not saved).");
            return;
        }

        const selectedKeys = selected as string[];

        const hasChanges =
            selectedKeys.length !== currentPlatforms.length ||
            selectedKeys.some((key) => !currentPlatforms.includes(key));

        if (hasChanges) {
            await setGlobalIdePlatforms(selectedKeys);
            p.log.success(`Saved ${selectedKeys.length} platform(s) to global config.`);
        } else {
            p.log.info("Global config is already up to date.");
        }

        p.outro("Scan finished.");
    },
});
