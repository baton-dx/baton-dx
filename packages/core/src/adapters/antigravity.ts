import type { ConfigType } from "@baton-dx/ai-tool-paths";
import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities, ValidationResult } from "./types.js";

/**
 * Antigravity adapter — Gemini-based AI tool.
 *
 * Uses GEMINI.md for memory. Custom validate() adds memory filename check.
 * Paths: .agent/skills/, .agent/rules/, .agent/agents/, .agent/workflows/
 */
export class AntigravityAdapter extends BaseAIToolAdapter {
    readonly key = "antigravity";
    readonly name = "Antigravity";
    protected override memoryFilename = "GEMINI.md";

    override readonly mcpCapabilities: McpCapabilities = {
        supported: true,
        configKey: "mcpServers",
        envVarSyntax: "expand",
        format: "json",
        sharedSettingsFile: true,
        supportedScopes: ["global"],
    };

    override validate(type: ConfigType, file: unknown): ValidationResult {
        const result = this.validateCommon(type, file);

        if (type === "memory") {
            const memory = file as { filename?: string };
            if (memory.filename && memory.filename !== "GEMINI.md") {
                result.errors.push("Memory file must be named GEMINI.md for Antigravity");
                result.valid = false;
            }
        }

        return result;
    }
}
