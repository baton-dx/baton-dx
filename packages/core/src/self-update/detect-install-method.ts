import { execFile } from "node:child_process";

export type InstallMethod =
    | { type: "homebrew"; bin: string; args: string[] }
    | { type: "npm"; bin: string; args: string[] }
    | { type: "pnpm"; bin: string; args: string[] }
    | { type: "bun"; bin: string; args: string[] }
    | { type: "unknown" };

/**
 * Detect how Baton was installed by analyzing the resolved binary path.
 * Order matters: Homebrew first (may contain node_modules internally),
 * then pnpm, bun, npm.
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

    if (normalized.includes("node_modules") || normalized.includes("npm")) {
        return { type: "npm", bin: "npm", args: ["install", "-g", "@baton-dx/cli@latest"] };
    }

    return { type: "unknown" };
}

/** Format an install method as a human-readable command string. */
export function formatInstallCommand(method: InstallMethod): string {
    if (method.type === "unknown") return "";
    return `${method.bin} ${method.args.join(" ")}`;
}

async function resolveBinaryPath(): Promise<string | undefined> {
    // First try process.argv[1] which is the script being executed
    if (process.argv[1]) {
        return process.argv[1];
    }

    // Fallback: use `which` to find the binary
    try {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile("which", ["baton"], (error, out) => {
                if (error) reject(error);
                else resolve(out);
            });
        });
        return stdout.trim();
    } catch {
        return undefined;
    }
}
