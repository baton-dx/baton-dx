import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runProfileHook } from "./run-hook.js";

// Minimal spinner mock matching @clack/prompts SpinnerResult
function createSpinnerMock() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    cancel: vi.fn(),
    error: vi.fn(),
    clear: vi.fn(),
    isCancelled: false,
  } as unknown as ReturnType<typeof import("@clack/prompts").spinner>;
}

describe("runProfileHook", () => {
  const testDir = join(tmpdir(), `baton-hook-test-${Date.now()}`);

  beforeEach(async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("executes a successful hook command", async () => {
    const markerFile = join(testDir, "hook-ran.txt");
    const spinner = createSpinnerMock();

    await runProfileHook({
      command: `echo "hook executed" > "${markerFile}"`,
      profileName: "test-profile",
      hookType: "post-install",
      projectRoot: testDir,
      spinner,
    });

    const content = await readFile(markerFile, "utf-8");
    expect(content.trim()).toBe("hook executed");
    expect(spinner.stop).toHaveBeenCalledWith(expect.stringContaining("completed"));
  });

  it("does not throw on hook failure", async () => {
    const spinner = createSpinnerMock();

    // Should not throw
    await runProfileHook({
      command: "exit 1",
      profileName: "test-profile",
      hookType: "post-update",
      projectRoot: testDir,
      spinner,
    });

    expect(spinner.stop).toHaveBeenCalledWith(expect.stringContaining("failed"));
  });

  it("passes BATON_PROFILE and BATON_HOOK env vars", async () => {
    const envFile = join(testDir, "env.txt");
    const spinner = createSpinnerMock();

    await runProfileHook({
      command: `echo "$BATON_PROFILE:$BATON_HOOK" > "${envFile}"`,
      profileName: "my-profile",
      hookType: "post-install",
      projectRoot: testDir,
      spinner,
    });

    const content = await readFile(envFile, "utf-8");
    expect(content.trim()).toBe("my-profile:post-install");
  });

  it("runs hook in the project root directory", async () => {
    const cwdFile = join(testDir, "cwd.txt");
    const spinner = createSpinnerMock();

    await runProfileHook({
      command: `pwd > "${cwdFile}"`,
      profileName: "test-profile",
      hookType: "post-install",
      projectRoot: testDir,
      spinner,
    });

    const cwd = await readFile(cwdFile, "utf-8");
    // On macOS, /tmp may resolve to /private/tmp
    expect(cwd.trim()).toContain("baton-hook-test");
  });
});
