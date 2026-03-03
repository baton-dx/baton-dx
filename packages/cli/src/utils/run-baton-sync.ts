import * as p from "@clack/prompts";

/**
 * Run `baton sync` as a child process, inheriting stdio for interactive output.
 * Uses the currently running CLI binary (process.argv[1]) instead of a global
 * "baton" to ensure the same version handles the sync — critical when running
 * a local dev build via `baton-dev` or `bun run dev`.
 */
export async function runBatonSync(cwd: string): Promise<void> {
    const { spawn } = await import("node:child_process");
    await new Promise<void>((done) => {
        const syncProcess = spawn(process.execPath, [process.argv[1], "sync"], {
            cwd,
            stdio: "inherit",
        });
        syncProcess.on("close", (code) => {
            if (code === 0) {
                p.log.success("Profiles synced successfully!");
            } else {
                p.log.warn(`Sync finished with exit code ${code}`);
            }
            done();
        });
        syncProcess.on("error", (error) => {
            p.log.warn(`Failed to run sync: ${error.message}`);
            done();
        });
    });
}
