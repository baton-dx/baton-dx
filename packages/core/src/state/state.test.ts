import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { getStatePath, readState, writeState } from "./state.js";

describe("Placement State", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "baton-state-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getStatePath", () => {
    it("should return .baton/state.yaml path", () => {
      expect(getStatePath("/my/project")).toBe("/my/project/.baton/state.yaml");
    });
  });

  describe("writeState", () => {
    it("should write state as valid YAML", async () => {
      const state = {
        synced_at: "2024-01-01T00:00:00.000Z",
        tools: ["claude-code", "windsurf"],
        placed_files: [
          ".claude/skills/add-adapter",
          ".windsurf/skills/add-adapter",
          "CLAUDE.md",
          "AGENTS.md",
        ],
      };

      await writeState(tmpDir, state);

      const content = await readFile(getStatePath(tmpDir), "utf-8");
      expect(content).toContain("synced_at");
      expect(content).toContain("claude-code");
      expect(content).toContain(".claude/skills/add-adapter");
    });

    it("should create .baton directory if it does not exist", async () => {
      await writeState(tmpDir, {
        synced_at: "2024-01-01T00:00:00.000Z",
        tools: [],
        placed_files: [],
      });

      const content = await readFile(getStatePath(tmpDir), "utf-8");
      expect(content).toContain("synced_at");
    });

    it("should sort placed_files", async () => {
      await writeState(tmpDir, {
        synced_at: "2024-01-01T00:00:00.000Z",
        tools: ["claude-code"],
        placed_files: ["CLAUDE.md", ".claude/skills/foo", ".claude/commands/build.md"],
      });

      const state = await readState(tmpDir);
      expect(state).not.toBeNull();
      expect(state?.placed_files).toEqual([
        "CLAUDE.md",
        ".claude/skills/foo",
        ".claude/commands/build.md",
      ]);
    });
  });

  describe("readState", () => {
    it("should read valid state file", async () => {
      const state = {
        synced_at: "2024-01-01T00:00:00.000Z",
        tools: ["claude-code"],
        placed_files: [".claude/skills/foo", "CLAUDE.md"],
      };

      await writeState(tmpDir, state);

      const result = await readState(tmpDir);

      expect(result).not.toBeNull();
      expect(result?.synced_at).toBe("2024-01-01T00:00:00.000Z");
      expect(result?.tools).toEqual(["claude-code"]);
      expect(result?.placed_files).toEqual([".claude/skills/foo", "CLAUDE.md"]);
    });

    it("should return null if state file does not exist", async () => {
      const result = await readState(tmpDir);
      expect(result).toBeNull();
    });

    it("should return null if state file is invalid YAML", async () => {
      await mkdir(join(tmpDir, ".baton"), { recursive: true });
      await writeFile(getStatePath(tmpDir), "not: [valid: yaml:", "utf-8");

      const result = await readState(tmpDir);
      expect(result).toBeNull();
    });

    it("should return null if state file has invalid schema", async () => {
      await mkdir(join(tmpDir, ".baton"), { recursive: true });
      const invalidState = stringify({ synced_at: 12345, tools: "not-an-array" });
      await writeFile(getStatePath(tmpDir), invalidState, "utf-8");

      const result = await readState(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe("Round-trip", () => {
    it("should preserve state through write+read cycle", async () => {
      const state = {
        synced_at: "2026-02-23T12:00:00.000Z",
        tools: ["claude-code", "windsurf", "antigravity"],
        placed_files: [
          ".agent/skills/add-adapter",
          ".claude/commands/build.md",
          ".claude/skills/add-adapter",
          ".windsurf/skills/add-adapter",
          "AGENTS.md",
          "CLAUDE.md",
          "GEMINI.md",
        ],
      };

      await writeState(tmpDir, state);
      const result = await readState(tmpDir);

      expect(result).toEqual(state);
    });
  });
});
