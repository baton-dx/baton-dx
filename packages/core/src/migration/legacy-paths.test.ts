import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectLegacyPaths,
  getConservativeAction,
  migrateCommonLegacyPaths,
  migrateLegacyFile,
} from "./legacy-paths.js";

describe("migration/legacy-paths", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), `baton-test-${crypto.randomUUID()}`);
    projectRoot = join(tempDir, "project");
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory (maxRetries avoids flaky ENOTEMPTY on macOS)
    await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  describe("detectLegacyPaths", () => {
    it("detects .cursorrules legacy file", async () => {
      const cursorrules = join(projectRoot, ".cursorrules");
      await writeFile(cursorrules, "# Cursor Rules", "utf-8");

      const legacyFiles = await detectLegacyPaths(projectRoot);

      const cursorFile = legacyFiles.find((f) => f.toolKey === "cursor");
      expect(cursorFile).toBeDefined();
      expect(cursorFile?.legacyPath).toBe(cursorrules);
      expect(cursorFile?.configType).toBe("rules");
    });

    it("detects .windsurfrules legacy file", async () => {
      const windsurfrules = join(projectRoot, ".windsurfrules");
      await writeFile(windsurfrules, "# Windsurf Rules", "utf-8");

      const legacyFiles = await detectLegacyPaths(projectRoot);

      const windsurfFile = legacyFiles.find((f) => f.toolKey === "windsurf");
      expect(windsurfFile).toBeDefined();
      expect(windsurfFile?.legacyPath).toBe(windsurfrules);
      expect(windsurfFile?.configType).toBe("rules");
    });

    it("returns empty array when no legacy files exist", async () => {
      const legacyFiles = await detectLegacyPaths(projectRoot);
      expect(legacyFiles).toEqual([]);
    });

    it("detects multiple legacy files", async () => {
      const cursorrules = join(projectRoot, ".cursorrules");
      const windsurfrules = join(projectRoot, ".windsurfrules");

      await writeFile(cursorrules, "# Cursor Rules", "utf-8");
      await writeFile(windsurfrules, "# Windsurf Rules", "utf-8");

      const legacyFiles = await detectLegacyPaths(projectRoot);

      expect(legacyFiles.length).toBeGreaterThanOrEqual(2);
      expect(legacyFiles.some((f) => f.toolKey === "cursor")).toBe(true);
      expect(legacyFiles.some((f) => f.toolKey === "windsurf")).toBe(true);
    });
  });

  describe("migrateLegacyFile", () => {
    it("skips migration when action is skip", async () => {
      const legacyPath = join(projectRoot, ".cursorrules");
      await writeFile(legacyPath, "# Cursor Rules", "utf-8");

      const result = await migrateLegacyFile(
        {
          legacyPath,
          newPath: join(projectRoot, ".cursor/rules/cursorrules.md"),
          configType: "rules",
          toolKey: "cursor",
        },
        "skip",
      );

      expect(result.action).toBe("skip");
      expect(result.success).toBe(true);
    });

    it("copies file when action is copy", async () => {
      const legacyPath = join(projectRoot, ".cursorrules");
      const newPath = join(projectRoot, ".cursor/rules/cursorrules.md");
      const content = "# Cursor Rules\nTest content";

      await writeFile(legacyPath, content, "utf-8");

      const result = await migrateLegacyFile(
        {
          legacyPath,
          newPath,
          configType: "rules",
          toolKey: "cursor",
        },
        "copy",
      );

      expect(result.action).toBe("copy");
      expect(result.success).toBe(true);

      // Verify new file exists with correct content
      const newContent = await readFile(newPath, "utf-8");
      expect(newContent).toBe(content);

      // Verify old file still exists
      const oldContent = await readFile(legacyPath, "utf-8");
      expect(oldContent).toBe(content);
    });

    it("migrates file (copy and delete) when action is migrate", async () => {
      const legacyPath = join(projectRoot, ".cursorrules");
      const newPath = join(projectRoot, ".cursor/rules/cursorrules.md");
      const content = "# Cursor Rules\nMigrated content";

      await writeFile(legacyPath, content, "utf-8");

      const result = await migrateLegacyFile(
        {
          legacyPath,
          newPath,
          configType: "rules",
          toolKey: "cursor",
        },
        "migrate",
      );

      expect(result.action).toBe("migrate");
      expect(result.success).toBe(true);

      // Verify new file exists with correct content
      const newContent = await readFile(newPath, "utf-8");
      expect(newContent).toBe(content);

      // Verify old file was removed
      let oldFileExists = true;
      try {
        await readFile(legacyPath, "utf-8");
      } catch {
        oldFileExists = false;
      }
      expect(oldFileExists).toBe(false);
    });

    it("creates parent directories if they don't exist", async () => {
      const legacyPath = join(projectRoot, ".cursorrules");
      const newPath = join(projectRoot, ".cursor/nested/deep/rules/cursorrules.md");
      const content = "# Cursor Rules";

      await writeFile(legacyPath, content, "utf-8");

      const result = await migrateLegacyFile(
        {
          legacyPath,
          newPath,
          configType: "rules",
          toolKey: "cursor",
        },
        "copy",
      );

      expect(result.success).toBe(true);

      // Verify file exists at deep path
      const newContent = await readFile(newPath, "utf-8");
      expect(newContent).toBe(content);
    });

    it("handles migration errors gracefully", async () => {
      const legacyPath = join(projectRoot, ".nonexistent");
      const newPath = join(projectRoot, ".cursor/rules/file.md");

      const result = await migrateLegacyFile(
        {
          legacyPath,
          newPath,
          configType: "rules",
          toolKey: "cursor",
        },
        "copy",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("copies directory recursively", async () => {
      const legacyDir = join(projectRoot, ".legacy-skills");
      const newDir = join(projectRoot, ".cursor/skills");

      // Create legacy directory structure
      await mkdir(legacyDir, { recursive: true });
      await writeFile(join(legacyDir, "skill1.md"), "Skill 1", "utf-8");
      await mkdir(join(legacyDir, "nested"), { recursive: true });
      await writeFile(join(legacyDir, "nested/skill2.md"), "Skill 2", "utf-8");

      const result = await migrateLegacyFile(
        {
          legacyPath: legacyDir,
          newPath: newDir,
          configType: "skills",
          toolKey: "cursor",
        },
        "copy",
      );

      expect(result.success).toBe(true);

      // Verify files were copied
      const skill1Content = await readFile(join(newDir, "skill1.md"), "utf-8");
      expect(skill1Content).toBe("Skill 1");

      const skill2Content = await readFile(join(newDir, "nested/skill2.md"), "utf-8");
      expect(skill2Content).toBe("Skill 2");
    });
  });

  describe("getConservativeAction", () => {
    it("returns copy action", () => {
      const action = getConservativeAction();
      expect(action).toBe("copy");
    });
  });

  describe("migrateCommonLegacyPaths", () => {
    it("migrates .cursorrules if it exists", async () => {
      const cursorrules = join(projectRoot, ".cursorrules");
      await writeFile(cursorrules, "# Cursor Rules", "utf-8");

      const results = await migrateCommonLegacyPaths(projectRoot);

      const cursorResult = results.find((r) => r.legacyPath.includes(".cursorrules"));
      expect(cursorResult).toBeDefined();
      expect(cursorResult?.success).toBe(true);
      expect(cursorResult?.action).toBe("copy");
    });

    it("migrates .windsurfrules if it exists", async () => {
      const windsurfrules = join(projectRoot, ".windsurfrules");
      await writeFile(windsurfrules, "# Windsurf Rules", "utf-8");

      const results = await migrateCommonLegacyPaths(projectRoot);

      const windsurfResult = results.find((r) => r.legacyPath.includes(".windsurfrules"));
      expect(windsurfResult).toBeDefined();
      expect(windsurfResult?.success).toBe(true);
      expect(windsurfResult?.action).toBe("copy");
    });

    it("returns empty array when no common legacy paths exist", async () => {
      const results = await migrateCommonLegacyPaths(projectRoot);
      expect(results).toEqual([]);
    });

    it("migrates both .cursorrules and .windsurfrules", async () => {
      const cursorrules = join(projectRoot, ".cursorrules");
      const windsurfrules = join(projectRoot, ".windsurfrules");

      await writeFile(cursorrules, "# Cursor Rules", "utf-8");
      await writeFile(windsurfrules, "# Windsurf Rules", "utf-8");

      const results = await migrateCommonLegacyPaths(projectRoot);

      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
