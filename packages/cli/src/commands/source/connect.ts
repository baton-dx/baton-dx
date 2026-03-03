import { addGlobalSource, KEBAB_CASE_REGEX, parseSource, SourceParseError } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { selectMultipleProfilesFromSource } from "../../utils/profile-selection.js";

/**
 * Command: baton source connect
 *
 * Connects a source repository to the global configuration (~/.baton/config.yaml).
 * Once connected, sources can be auto-selected in `baton init`.
 */
export const connectCommand = defineCommand({
    meta: {
        name: "connect",
        description: "Connect a source repository to your global config",
    },
    args: {
        url: {
            type: "positional",
            description: "Source URL (github:org/repo, ../path)",
            required: true,
        },
        name: {
            type: "string",
            description: "Custom name for the source (kebab-case)",
        },
        description: {
            type: "string",
            description: "Source description",
        },
    },
    async run({ args }) {
        const url = args.url as string;
        const customName = args.name as string | undefined;

        if (customName && !KEBAB_CASE_REGEX.test(customName)) {
            p.cancel("Source name must be kebab-case (e.g., my-source)");
            process.exit(1);
        }

        try {
            parseSource(url);
        } catch (error) {
            const message =
                error instanceof SourceParseError
                    ? error.message
                    : `Invalid source: ${(error as Error).message}`;
            p.cancel(message);
            process.exit(1);
        }

        try {
            await addGlobalSource(url, {
                name: args.name as string | undefined,
                description: args.description as string | undefined,
            });

            const displayName = args.name || url;
            p.log.success(`Connected source: ${displayName}`);

            const shouldSync = await p.confirm({
                message: "Would you like to sync profiles from this source now?",
                initialValue: false,
            });

            if (p.isCancel(shouldSync) || !shouldSync) {
                p.outro("Source connected. Run 'baton init' to set up profiles.");
                return;
            }

            p.outro("Starting profile sync...");

            const profiles = await selectMultipleProfilesFromSource(url);
            if (profiles.length > 0) {
                p.log.success(`Selected ${profiles.length} profile(s) for sync.`);
                p.note(
                    "Run 'baton init' in your project directory to install these profiles.",
                    "Next step",
                );
            }
        } catch (error) {
            p.cancel(`Failed to connect source: ${(error as Error).message}`);
            process.exit(1);
        }
    },
});
