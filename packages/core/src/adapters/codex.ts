import type { ConfigType } from "@baton-dx/ai-tool-paths";
import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities, ValidationResult } from "./types.js";

/**
 * Codex CLI adapter.
 *
 * Uses AGENTS.md for memory. Custom validate() adds memory filename check.
 * Settings use TOML format (config.toml), not JSON.
 */
export class CodexAdapter extends BaseAIToolAdapter {
    readonly key = "codex";
    readonly name = "Codex CLI";

    override readonly mcpCapabilities: McpCapabilities = {
        supported: true,
        configKey: "mcp_servers",
        envVarSyntax: "expand",
        format: "toml",
        sharedSettingsFile: true,
        supportedScopes: ["global"],
    };

    override validate(type: ConfigType, file: unknown): ValidationResult {
        const result = this.validateCommon(type, file);

        if (type === "memory") {
            const memory = file as { filename?: string };
            if (memory.filename && memory.filename !== "AGENTS.md") {
                result.errors.push("Memory file must be named AGENTS.md for Codex");
                result.valid = false;
            }
        }

        return result;
    }
}
