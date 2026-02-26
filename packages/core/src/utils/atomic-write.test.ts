import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteFile } from "./atomic-write.js";

describe("atomicWriteFile", () => {
  const testDir = tmpdir();
  const testFile = join(testDir, `baton-atomic-test-${Date.now()}.txt`);

  afterEach(async () => {
    try {
      await unlink(testFile);
    } catch {
      // Ignore if file doesn't exist
    }
    try {
      await unlink(`${testFile}.baton-tmp`);
    } catch {
      // Ignore if tmp file doesn't exist
    }
  });

  it("writes file content correctly", async () => {
    await atomicWriteFile(testFile, "hello world");
    const content = await readFile(testFile, "utf-8");
    expect(content).toBe("hello world");
  });

  it("overwrites existing file", async () => {
    await atomicWriteFile(testFile, "first");
    await atomicWriteFile(testFile, "second");
    const content = await readFile(testFile, "utf-8");
    expect(content).toBe("second");
  });

  it("does not leave tmp file on success", async () => {
    await atomicWriteFile(testFile, "content");
    await expect(readFile(`${testFile}.baton-tmp`, "utf-8")).rejects.toThrow();
  });

  it("cleans up tmp file on write failure", async () => {
    // Write to an invalid path (non-existent deeply nested directory)
    const badPath = join(testDir, "nonexistent", "deep", "path", "file.txt");
    await expect(atomicWriteFile(badPath, "content")).rejects.toThrow();
    // Tmp file should not remain
    await expect(readFile(`${badPath}.baton-tmp`, "utf-8")).rejects.toThrow();
  });
});
