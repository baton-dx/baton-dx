import { execFile } from "node:child_process";
import type { BinaryCheck, Platform } from "@baton-dx/agent-paths";

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
