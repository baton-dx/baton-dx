import { execFile } from "node:child_process";
import { constants, access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  AppBundleCheck,
  BinaryCheck,
  DirectoryCheck,
  Platform,
  VscodeExtensionCheck,
} from "@baton-dx/agent-paths";

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

/**
 * Check if a directory exists and optionally contains a marker file.
 * Prevents false positives from leftover empty directories (e.g., ~/.cline/ without settings.json).
 */
export async function checkDirectory(check: DirectoryCheck): Promise<boolean> {
  if (check.platforms && !check.platforms.includes(process.platform as Platform)) {
    return false;
  }

  const expandedPath = check.path.startsWith("~/")
    ? join(homedir(), check.path.slice(2))
    : check.path;

  try {
    await access(expandedPath, constants.R_OK);
  } catch {
    return false;
  }

  if (!check.markerFile) {
    return true;
  }

  try {
    await access(join(expandedPath, check.markerFile));
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a macOS .app bundle exists in /Applications or ~/Applications.
 * Returns false immediately on non-darwin platforms.
 */
export async function checkAppBundle(check: AppBundleCheck): Promise<boolean> {
  if (process.platform !== "darwin") {
    return false;
  }

  const searchPaths = check.searchPaths ?? ["/Applications", join(homedir(), "Applications")];

  for (const dir of searchPaths) {
    try {
      await access(join(dir, check.name));
      return true;
    } catch {
      // not found in this path, try next
    }
  }

  return false;
}

/** Map of editor names to their extension directory paths. */
const EDITOR_EXTENSION_DIRS: Record<string, string> = {
  vscode: join(homedir(), ".vscode", "extensions"),
  cursor: join(homedir(), ".cursor", "extensions"),
  windsurf: join(homedir(), ".windsurf", "extensions"),
};

/**
 * Check if a VS Code extension is installed in VS Code, Cursor, or Windsurf.
 * Matches extension directories by prefix (case-insensitive) since directories
 * are named `<extensionId>-<version>`.
 */
export async function checkVscodeExtension(check: VscodeExtensionCheck): Promise<boolean> {
  const editors = check.editors ?? ["vscode"];
  const prefix = check.extensionId.toLowerCase();

  for (const editor of editors) {
    const extDir = EDITOR_EXTENSION_DIRS[editor];
    if (!extDir) {
      // skip unknown editor
    } else {
      try {
        const entries = await readdir(extDir);
        if (entries.some((entry) => entry.toLowerCase().startsWith(prefix))) {
          return true;
        }
      } catch {
        // extension directory missing (ENOENT) — skip, not throw
      }
    }
  }

  return false;
}
