import { getGlobalSources } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

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
  async run() {
    const sources = await getGlobalSources();

    if (sources.length === 0) {
      p.log.info("No global sources configured.");
      p.note("Add a source with:\n  baton source connect <url>", "Tip");
      return;
    }

    console.log("\n🌐 Global Sources\n");
    console.log("┌──────────────────┬─────────────────────────────────────┬─────────┐");
    console.log("│ Name             │ URL                                 │ Default │");
    console.log("├──────────────────┼─────────────────────────────────────┼─────────┤");

    for (const source of sources) {
      const name = source.name.padEnd(16);
      const url = truncate(source.url, 35).padEnd(35);
      const def = source.default ? "✓" : "";

      console.log(`│ ${name} │ ${url} │ ${def.padEnd(7)} │`);

      if (source.description) {
        const desc = `  ${truncate(source.description, 33)}`.padEnd(35);
        console.log(`│                  │ ${desc} │         │`);
      }
    }

    console.log("└──────────────────┴─────────────────────────────────────┴─────────┘\n");
  },
});

/**
 * Truncates a string to the specified length, adding "..." if truncated.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 3)}...`;
}
