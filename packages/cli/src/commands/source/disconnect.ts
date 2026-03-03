import { type GlobalSourceEntry, getGlobalSources, removeGlobalSource } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

/**
 * Command: baton source disconnect
 *
 * Disconnects a source repository from the global configuration.
 * Shows a warning about profiles that depend on this source before removing.
 */
export const disconnectCommand = defineCommand({
    meta: {
        name: "disconnect",
        description: "Disconnect a source repository from your global config",
    },
    args: {
        source: {
            type: "positional",
            description: "Source name or URL to disconnect",
            required: true,
        },
    },
    async run({ args }) {
        const sourceIdentifier = args.source as string;

        // Find the matching source in global config
        const sources = await getGlobalSources();
        const matchedSource = sources.find(
            (s: GlobalSourceEntry) => s.name === sourceIdentifier || s.url === sourceIdentifier,
        );

        if (!matchedSource) {
            p.cancel(`Source "${sourceIdentifier}" not found in global configuration.`);
            process.exit(1);
        }

        // Warn about dependent projects/profiles
        p.log.warn(
            `Disconnecting source "${matchedSource.name}" (${matchedSource.url}) will affect any projects using profiles from this source.`,
        );
        p.log.info(
            "Projects that reference this source will no longer be able to sync or update their profiles.",
        );

        // Confirm before removing
        const confirmed = await p.confirm({
            message: `Are you sure you want to disconnect source "${matchedSource.name}"?`,
            initialValue: false,
        });

        if (p.isCancel(confirmed) || !confirmed) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }

        try {
            await removeGlobalSource(sourceIdentifier);
            p.outro(`Disconnected source: ${matchedSource.name}`);
        } catch (error) {
            p.cancel(`Failed to disconnect source: ${(error as Error).message}`);
            process.exit(1);
        }
    },
});
