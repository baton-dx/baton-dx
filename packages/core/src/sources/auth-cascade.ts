import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type AuthMethod = "env" | "ssh" | "gh-cli" | "git-credential" | "none";

export interface AuthResult {
    method: AuthMethod;
    token?: string;
    useSSH?: boolean;
    /** Methods attempted before giving up. Only populated when method is "none". */
    triedMethods?: AuthMethod[];
}

export interface AuthLogger {
    debug: (message: string) => void;
}

export interface AuthOptions {
    logger?: AuthLogger;
}

/** Session-level cache keyed by hostname. */
const sessionCache = new Map<string, AuthResult>();

/**
 * Resolves authentication for a given hostname by cascading through
 * available credential sources. Results are cached for the session.
 *
 * Cascade order:
 * 1. Environment variables (GITHUB_TOKEN, GH_TOKEN, BATON_GIT_TOKEN)
 * 2. Git credential helper (`git credential fill`) — universal, works with ANY helper
 * 3. GitHub CLI (`gh auth token`) — fallback if credential helper not configured
 * 4. SSH keys (~/.ssh/id_* + connectivity check)
 * 5. None — returns clear error guidance, never prompts
 */
export async function resolveAuth(hostname: string, options?: AuthOptions): Promise<AuthResult> {
    const cached = sessionCache.get(hostname);
    if (cached) {
        options?.logger?.debug(`[auth] Using cached result for ${hostname}: ${cached.method}`);
        return cached;
    }

    const result = await runCascade(hostname, options?.logger);
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

async function runCascade(hostname: string, logger?: AuthLogger): Promise<AuthResult> {
    if (!isValidHostname(hostname)) {
        logger?.debug(`[auth] Invalid hostname: ${hostname}`);
        return { method: "none" };
    }

    const tried: AuthMethod[] = [];

    // 1. Environment variables
    logger?.debug(
        "[auth] Checking environment variables (GITHUB_TOKEN, GH_TOKEN, BATON_GIT_TOKEN)",
    );
    const envToken =
        process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.BATON_GIT_TOKEN;
    if (envToken && envToken !== "undefined") {
        logger?.debug("[auth] Found token via environment variable");
        return { method: "env", token: envToken };
    }
    tried.push("env");

    // 2. Git credential helper (universal — works with ANY credential helper)
    logger?.debug("[auth] Trying git credential fill");
    const credToken = await gitCredentialFill(hostname);
    if (credToken) {
        logger?.debug("[auth] Found token via git credential helper");
        return { method: "git-credential", token: credToken };
    }
    tried.push("git-credential");

    const isGitHub = hostname === "github.com" || hostname.endsWith(".github.com");

    // 3. GitHub CLI (only for GitHub hosts — fallback if credential helper not configured)
    if (isGitHub) {
        logger?.debug("[auth] Trying gh auth token");
        const ghToken = await ghAuthToken(hostname);
        if (ghToken) {
            logger?.debug("[auth] Found token via GitHub CLI");
            return { method: "gh-cli", token: ghToken };
        }
        tried.push("gh-cli");
    }

    // 4. SSH keys + connectivity check
    logger?.debug("[auth] Checking SSH keys");
    if (await hasSSHKeys()) {
        logger?.debug("[auth] SSH keys found, checking connectivity");
        if (await sshConnectivityCheck(hostname)) {
            logger?.debug("[auth] SSH connectivity confirmed");
            return { method: "ssh", useSSH: true };
        }
        logger?.debug("[auth] SSH connectivity check failed");
    } else {
        logger?.debug("[auth] No SSH keys found");
    }
    tried.push("ssh");

    // 5. No auth found
    logger?.debug(`[auth] No authentication found for ${hostname}. Tried: ${tried.join(", ")}`);
    return { method: "none", triedMethods: tried };
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
 * Parses the user's GIT_SSH_COMMAND into a command and arguments array.
 * Falls back to plain `ssh` if not set.
 */
function parseSSHCommand(): { cmd: string; baseArgs: string[] } {
    const sshCmd = process.env.GIT_SSH_COMMAND;
    if (!sshCmd) {
        return { cmd: "ssh", baseArgs: [] };
    }
    // Split on whitespace (simple tokenization — handles most real-world cases)
    const parts = sshCmd.split(/\s+/).filter(Boolean);
    return { cmd: parts[0], baseArgs: parts.slice(1) };
}

/**
 * Verifies SSH connectivity to a host.
 * Uses the user's GIT_SSH_COMMAND if set, falling back to plain `ssh`.
 * Always adds BatchMode=yes to prevent passphrase prompts.
 * Uses ephemeral known_hosts to avoid silently persisting untrusted host keys.
 * GitHub returns exit code 1 on success with "successfully authenticated".
 */
async function sshConnectivityCheck(hostname: string): Promise<boolean> {
    try {
        const { cmd, baseArgs } = parseSSHCommand();
        const { exitCode, stderr } = await execWithTimeout(
            cmd,
            [
                ...baseArgs,
                "-T",
                "-o",
                "BatchMode=yes",
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
export function getAuthSetupInstructions(hostname: string, triedMethods?: AuthMethod[]): string {
    const isGitHub = hostname === "github.com" || hostname.endsWith(".github.com");

    const lines = [`No authentication found for ${hostname}.`];
    if (triedMethods && triedMethods.length > 0) {
        lines.push(`Tried: ${triedMethods.join(", ")}`);
    }
    lines.push("", "To access private repos:");

    if (isGitHub) {
        lines.push(
            "  1. GitHub CLI:     gh auth login && gh auth setup-git",
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

export interface AuthDiagnosticStep {
    method: AuthMethod;
    success: boolean;
    detail: string;
}

function diagnoseEnv(): AuthDiagnosticStep {
    const envToken =
        process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.BATON_GIT_TOKEN;
    if (envToken && envToken !== "undefined") {
        const varName = process.env.GITHUB_TOKEN
            ? "GITHUB_TOKEN"
            : process.env.GH_TOKEN
              ? "GH_TOKEN"
              : "BATON_GIT_TOKEN";
        return { method: "env", success: true, detail: `${varName} set` };
    }
    return {
        method: "env",
        success: false,
        detail: "no GITHUB_TOKEN, GH_TOKEN, or BATON_GIT_TOKEN found",
    };
}

async function diagnoseCredential(hostname: string): Promise<AuthDiagnosticStep> {
    const credToken = await gitCredentialFill(hostname);
    return credToken
        ? { method: "git-credential", success: true, detail: "credential helper returned a token" }
        : {
              method: "git-credential",
              success: false,
              detail: "no credential helper configured or no stored credential",
          };
}

async function diagnoseGhCli(hostname: string): Promise<AuthDiagnosticStep> {
    const ghToken = await ghAuthToken(hostname);
    return ghToken
        ? { method: "gh-cli", success: true, detail: "token found via gh auth token" }
        : { method: "gh-cli", success: false, detail: "gh not installed or not authenticated" };
}

async function diagnoseSSH(hostname: string): Promise<AuthDiagnosticStep> {
    const hasKeys = await hasSSHKeys();
    if (!hasKeys) {
        return { method: "ssh", success: false, detail: "no SSH keys found in ~/.ssh" };
    }
    const connected = await sshConnectivityCheck(hostname);
    return connected
        ? { method: "ssh", success: true, detail: `authenticated as git@${hostname}` }
        : { method: "ssh", success: false, detail: "SSH keys found but connectivity check failed" };
}

/**
 * Runs the full auth cascade without short-circuiting.
 * Returns diagnostic results for every method, useful for `baton auth status`.
 */
export async function runAuthDiagnostic(hostname: string): Promise<AuthDiagnosticStep[]> {
    if (!isValidHostname(hostname)) {
        return [{ method: "none", success: false, detail: `Invalid hostname: ${hostname}` }];
    }

    const isGitHub = hostname === "github.com" || hostname.endsWith(".github.com");
    const steps: AuthDiagnosticStep[] = [diagnoseEnv(), await diagnoseCredential(hostname)];

    if (isGitHub) {
        steps.push(await diagnoseGhCli(hostname));
    }

    steps.push(await diagnoseSSH(hostname));

    return steps;
}
