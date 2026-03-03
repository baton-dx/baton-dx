import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";

export type InstallMethod =
    | { type: "homebrew"; bin: string; args: string[] }
    | { type: "npm"; bin: string; args: string[] }
    | { type: "pnpm"; bin: string; args: string[] }
    | { type: "yarn"; bin: string; args: string[] }
    | { type: "bun"; bin: string; args: string[] }
    | { type: "unknown" };

/**
 * Detect how Baton was installed by analyzing the resolved binary path.
 * Follows symlinks first so npm global installs (which symlink into
 * /usr/local/bin/) are correctly identified.
 *
 * Detection order: homebrew > pnpm > bun > yarn > npm (path) > npm (prefix fallback) > unknown
 */
export async function detectInstallMethod(): Promise<InstallMethod> {
    const binPath = await resolveBinaryPath();
    if (!binPath) {
        return { type: "unknown" };
    }

    const normalized = binPath.toLowerCase();

    if (normalized.includes("cellar") || normalized.includes("homebrew")) {
        return { type: "homebrew", bin: "brew", args: ["upgrade", "baton-dx"] };
    }

    if (normalized.includes("node_modules/.pnpm") || normalized.includes(".pnpm")) {
        return { type: "pnpm", bin: "pnpm", args: ["update", "-g", "@baton-dx/cli", "--latest"] };
    }

    if (normalized.includes(".bun") || normalized.includes("/bun/")) {
        return { type: "bun", bin: "bun", args: ["update", "-g", "@baton-dx/cli", "--latest"] };
    }

    if (normalized.includes("/yarn/") || normalized.includes(".yarn")) {
        return { type: "yarn", bin: "yarn", args: ["global", "add", "@baton-dx/cli@latest"] };
    }

    if (normalized.includes("node_modules") || normalized.includes("npm")) {
        return { type: "npm", bin: "npm", args: ["install", "-g", "@baton-dx/cli@latest"] };
    }

    // npm prefix fallback: when the binary is a symlink into npm's global prefix
    // but the resolved path doesn't contain recognizable markers
    if (await isInsideNpmPrefix(binPath)) {
        return { type: "npm", bin: "npm", args: ["install", "-g", "@baton-dx/cli@latest"] };
    }

    return { type: "unknown" };
}

/** Format an install method as a human-readable command string. */
export function formatInstallCommand(method: InstallMethod): string {
    if (method.type === "unknown") return "";
    return `${method.bin} ${method.args.join(" ")}`;
}

/**
 * Resolves the binary path, following symlinks to the real location.
 */
async function resolveBinaryPath(): Promise<string | undefined> {
    // First try process.argv[1] which is the script being executed
    const rawPath = process.argv[1] || undefined;

    if (rawPath) {
        try {
            return await realpath(rawPath);
        } catch {
            // realpath failed (e.g. file deleted), return raw path
            return rawPath;
        }
    }

    // Fallback: use `which` to find the binary, then resolve symlinks
    try {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile("which", ["baton"], (error, out) => {
                if (error) reject(error);
                else resolve(out);
            });
        });
        const whichPath = stdout.trim();
        try {
            return await realpath(whichPath);
        } catch {
            return whichPath;
        }
    } catch {
        return undefined;
    }
}

/**
 * Checks if the binary path is inside npm's global prefix directory.
 * Runs `npm prefix -g` and checks if the resolved binary is inside that dir.
 */
async function isInsideNpmPrefix(binPath: string): Promise<boolean> {
    try {
        const stdout = await new Promise<string>((resolve, reject) => {
            const child = execFile("npm", ["prefix", "-g"], { timeout: 5000 }, (error, out) => {
                if (error) reject(error);
                else resolve(out);
            });
            // Ensure child doesn't hang
            child.stdin?.end();
        });
        const prefix = stdout.trim().toLowerCase();
        return prefix.length > 0 && binPath.toLowerCase().startsWith(prefix);
    } catch {
        return false;
    }
}
