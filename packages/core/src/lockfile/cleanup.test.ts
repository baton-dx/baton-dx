import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { removePlacedFiles } from "./cleanup.js";

describe("removePlacedFiles", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "baton-cleanup-test-"));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("should remove a single file and return count of 1", async () => {
    const filePath = join(projectRoot, "test-file.txt");
    await writeFile(filePath, "content");

    const count = await removePlacedFiles([filePath], projectRoot);

    expect(count).toBe(1);
    await expect(stat(filePath)).rejects.toThrow();
  });

  it("should remove a directory recursively", async () => {
    const dirPath = join(projectRoot, ".cursor", "skills", "my-skill");
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, "index.md"), "# Skill");
    await writeFile(join(dirPath, "config.json"), "{}");

    const count = await removePlacedFiles([dirPath], projectRoot);

    expect(count).toBe(1);
    await expect(stat(dirPath)).rejects.toThrow();
  });

  it("should silently skip already-deleted paths (ENOENT)", async () => {
    const missingPath = join(projectRoot, "does-not-exist.txt");

    const count = await removePlacedFiles([missingPath], projectRoot);

    expect(count).toBe(0);
  });

  it("should clean up empty parent directories up to projectRoot", async () => {
    const nestedDir = join(projectRoot, ".claude", "rules");
    await mkdir(nestedDir, { recursive: true });
    const filePath = join(nestedDir, "my-rule.md");
    await writeFile(filePath, "# Rule");

    const count = await removePlacedFiles([filePath], projectRoot);

    expect(count).toBe(1);
    // Both .claude/rules/ and .claude/ should be removed (empty after file deletion)
    await expect(stat(join(projectRoot, ".claude", "rules"))).rejects.toThrow();
    await expect(stat(join(projectRoot, ".claude"))).rejects.toThrow();
    // projectRoot itself must still exist
    const rootStat = await stat(projectRoot);
    expect(rootStat.isDirectory()).toBe(true);
  });

  it("should not remove non-empty parent directories", async () => {
    const nestedDir = join(projectRoot, ".claude", "rules");
    await mkdir(nestedDir, { recursive: true });
    const targetFile = join(nestedDir, "remove-me.md");
    const keepFile = join(nestedDir, "keep-me.md");
    await writeFile(targetFile, "remove");
    await writeFile(keepFile, "keep");

    const count = await removePlacedFiles([targetFile], projectRoot);

    expect(count).toBe(1);
    // Parent should still exist because keep-me.md is there
    const entries = await readdir(nestedDir);
    expect(entries).toContain("keep-me.md");
  });

  it("should handle relative paths by resolving against projectRoot", async () => {
    const nestedDir = join(projectRoot, ".cursor", "skills");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(join(nestedDir, "skill.md"), "content");

    const relativePath = ".cursor/skills/skill.md";
    const count = await removePlacedFiles([relativePath], projectRoot);

    expect(count).toBe(1);
    await expect(stat(join(nestedDir, "skill.md"))).rejects.toThrow();
  });

  it("should handle absolute paths directly", async () => {
    const filePath = join(projectRoot, "absolute-test.txt");
    await writeFile(filePath, "content");

    const count = await removePlacedFiles([filePath], projectRoot);

    expect(count).toBe(1);
    await expect(stat(filePath)).rejects.toThrow();
  });

  it("should handle mixed absolute and relative paths", async () => {
    const dir = join(projectRoot, ".claude");
    await mkdir(dir, { recursive: true });
    const absFile = join(dir, "abs-file.md");
    const relFile = join(dir, "rel-file.md");
    await writeFile(absFile, "absolute");
    await writeFile(relFile, "relative");

    const count = await removePlacedFiles([absFile, relative(projectRoot, relFile)], projectRoot);

    expect(count).toBe(2);
    await expect(stat(absFile)).rejects.toThrow();
    await expect(stat(relFile)).rejects.toThrow();
  });

  it("should handle multiple files including some already gone", async () => {
    const existingFile = join(projectRoot, "exists.txt");
    await writeFile(existingFile, "content");
    const missingFile = join(projectRoot, "missing.txt");

    const count = await removePlacedFiles([existingFile, missingFile], projectRoot);

    expect(count).toBe(1);
  });

  it("should return 0 for an empty file list", async () => {
    const count = await removePlacedFiles([], projectRoot);
    expect(count).toBe(0);
  });
});
