import simpleGit from "simple-git";

/** Creates a non-interactive simple-git instance (no credential prompts). */
export function createGit(baseDir?: string) {
    return simpleGit({ baseDir: baseDir ?? process.cwd() })
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes");
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
