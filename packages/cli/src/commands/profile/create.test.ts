import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCommand } from "./create.js";

describe("baton profile create", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temp directory for each test
    testDir = join(tmpdir(), `baton-profile-create-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  test("validates command structure", () => {
    expect(createCommand).toBeDefined();
    expect(createCommand.run).toBeDefined();
  });

  test("name argument is optional", () => {
    const args = createCommand.args as Record<string, unknown>;
    expect(args).toBeDefined();
    const nameArg = args?.name as { required?: boolean } | undefined;
    expect(nameArg).toBeDefined();
    expect(nameArg?.required).toBe(false);
  });

  test("no template flag exists", () => {
    const args = createCommand.args as Record<string, unknown>;
    expect(args?.template).toBeUndefined();
  });

  test("validates kebab-case name format", async () => {
    // Setup: Create source repo (baton.source.yaml)
    await writeFile(join(testDir, "baton.source.yaml"), "name: test-repo\nversion: 1.0.0");

    // Mock process.exit
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    // Test invalid names
    const invalidNames = ["MyProfile", "my_profile", "my profile", "123profile", "my--profile"];

    for (const name of invalidNames) {
      try {
        await createCommand.run?.({
          args: { name },
          rawArgs: [],
          data: {},
        } as never);
      } catch (_error) {
        // Expected to throw due to process.exit mock
      }
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  test("checks source repo context", async () => {
    // No baton.source.yaml in testDir

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    try {
      await createCommand.run?.({
        args: { name: "my-profile" },
        rawArgs: [],
        data: {},
      } as never);
    } catch (_error) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  test("detects existing profile", async () => {
    // Setup: Create source repo and existing profile
    await writeFile(join(testDir, "baton.source.yaml"), "name: test-repo\nversion: 1.0.0");
    await mkdir(join(testDir, "profiles", "my-profile"), { recursive: true });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    try {
      await createCommand.run?.({
        args: { name: "my-profile" },
        rawArgs: [],
        data: {},
      } as never);
    } catch (_error) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(testDir, "profiles", "my-profile"), { recursive: true, force: true });
  });
});
