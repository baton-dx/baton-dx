import type { McpEnvVarSyntax } from "../adapters/types.js";

/**
 * Transform MCP server env-var references from canonical ${VAR} syntax
 * to the target tool's expected syntax.
 *
 * Canonical format (baton.profile.yaml): ${VAR} or ${VAR:-default}
 *
 * Tool-specific outputs:
 * - dollar-brace:     ${VAR}        (Claude Code, Cursor, Kiro, Amp, GitHub Copilot) — pass-through
 * - dollar-env-colon: ${env:VAR}    (Windsurf, Roo)
 * - env-colon:        {env:VAR}     (OpenCode)
 * - expand:           resolves from process.env, falls back to original string on miss
 *
 * @param env - Canonical env record with ${VAR} values
 * @param syntax - Target tool's env-var syntax
 * @param processEnv - Environment to use for "expand" mode (defaults to process.env)
 * @returns Transformed env record with warnings for unresolvable vars in expand mode
 */
export function transformEnvVars(
  env: Record<string, string>,
  syntax: McpEnvVarSyntax,
  processEnv: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): { env: Record<string, string>; warnings: string[] } {
  const result: Record<string, string> = {};
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(env)) {
    result[key] = transformSingleEnvVar(value, syntax, processEnv, warnings);
  }

  return { env: result, warnings };
}

function transformSingleEnvVar(
  value: string,
  syntax: McpEnvVarSyntax,
  processEnv: Record<string, string | undefined>,
  warnings: string[],
): string {
  switch (syntax) {
    case "dollar-brace":
      // Pass-through — ${VAR} and ${VAR:-default} are already in correct format
      return value;

    case "dollar-env-colon":
      // ${VAR} → ${env:VAR}, ${VAR:-default} → ${env:VAR:-default}
      return value.replace(/^\$\{([A-Z_][A-Z0-9_]*)(:-[^}]*)?\}$/, (_, varName, defaultPart) => {
        return `\${env:${varName}${defaultPart ?? ""}}`;
      });

    case "env-colon":
      // ${VAR} → {env:VAR}, ${VAR:-default} → {env:VAR:-default}
      return value.replace(/^\$\{([A-Z_][A-Z0-9_]*)(:-[^}]*)?\}$/, (_, varName, defaultPart) => {
        return `{env:${varName}${defaultPart ?? ""}}`;
      });

    case "expand": {
      // Resolve from process.env; use default if present; warn if undefined
      const match = value.match(/^\$\{([A-Z_][A-Z0-9_]*)(:-([^}]*))?\}$/);
      if (!match) {
        // Malformed — return as-is (schema validation should have caught this)
        return value;
      }
      const varName = match[1];
      const defaultValue = match[3]; // undefined if no :-default part
      const resolved = processEnv[varName];

      if (resolved !== undefined) {
        return resolved;
      }
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      warnings.push(
        `MCP env var \${${varName}} is not set in the environment and has no default. Leaving as-is.`,
      );
      return value;
    }
  }
}
