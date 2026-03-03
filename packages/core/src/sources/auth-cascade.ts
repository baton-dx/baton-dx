import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type AuthMethod = "env" | "ssh" | "gh-cli" | "git-credential" | "none";

export interface AuthResult {
    method: AuthMethod;
    token?: string;
    useSSH?: boolean;
}

/** Session-level cache keyed by hostname. */
const sessionCache = new Map<string, AuthResult>();

/**
 * Resolves authentication for a given hostname by cascading through
 * available credential sources. Results are cached for the session.
 *
 * Cascade order:
 * 1. Environment variables (GITHUB_TOKEN, GH_TOKEN, BATON_GIT_TOKEN)
 * 2. SSH keys (~/.ssh/id_* + connectivity check)
 * 3. GitHub CLI (`gh auth token`)
 * 4. Git credential helper (`git credential fill`)
 * 5. None — returns clear error guidance, never prompts
 */
export async function resolveAuth(hostname: string): Promise<AuthResult> {
    const cached = sessionCache.get(hostname);
    if (cached) return cached;

    const result = await runCascade(hostname);
    sessionCache.set(hostname, result);
    return result;
}

/** Clears the session auth cache. */
export function clearAuthCache(): void {
    sessionCache.clear();
}

/** Validates hostname to prevent injection via newlines or shell metacharacters. */
function isValidHostname(hostname: string): boolean {
    return /^[a-zA-Z0-9.-]+$/.test(hostname) && hostname.length > 0 && hostname.length <= 253;
}

async function runCascade(hostname: string): Promise<AuthResult> {
    if (!isValidHostname(hostname)) {
        return { method: "none" };
    }

    // 1. Environment variables
    const envToken =
        process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.BATON_GIT_TOKEN;
    if (envToken && envToken !== "undefined") {
        return { method: "env", token: envToken };
    }

    // 2. SSH keys
    if (await hasSSHKeys()) {
        if (await sshConnectivityCheck(hostname)) {
            return { method: "ssh", useSSH: true };
        }
    }

    const isGitHub = hostname === "github.com" || hostname.endsWith(".github.com");

    // 3. GitHub CLI (only for GitHub hosts)
    if (isGitHub) {
        const ghToken = await ghAuthToken(hostname);
        if (ghToken) {
            return { method: "gh-cli", token: ghToken };
        }
    }

    // 4. Git credential helper
    const credToken = await gitCredentialFill(hostname);
    if (credToken) {
        return { method: "git-credential", token: credToken };
    }

    // 5. No auth found
    return { method: "none" };
}

/** Checks whether any SSH private key files exist in ~/.ssh */
async function hasSSHKeys(): Promise<boolean> {
    const sshDir = join(homedir(), ".ssh");
    const keyNames = ["id_rsa", "id_ed25519", "id_ecdsa", "id_dsa"];
    for (const name of keyNames) {
        try {
            await access(join(sshDir, name));
            return true;
        } catch {
            // continue
        }
    }
    return false;
}

/**
 * Verifies SSH connectivity to a host.
 * Uses ephemeral known_hosts to avoid silently persisting untrusted host keys.
 * GitHub returns exit code 1 on success with "successfully authenticated".
 */
async function sshConnectivityCheck(hostname: string): Promise<boolean> {
    try {
        const { exitCode, stderr } = await execWithTimeout(
            "ssh",
            [
                "-T",
                "-o",
                "StrictHostKeyChecking=no",
                "-o",
                "UserKnownHostsFile=/dev/null",
                "-o",
                "ConnectTimeout=5",
                "-o",
                "LogLevel=ERROR",
                `git@${hostname}`,
            ],
            10_000,
        );
        // GitHub exits 1 on success, with a "successfully authenticated" message
        if (exitCode === 1 && stderr.includes("successfully authenticated")) {
            return true;
        }
        // Exit 0 also means success (some non-GitHub hosts)
        return exitCode === 0;
    } catch {
        return false;
    }
}

/** Runs `gh auth token [--hostname]` to get a token from the GitHub CLI. */
async function ghAuthToken(hostname: string): Promise<string | undefined> {
    try {
        const args = ["auth", "token"];
        if (hostname !== "github.com") {
            args.push("--hostname", hostname);
        }
        const { stdout, exitCode } = await execWithTimeout("gh", args, 5_000);
        if (exitCode === 0 && stdout.trim()) {
            return stdout.trim();
        }
        return undefined;
    } catch {
        return undefined;
    }
}

/**
 * Uses `git credential fill` to query the system credential helper
 * (macOS Keychain, Windows Credential Manager, etc.)
 */
async function gitCredentialFill(hostname: string): Promise<string | undefined> {
    try {
        const input = `protocol=https\nhost=${hostname}\n\n`;
        const { stdout, exitCode } = await execWithTimeout(
            "git",
            ["credential", "fill"],
            5_000,
            input,
        );
        if (exitCode !== 0) return undefined;

        // Parse output for password field
        const match = stdout.match(/^password=(.+)$/m);
        return match?.[1] || undefined;
    } catch {
        return undefined;
    }
}

interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

function execWithTimeout(
    cmd: string,
    args: string[],
    timeoutMs: number,
    stdinData?: string,
): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const child = execFile(cmd, args, {}, (error, stdout, stderr) => {
            if (timer) clearTimeout(timer);
            if (settled) return;
            settled = true;
            resolve({
                stdout: stdout ?? "",
                stderr: stderr ?? "",
                exitCode: error?.code ? Number(error.code) : error ? 1 : 0,
            });
        });

        if (!settled) {
            timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                child.kill("SIGKILL");
                reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        }

        if (stdinData && child.stdin) {
            if (typeof child.stdin.on === "function") {
                child.stdin.on("error", () => {}); // suppress EPIPE if child exits early
            }
            child.stdin.write(stdinData);
            child.stdin.end();
        }
    });
}

/**
 * Returns actionable setup instructions when no auth method is available.
 */
export function getAuthSetupInstructions(hostname: string): string {
    const isGitHub = hostname === "github.com" || hostname.endsWith(".github.com");

    const lines = [`No authentication found for ${hostname}. To access private repos:`, ""];

    if (isGitHub) {
        lines.push(
            "  1. GitHub CLI:     gh auth login",
            "  2. SSH key:        ssh-keygen -t ed25519 && ssh-add",
            "  3. Environment:    export GITHUB_TOKEN=ghp_...",
        );
    } else {
        lines.push(
            "  1. SSH key:        ssh-keygen -t ed25519 && ssh-add",
            "  2. Environment:    export BATON_GIT_TOKEN=<token>",
            "  3. Git credential: git config --global credential.helper store",
        );
    }

    return lines.join("\n");
}
