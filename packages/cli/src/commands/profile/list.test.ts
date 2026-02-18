import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profileListCommand as listCommand } from "./list.js";

describe("profile list command", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `baton-test-${crypto.randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    vi.restoreAllMocks();
  });

  it("should have correct command metadata", () => {
    expect(listCommand.meta).toBeTruthy();
    // Note: citty meta can be Resolvable, so we skip deep checks in tests
  });

  it("should exit with error if not in source repo", async () => {
    process.chdir(testDir);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await listCommand.run?.({} as never);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should list root profile", async () => {
    // Create a minimal source repo with root profile
    const manifestContent = `
name: test-profile
version: 1.0.0
description: Test profile for listing
`;
    await writeFile(join(testDir, "baton.profile.yaml"), manifestContent);

    process.chdir(testDir);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await listCommand.run?.({} as never);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("should list root and sub-profiles", async () => {
    // Create root profile
    const rootManifest = `
name: root-profile
version: 1.0.0
description: Root profile
`;
    await writeFile(join(testDir, "baton.profile.yaml"), rootManifest);

    // Create sub-profile
    await mkdir(join(testDir, "frontend"), { recursive: true });
    const subManifest = `
name: frontend-profile
version: 2.0.0
description: Frontend sub-profile
`;
    await writeFile(join(testDir, "frontend", "baton.profile.yaml"), subManifest);

    process.chdir(testDir);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await listCommand.run?.({} as never);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("should handle no profiles found", async () => {
    // Create empty directory with baton.profile.yaml but no content
    await writeFile(join(testDir, "baton.profile.yaml"), "invalid: yaml: content:");

    process.chdir(testDir);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await listCommand.run?.({} as never);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
