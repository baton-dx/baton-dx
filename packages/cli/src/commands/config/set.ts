import { loadGlobalConfig, saveGlobalConfig } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

/**
 * Set a value in the global Baton config (~/.baton/config.yaml).
 *
 * Supports dotted paths like "sync.cacheTtlHours" to set nested values.
 * Usage: baton config set <key> <value>
 */
export const configSetCommand = defineCommand({
    meta: {
        name: "set",
        description: "Set a global config value (e.g., baton config set sync.cacheTtlHours 1)",
    },
    args: {
        key: {
            type: "positional",
            description: "Config key using dot notation (e.g., sync.cacheTtlHours)",
            required: true,
        },
        value: {
            type: "positional",
            description: "Value to set",
            required: true,
        },
    },
    async run({ args }) {
        const { key, value } = args;
        const segments = key.split(".");

        if (segments.length === 0 || segments.some((s: string) => s === "")) {
            p.cancel(`Invalid config key: "${key}"`);
            process.exit(1);
        }

        // Load current config
        const config = await loadGlobalConfig();

        // Parse the value into the appropriate type
        const parsed = parseValue(value);

        // Set the value at the dotted path
        setNestedValue(config, segments, parsed);

        // Save the updated config (Zod validates on save)
        try {
            await saveGlobalConfig(config);
        } catch (error) {
            p.cancel(
                `Invalid config value: ${error instanceof Error ? error.message : String(error)}`,
            );
            process.exit(1);
        }

        p.log.success(`Set ${key} = ${JSON.stringify(parsed)}`);
    },
});

/** Parse a string value into a number, boolean, or string. */
function parseValue(raw: string): unknown {
    if (raw === "true") return true;
    if (raw === "false") return false;
    const num = Number(raw);
    if (!Number.isNaN(num) && raw.trim() !== "") return num;
    return raw;
}

/** Set a value at a dotted path on an object, creating intermediate objects as needed. */
function setNestedValue(obj: Record<string, unknown>, segments: string[], value: unknown): void {
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (current[seg] === undefined || current[seg] === null) {
            current[seg] = {};
        }
        current = current[seg] as Record<string, unknown>;
    }
    current[segments[segments.length - 1]] = value;
}
