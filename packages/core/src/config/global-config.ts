import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { ManifestValidationError } from "../errors.js";
import {
    type GlobalConfig,
    type GlobalSourceEntry,
    globalConfigSchema,
} from "../schemas/global-config.js";

/**
 * Returns the Baton home directory path.
 *
 * Respects the `BATON_HOME` environment variable for testing and custom locations.
 * Falls back to `~/.baton` when not set.
 *
 * @returns Absolute path to the Baton home directory
 */
export function getBatonHome(): string {
    return process.env.BATON_HOME ?? join(homedir(), ".baton");
}

/**
 * Returns the path to the global Baton configuration file.
 *
 * @returns Absolute path to ~/.baton/config.yaml (or $BATON_HOME/config.yaml)
 */
export function getGlobalConfigPath(): string {
    return join(getBatonHome(), "config.yaml");
}

/**
 * Loads the global Baton configuration from ~/.baton/config.yaml
 *
 * If the file doesn't exist, returns a default configuration with empty sources.
 * This is not an error - it's the expected state for new users.
 *
 * @throws {ManifestValidationError} If the config file exists but contains invalid data
 * @returns The parsed and validated global configuration
 */
export async function loadGlobalConfig(): Promise<GlobalConfig> {
    const configPath = getGlobalConfigPath();

    try {
        const content = await readFile(configPath, "utf-8");
        const parsed = parse(content);

        // Validate against schema
        return globalConfigSchema.parse(parsed);
    } catch (error) {
        // File doesn't exist - return default config
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return globalConfigSchema.parse({});
        }

        // Validation error
        throw new ManifestValidationError(
            `Invalid global config at ${configPath}: ${(error as Error).message}`,
            { cause: error as Error },
        );
    }
}

/**
 * Saves the global configuration to ~/.baton/config.yaml
 *
 * Creates the ~/.baton directory if it doesn't exist.
 *
 * @param config - The configuration to save (will be validated)
 * @throws {ManifestValidationError} If config validation fails
 * @throws {Error} If file write fails
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
    // Validate before saving
    const validated = globalConfigSchema.parse(config);

    const configPath = getGlobalConfigPath();
    const configDir = getBatonHome();

    // Ensure directory exists
    await mkdir(configDir, { recursive: true });

    // Write as YAML
    const yamlContent = stringify(validated);
    await writeFile(configPath, yamlContent, "utf-8");
}

/**
 * Adds a source repository to the global configuration.
 *
 * @param url - Source URL (e.g., "github:org/repo", "../local/path")
 * @param options - Optional configuration
 * @param options.name - Custom name (defaults to inferred from URL)
 * @param options.description - Optional description
 * @param options.setAsDefault - Whether to set as default source
 *
 * @throws {Error} If a source with the same URL already exists
 */
export async function addGlobalSource(
    url: string,
    options?: {
        name?: string;
        description?: string;
        setAsDefault?: boolean;
    },
): Promise<void> {
    const config = await loadGlobalConfig();

    // Check for duplicate URL
    const existing = config.sources?.find((s) => s.url === url);
    if (existing) {
        throw new Error(`Source with URL "${url}" is already registered as "${existing.name}"`);
    }

    // Generate name if not provided
    const name = options?.name ?? inferNameFromUrl(url);

    // Check for duplicate name
    const existingByName = config.sources?.find((s) => s.name === name);
    if (existingByName) {
        throw new Error(`Source with name "${name}" already exists (URL: "${existingByName.url}")`);
    }

    // If setting as default, clear other defaults
    if (options?.setAsDefault && config.sources) {
        for (const source of config.sources) {
            source.default = false;
        }
    }

    // Create new entry
    const newSource: GlobalSourceEntry = {
        name,
        url,
        default: options?.setAsDefault ?? false,
        description: options?.description,
    };

    // Add to sources
    config.sources = [...(config.sources ?? []), newSource];

    await saveGlobalConfig(config);
}

/**
 * Removes a source from the global configuration by name or URL.
 *
 * @param nameOrUrl - Source name or URL to remove
 * @throws {Error} If no matching source is found
 */
export async function removeGlobalSource(nameOrUrl: string): Promise<void> {
    const config = await loadGlobalConfig();

    const index = config.sources?.findIndex((s) => s.name === nameOrUrl || s.url === nameOrUrl);

    if (index === undefined || index === -1) {
        throw new Error(`Source "${nameOrUrl}" not found in global configuration`);
    }

    config.sources?.splice(index, 1);

    await saveGlobalConfig(config);
}

/**
 * Gets all registered global sources.
 *
 * @returns Array of global source entries (empty if none registered)
 */
export async function getGlobalSources(): Promise<GlobalSourceEntry[]> {
    const config = await loadGlobalConfig();
    return config.sources ?? [];
}

/**
 * Gets the default global source, if one is set.
 *
 * @returns The default source entry, or null if no default is set
 */
export async function getDefaultGlobalSource(): Promise<GlobalSourceEntry | null> {
    const sources = await getGlobalSources();
    return sources.find((s) => s.default) ?? null;
}

/**
 * Gets the list of persisted AI tools from global configuration.
 *
 * @returns Array of tool keys (empty if none configured)
 */
export async function getGlobalAiTools(): Promise<string[]> {
    const config = await loadGlobalConfig();
    return config.ai?.tools ?? [];
}

/**
 * Saves the list of AI tools to global configuration.
 *
 * @param tools - Array of tool keys to persist
 */
export async function setGlobalAiTools(tools: string[]): Promise<void> {
    const config = await loadGlobalConfig();
    config.ai = { ...config.ai, tools };
    await saveGlobalConfig(config);
}

/**
 * Gets the list of persisted IDE platforms from global configuration.
 *
 * @returns Array of platform keys (empty if none configured)
 */
export async function getGlobalIdePlatforms(): Promise<string[]> {
    const config = await loadGlobalConfig();
    return config.ide?.platforms ?? [];
}

/**
 * Saves the list of IDE platforms to global configuration.
 *
 * @param platforms - Array of platform keys to persist
 */
export async function setGlobalIdePlatforms(platforms: string[]): Promise<void> {
    const config = await loadGlobalConfig();
    config.ide = { ...config.ide, platforms };
    await saveGlobalConfig(config);
}

/**
 * Infers a friendly name from a source URL.
 *
 * Examples:
 * - "github:acme-corp/dx-configs" → "acme-corp"
 * - "github:daniel/my-profiles" → "daniel"
 * - "../local/path" → "path"
 *
 * @param url - Source URL
 * @returns Inferred name (fallback: sanitized URL)
 */
function inferNameFromUrl(url: string): string {
    // Try to extract org from github:/gitlab: URLs
    const githubMatch = url.match(/^(?:github|gitlab):([^/]+)\//);
    if (githubMatch) {
        return githubMatch[1];
    }

    // For file paths, use last segment
    const segments = url.split("/");
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
        return lastSegment.replace(/[^a-zA-Z0-9-_]/g, "-");
    }

    // Fallback: sanitize full URL
    return url.replace(/[^a-zA-Z0-9-_]/g, "-");
}
