import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveFileSource } from "./file-resolver.js";

describe("resolveFileSource", () => {
  const testDir = path.join(process.cwd(), ".test-file-resolver");
  const profileDir = path.join(testDir, "my-profile");

  beforeEach(async () => {
    await mkdir(profileDir, { recursive: true });
    await writeFile(
      path.join(profileDir, "baton.profile.yaml"),
      "name: test-profile\nversion: 1.0.0",
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("resolves absolute path", async () => {
    const result = await resolveFileSource({ filePath: profileDir });

    expect(result.absolutePath).toBe(profileDir);
    expect(result.isSymlink).toBe(false);
    expect(result.originalPath).toBe(profileDir);
  });

  test("resolves relative path", async () => {
    const result = await resolveFileSource({
      filePath: "./my-profile",
      basePath: testDir,
    });

    expect(result.absolutePath).toBe(profileDir);
    expect(result.isSymlink).toBe(false);
    expect(result.originalPath).toBe("./my-profile");
  });

  test("resolves parent relative path", async () => {
    // Create a subdirectory for testing parent path resolution
    const subDir = path.join(testDir, "subdir");
    await mkdir(subDir, { recursive: true });

    const result = await resolveFileSource({
      filePath: "../my-profile",
      basePath: subDir,
    });

    expect(result.absolutePath).toBe(profileDir);
    expect(result.isSymlink).toBe(false);
  });

  test("follows symlinks", async () => {
    const symlinkPath = path.join(testDir, "link-to-profile");
    await symlink(profileDir, symlinkPath);

    const result = await resolveFileSource({ filePath: symlinkPath });

    expect(result.absolutePath).toBe(profileDir);
    expect(result.isSymlink).toBe(true);
    expect(result.originalPath).toBe(symlinkPath);
  });

  test("throws if path does not exist", async () => {
    await expect(resolveFileSource({ filePath: "/nonexistent/path" })).rejects.toThrow(
      "File source path does not exist",
    );
  });

  test("throws if no baton.profile.yaml in path", async () => {
    const emptyDir = path.join(testDir, "empty");
    await mkdir(emptyDir, { recursive: true });

    await expect(resolveFileSource({ filePath: emptyDir })).rejects.toThrow(
      "No baton.profile.yaml found in file source",
    );
  });

  test("uses process.cwd() as default basePath", async () => {
    const relativeFromCwd = path.relative(process.cwd(), profileDir);

    const result = await resolveFileSource({ filePath: relativeFromCwd });

    expect(result.absolutePath).toBe(profileDir);
  });

  test("handles complex relative paths", async () => {
    const result = await resolveFileSource({
      filePath: "./my-profile/../my-profile/.",
      basePath: testDir,
    });

    expect(result.absolutePath).toBe(profileDir);
  });
});
