import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type * as p from "@clack/prompts";

const execFileAsync = promisify(execFile);

const HOOK_TIMEOUT_MS = 30_000;

/**
 * Run a profile lifecycle hook (post-install or post-update).
 *
 * Hooks are best-effort: failures log a warning but never abort the sync.
 * The command runs in the project root with BATON_PROFILE and BATON_HOOK env vars.
 */
export async function runProfileHook(params: {
  command: string;
  profileName: string;
  hookType: "post-install" | "post-update";
  projectRoot: string;
  spinner: ReturnType<typeof p.spinner>;
}): Promise<void> {
  const { command, profileName, hookType, projectRoot, spinner } = params;

  spinner.start(`Running ${hookType} hook for "${profileName}"...`);

  try {
    await execFileAsync("sh", ["-c", command], {
      cwd: projectRoot,
      timeout: HOOK_TIMEOUT_MS,
      env: {
        ...process.env,
        BATON_PROFILE: profileName,
        BATON_HOOK: hookType,
      },
    });
    spinner.stop(`Hook ${hookType} for "${profileName}" completed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.stop(`Hook ${hookType} for "${profileName}" failed: ${message}`);
  }
}
