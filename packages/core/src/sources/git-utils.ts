import type { SimpleGit } from "simple-git";
import simpleGit from "simple-git";

/** Creates a non-interactive simple-git instance (no credential prompts). */
export function createGit(baseDir?: string) {
    const git = simpleGit({ baseDir: baseDir ?? process.cwd() }).env("GIT_TERMINAL_PROMPT", "0");
    // Only set GIT_SSH_COMMAND if user hasn't configured their own
    // (preserves custom SSH agents like 1Password, Secretive, ~/.ssh/config ProxyCommand)
    if (!process.env.GIT_SSH_COMMAND) {
        git.env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes");
    }
    return git;
}

/** Creates an interactive simple-git instance (allows credential prompts / browser auth). */
export function createInteractiveGit(baseDir?: string) {
    return simpleGit({ baseDir: baseDir ?? process.cwd() });
}

/** Returns true if the error is an auth failure caused by suppressed terminal prompts. */
export function isAuthError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
        msg.includes("terminal prompts disabled") ||
        msg.includes("could not read Username") ||
        msg.includes("Authentication failed") ||
        msg.includes("Permission denied")
    );
}

/**
 * Injects an auth token into a simple-git instance via HTTP header env vars.
 * Scoped to the target hostname so the token is never sent to other hosts.
 * Requires Git 2.31+ (March 2021) for GIT_CONFIG_COUNT support.
 */
export function withTokenAuth(git: SimpleGit, url: string, token: string): SimpleGit {
    let configKey = "http.extraheader";
    try {
        if (url.startsWith("https://") || url.startsWith("http://")) {
            const hostname = new URL(url).hostname;
            configKey = `http.https://${hostname}/.extraheader`;
        }
    } catch {
        // Malformed URL — use unscoped header as fallback
    }
    const encoded = Buffer.from(`x-access-token:${token}`).toString("base64");
    return git
        .env("GIT_CONFIG_COUNT", "1")
        .env("GIT_CONFIG_KEY_0", configKey)
        .env("GIT_CONFIG_VALUE_0", `Authorization: Basic ${encoded}`);
}

/** Strips embedded credentials from a URL for safe logging. */
export function redactUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) {
            parsed.username = "***";
            parsed.password = "";
            return parsed.toString();
        }
        return url;
    } catch {
        // Not a valid URL — strip with a non-backtracking pattern
        const idx = url.indexOf("://");
        if (idx === -1) return url;
        const afterScheme = url.indexOf("@", idx + 3);
        if (afterScheme === -1) return url;
        return `${url.slice(0, idx + 3)}***${url.slice(afterScheme)}`;
    }
}
