import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceNotFoundError } from "../errors.js";
import { type LocalSource, loadLocalSource, resolveLocalPath } from "./local-source.js";

describe("resolveLocalPath", () => {
  it("returns absolute paths as-is", () => {
    const absolutePath = "/absolute/path/to/profile";
    const result = resolveLocalPath(absolutePath, "/some/base/dir");
    expect(result).toBe(absolutePath);
  });

  it("resolves relative paths relative to baseDir", () => {
    const relativePath = "./local/profile";
    const baseDir = "/home/user/project";
    const result = resolveLocalPath(relativePath, baseDir);
    expect(result).toBe("/home/user/project/local/profile");
  });

  it("resolves parent directory references correctly", () => {
    const relativePath = "../shared/profile";
    const baseDir = "/home/user/project";
    const result = resolveLocalPath(relativePath, baseDir);
    expect(result).toBe("/home/user/shared/profile");
  });
});

describe("loadLocalSource", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test fixtures
    tempDir = join(tmpdir(), `baton-test-${crypto.randomUUID()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it("loads a local source with absolute path", async () => {
    // Create test profile directory
    const profileDir = join(tempDir, "profile");
    await mkdir(profileDir, { recursive: true });
    await writeFile(join(profileDir, "baton.profile.yaml"), "name: test\nversion: 1.0.0\n");
    await writeFile(join(profileDir, "README.md"), "# Test Profile\n");

    const result: LocalSource = await loadLocalSource({
      path: profileDir,
      baseDir: tempDir,
    });

    expect(result.resolvedPath).toBe(profileDir);
    expect(result.integrity).toBeDefined();
    expect(result.integrity["baton.profile.yaml"]).toBeDefined();
    expect(result.integrity["README.md"]).toBeDefined();
    expect(Object.keys(result.integrity)).toHaveLength(2);
  });

  it("loads a local source with relative path", async () => {
    // Create test profile directory
    const profileDir = join(tempDir, "local-profile");
    await mkdir(profileDir, { recursive: true });
    await writeFile(join(profileDir, "manifest.yaml"), "test: true\n");

    const result: LocalSource = await loadLocalSource({
      path: "./local-profile",
      baseDir: tempDir,
    });

    expect(result.resolvedPath).toBe(profileDir);
    expect(result.integrity).toBeDefined();
    expect(result.integrity["manifest.yaml"]).toBeDefined();
    expect(Object.keys(result.integrity)).toHaveLength(1);
  });

  it("generates SHA-256 integrity hashes for all files", async () => {
    // Create test profile with known content
    const profileDir = join(tempDir, "hash-test");
    await mkdir(profileDir, { recursive: true });
    const testContent = "Hello Baton!";
    await writeFile(join(profileDir, "test.txt"), testContent);

    const result: LocalSource = await loadLocalSource({
      path: profileDir,
      baseDir: tempDir,
    });

    // Manually compute expected SHA-256 hash
    const { createHash } = await import("node:crypto");
    const expectedHash = createHash("sha256").update(testContent).digest("hex");

    expect(result.integrity["test.txt"]).toBe(expectedHash);
  });

  it("recursively scans subdirectories", async () => {
    // Create nested directory structure
    const profileDir = join(tempDir, "nested");
    await mkdir(profileDir, { recursive: true });
    await mkdir(join(profileDir, "ai", "skills"), { recursive: true });
    await mkdir(join(profileDir, "files"), { recursive: true });

    await writeFile(join(profileDir, "root.txt"), "root");
    await writeFile(join(profileDir, "ai", "memory.md"), "memory");
    await writeFile(join(profileDir, "ai", "skills", "skill.md"), "skill");
    await writeFile(join(profileDir, "files", "config.json"), "config");

    const result: LocalSource = await loadLocalSource({
      path: profileDir,
      baseDir: tempDir,
    });

    expect(Object.keys(result.integrity)).toHaveLength(4);
    expect(result.integrity["root.txt"]).toBeDefined();
    expect(result.integrity["ai/memory.md"]).toBeDefined();
    expect(result.integrity["ai/skills/skill.md"]).toBeDefined();
    expect(result.integrity["files/config.json"]).toBeDefined();
  });

  it("throws SourceNotFoundError for non-existent path", async () => {
    const nonExistentPath = join(tempDir, "does-not-exist");

    await expect(
      loadLocalSource({
        path: nonExistentPath,
        baseDir: tempDir,
      }),
    ).rejects.toThrow(SourceNotFoundError);
  });

  it("throws SourceNotFoundError if path is a file, not a directory", async () => {
    // Create a file instead of a directory
    const filePath = join(tempDir, "file.txt");
    await writeFile(filePath, "not a directory");

    await expect(
      loadLocalSource({
        path: filePath,
        baseDir: tempDir,
      }),
    ).rejects.toThrow(SourceNotFoundError);
    await expect(
      loadLocalSource({
        path: filePath,
        baseDir: tempDir,
      }),
    ).rejects.toThrow("not a directory");
  });

  it("includes error message with resolved absolute path", async () => {
    const relativePath = "./missing/profile";

    try {
      await loadLocalSource({
        path: relativePath,
        baseDir: tempDir,
      });
      expect.fail("Should have thrown SourceNotFoundError");
    } catch (error) {
      expect(error).toBeInstanceOf(SourceNotFoundError);
      const err = error as SourceNotFoundError;
      // Error message should include the resolved absolute path
      expect(err.message).toContain(join(tempDir, "missing/profile"));
    }
  });

  it("handles empty directory (no files)", async () => {
    // Create empty directory
    const emptyDir = join(tempDir, "empty");
    await mkdir(emptyDir, { recursive: true });

    const result: LocalSource = await loadLocalSource({
      path: emptyDir,
      baseDir: tempDir,
    });

    expect(result.resolvedPath).toBe(emptyDir);
    expect(result.integrity).toEqual({});
    expect(Object.keys(result.integrity)).toHaveLength(0);
  });
});
