import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandMeta } from "citty";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { profileRemoveCommand as removeCommand } from "./remove.js";

describe("baton profile remove", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `baton-profile-remove-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  it("should have correct meta information", () => {
    const meta = removeCommand.meta as CommandMeta;
    expect(meta.name).toBe("remove");
    expect(meta.description).toContain("Remove");
  });

  it("should define name as positional required arg", () => {
    const args = removeCommand.args as Record<string, { type: string; required?: boolean }>;
    expect(args.name.type).toBe("positional");
    expect(args.name.required).toBe(true);
  });

  it("no force flag exists", () => {
    const args = removeCommand.args as Record<string, unknown>;
    expect(args.force).toBeUndefined();
  });

  it("should have a run function", () => {
    expect(removeCommand.run).toBeDefined();
    expect(typeof removeCommand.run).toBe("function");
  });

  it("checks source repo context", async () => {
    // No baton.source.yaml in testDir
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    try {
      await removeCommand.run?.({
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

  it("fails when profile does not exist", async () => {
    // Create source repo context
    await writeFile(join(testDir, "baton.source.yaml"), "name: test-repo\nversion: 1.0.0");
    await mkdir(join(testDir, "profiles"), { recursive: true });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    try {
      await removeCommand.run?.({
        args: { name: "nonexistent" },
        rawArgs: [],
        data: {},
      } as never);
    } catch (_error) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
