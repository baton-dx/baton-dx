import { execFile } from "node:child_process";
import { access, constants, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
    AppBundleCheck,
    BinaryCheck,
    DetectionCheck,
    DetectionConfig,
    DirectoryCheck,
    JetbrainsPluginCheck,
    Platform,
    VscodeExtensionCheck,
} from "@baton-dx/ai-tool-paths";

/**
 * Execute a command and return stdout/stderr as a promise.
 * Rejects on non-zero exit code or timeout.
 */
function execAsync(
    command: string,
    args: string[],
    options: { timeout?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile(command, args, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout: String(stdout), stderr: String(stderr) });
            }
        });
    });
}

/**
 * Check if a binary exists in PATH and optionally verify its identity via version output.
 * Prevents false positives from binary name collisions (e.g., `opencode` by Litestar vs SST).
 */
export async function checkBinary(check: BinaryCheck): Promise<boolean> {
    if (check.platforms && !check.platforms.includes(process.platform as Platform)) {
        return false;
    }

    const lookupCommand = process.platform === "win32" ? "where" : "which";

    try {
        await execAsync(lookupCommand, [check.name]);
    } catch {
        return false;
    }

    if (!check.versionPattern) {
        return true;
    }

    const versionFlag = check.versionFlag ?? "--version";
    try {
        const { stdout, stderr } = await execAsync(check.name, [versionFlag], {
            timeout: 5000,
        });
        const output = `${stdout}\n${stderr}`;
        return check.versionPattern.test(output);
    } catch {
        return false;
    }
}

/**
 * Check if a directory exists and optionally contains a marker file.
 * Prevents false positives from leftover empty directories (e.g., ~/.cline/ without settings.json).
 */
export async function checkDirectory(check: DirectoryCheck): Promise<boolean> {
    if (check.platforms && !check.platforms.includes(process.platform as Platform)) {
        return false;
    }

    const expandedPath = check.path.startsWith("~/")
        ? join(homedir(), check.path.slice(2))
        : check.path;

    try {
        await access(expandedPath, constants.R_OK);
    } catch {
        return false;
    }

    if (!check.markerFile) {
        return true;
    }

    try {
        await access(join(expandedPath, check.markerFile));
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if a macOS .app bundle exists in /Applications or ~/Applications.
 * Returns false immediately on non-darwin platforms.
 */
export async function checkAppBundle(check: AppBundleCheck): Promise<boolean> {
    if (process.platform !== "darwin") {
        return false;
    }

    const searchPaths = check.searchPaths ?? ["/Applications", join(homedir(), "Applications")];

    for (const dir of searchPaths) {
        try {
            await access(join(dir, check.name));
            return true;
        } catch {
            // not found in this path, try next
        }
    }

    return false;
}

/** Map of editor names to their extension directory paths. */
const EDITOR_EXTENSION_DIRS: Record<string, string> = {
    vscode: join(homedir(), ".vscode", "extensions"),
    cursor: join(homedir(), ".cursor", "extensions"),
    windsurf: join(homedir(), ".windsurf", "extensions"),
};

/**
 * Check if a VS Code extension is installed in VS Code, Cursor, or Windsurf.
 * Matches extension directories by prefix (case-insensitive) since directories
 * are named `<extensionId>-<version>`.
 */
export async function checkVscodeExtension(check: VscodeExtensionCheck): Promise<boolean> {
    const editors = check.editors ?? ["vscode"];
    const prefix = check.extensionId.toLowerCase();

    for (const editor of editors) {
        const extDir = EDITOR_EXTENSION_DIRS[editor];
        if (!extDir) {
            // skip unknown editor
        } else {
            try {
                const entries = await readdir(extDir);
                if (entries.some((entry) => entry.toLowerCase().startsWith(prefix))) {
                    return true;
                }
            } catch {
                // extension directory missing (ENOENT) — skip, not throw
            }
        }
    }

    return false;
}

/**
 * Get the JetBrains config base directory for the current platform.
 * macOS: ~/Library/Application Support/JetBrains/
 * Linux: ~/.config/JetBrains/
 * Windows: %APPDATA%/JetBrains/
 */
function getJetbrainsConfigBase(): string | undefined {
    switch (process.platform) {
        case "darwin":
            return join(homedir(), "Library", "Application Support", "JetBrains");
        case "linux":
            return join(homedir(), ".config", "JetBrains");
        case "win32":
            return process.env.APPDATA ? join(process.env.APPDATA, "JetBrains") : undefined;
        default:
            return undefined;
    }
}

/**
 * Check if a JetBrains plugin is installed by scanning IDE config directories.
 * Looks for pluginId as a subdirectory under <version>/plugins/ across all IDE versions.
 */
export async function checkJetbrainsPlugin(check: JetbrainsPluginCheck): Promise<boolean> {
    const base = getJetbrainsConfigBase();
    if (!base) {
        return false;
    }

    let versionDirs: string[];
    try {
        versionDirs = await readdir(base);
    } catch {
        return false;
    }

    for (const versionDir of versionDirs) {
        try {
            const pluginEntries = await readdir(join(base, versionDir, "plugins"));
            if (
                pluginEntries.some((entry) => entry.toLowerCase() === check.pluginId.toLowerCase())
            ) {
                return true;
            }
        } catch {
            // plugins directory missing for this version — skip
        }
    }

    return false;
}

/**
 * Handler map for dispatching detection checks by type.
 * Uses an object so that individual handlers can be spied on in tests
 * (ESM module exports are not interceptable for intra-module calls).
 */
export const checkHandlers = {
    binary: checkBinary,
    directory: checkDirectory,
    app: checkAppBundle,
    "vscode-extension": checkVscodeExtension,
    "jetbrains-plugin": checkJetbrainsPlugin,
};

/**
 * Dispatch a single detection check to the appropriate mechanism function.
 */
function runCheck(check: DetectionCheck): Promise<boolean> {
    switch (check.type) {
        case "binary":
            return checkHandlers.binary(check);
        case "directory":
            return checkHandlers.directory(check);
        case "app":
            return checkHandlers.app(check);
        case "vscode-extension":
            return checkHandlers["vscode-extension"](check);
        case "jetbrains-plugin":
            return checkHandlers["jetbrains-plugin"](check);
    }
}

/**
 * Evaluate a DetectionConfig using OR-of-ANDs logic.
 * Each group is evaluated in parallel. Within a group, ALL checks must pass (AND).
 * ANY group passing means the tool is detected (OR across groups).
 */
export async function evaluateDetection(config: DetectionConfig): Promise<boolean> {
    const groupResults = await Promise.all(
        config.groups.map(async (group) => {
            const results = await Promise.all(group.map(runCheck));
            return results.every(Boolean);
        }),
    );
    return groupResults.some(Boolean);
}
