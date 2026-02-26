import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { flattenPlacedFiles, getStatePath, readState, writeState } from "./state.js";

const emptyPlacedFiles = { "ai-tools": [], ides: [], files: [] };

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
        placed_files: {
          "ai-tools": [
            ".claude/skills/add-adapter",
            ".windsurf/skills/add-adapter",
            "CLAUDE.md",
            "AGENTS.md",
          ],
          ides: [],
          files: [],
        },
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
        placed_files: emptyPlacedFiles,
      });

      const content = await readFile(getStatePath(tmpDir), "utf-8");
      expect(content).toContain("synced_at");
    });
  });

  describe("readState", () => {
    it("should read valid state file", async () => {
      const state = {
        synced_at: "2024-01-01T00:00:00.000Z",
        tools: ["claude-code"],
        placed_files: {
          "ai-tools": [".claude/skills/foo", "CLAUDE.md"],
          ides: [".vscode/settings.json"],
          files: ["biome.json"],
        },
      };

      await writeState(tmpDir, state);

      const result = await readState(tmpDir);

      expect(result).not.toBeNull();
      expect(result?.synced_at).toBe("2024-01-01T00:00:00.000Z");
      expect(result?.tools).toEqual(["claude-code"]);
      expect(result?.placed_files["ai-tools"]).toEqual([".claude/skills/foo", "CLAUDE.md"]);
      expect(result?.placed_files.ides).toEqual([".vscode/settings.json"]);
      expect(result?.placed_files.files).toEqual(["biome.json"]);
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

    it("should return null for old flat placed_files format", async () => {
      await mkdir(join(tmpDir, ".baton"), { recursive: true });
      const oldState = stringify({
        synced_at: "2024-01-01T00:00:00.000Z",
        tools: ["claude-code"],
        placed_files: [".claude/skills/foo"],
      });
      await writeFile(getStatePath(tmpDir), oldState, "utf-8");

      // Old format fails schema validation → graceful null
      const result = await readState(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe("flattenPlacedFiles", () => {
    it("should flatten all categories into a single array", () => {
      const placedFiles = {
        "ai-tools": [".claude/rules/foo.md", ".cursor/rules/foo.md"],
        ides: [".vscode/settings.json"],
        files: ["biome.json"],
      };
      expect(flattenPlacedFiles(placedFiles)).toEqual([
        ".claude/rules/foo.md",
        ".cursor/rules/foo.md",
        ".vscode/settings.json",
        "biome.json",
      ]);
    });

    it("should return empty array if all categories empty", () => {
      expect(flattenPlacedFiles(emptyPlacedFiles)).toEqual([]);
    });
  });

  describe("Round-trip", () => {
    it("should preserve state through write+read cycle", async () => {
      const state = {
        synced_at: "2026-02-23T12:00:00.000Z",
        tools: ["claude-code", "windsurf", "antigravity"],
        placed_files: {
          "ai-tools": [
            ".agent/skills/add-adapter",
            ".claude/commands/build.md",
            ".claude/skills/add-adapter",
            ".windsurf/skills/add-adapter",
            "AGENTS.md",
            "CLAUDE.md",
            "GEMINI.md",
          ],
          ides: [".vscode/settings.json"],
          files: ["biome.json"],
        },
      };

      await writeState(tmpDir, state);
      const result = await readState(tmpDir);

      expect(result).toEqual(state);
    });
  });
});
