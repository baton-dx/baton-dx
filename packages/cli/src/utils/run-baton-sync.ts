import * as p from "@clack/prompts";

/**
 * Run `baton sync` as a child process, inheriting stdio for interactive output.
 */
export async function runBatonSync(cwd: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  await new Promise<void>((done) => {
    const syncProcess = spawn("baton", ["sync"], { cwd, stdio: "inherit" });
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
