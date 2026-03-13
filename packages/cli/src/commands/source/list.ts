import { getGlobalSources } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getOutputContext, outputJson, renderTable } from "../../utils/output.js";

/**
 * Command: baton source list
 *
 * Lists all registered global sources from ~/.baton/config.yaml.
 */
export const listCommand = defineCommand({
    meta: {
        name: "list",
        description: "List all global sources",
    },
    async run({ args }) {
        const { json } = getOutputContext(args);
        const sources = await getGlobalSources();

        if (json) {
            outputJson({ sources });
            return;
        }

        if (sources.length === 0) {
            p.log.info("No global sources configured.");
            p.note("Add a source with:\n  baton source connect <url>", "Tip");
            return;
        }

        const columns = [
            { header: "Name", width: 16 },
            { header: "URL", width: 35 },
            { header: "Default", width: 7 },
        ];

        const rows = sources.map((source) => [source.name, source.url, source.default ? "✓" : ""]);

        p.note(renderTable(columns, rows), "Global Sources");
    },
});
