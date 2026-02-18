import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { FileNotFoundError } from "../errors.js";
import type { LockFile } from "../schemas/lockfile.js";
import { compareLock, generateLock, readLock, writeLock } from "./manager.js";

describe("Lockfile Manager", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "baton-lockfile-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("generateLock", () => {
    it("should generate a valid lockfile with locked_at timestamp", () => {
      const packages = {
        "my-profile": {
          source: "github:org/repo",
          resolved: "https://github.com/org/repo.git",
          version: "1.0.0",
          sha: "abc123",
          files: {
            "baton.profile.yaml": "name: test",
            "CLAUDE.md": "# Test",
          },
        },
      };

      const lockfile = generateLock(packages);

      expect(lockfile.locked_at).toBeDefined();
      expect(lockfile.locked_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(lockfile.packages["my-profile"]).toBeDefined();
      expect(lockfile.packages["my-profile"].source).toBe("github:org/repo");
      expect(lockfile.packages["my-profile"].version).toBe("1.0.0");
      expect(lockfile.packages["my-profile"].sha).toBe("abc123");
    });

    it("should generate SHA-256 hashes for plain string file contents", () => {
      const packages = {
        "test-pkg": {
          source: "local:./test",
          resolved: "/tmp/test",
          version: "0.1.0",
          sha: "local",
          files: {
            "file1.txt": "Hello World",
            "file2.md": "# Title\nContent",
          },
        },
      };

      const lockfile = generateLock(packages);
      const integrity = lockfile.packages["test-pkg"].integrity;

      // Verify hashes are SHA-256 (64 hex chars)
      expect(integrity["file1.txt"].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(integrity["file2.md"].hash).toMatch(/^[a-f0-9]{64}$/);

      // Different content should produce different hashes
      expect(integrity["file1.txt"].hash).not.toBe(integrity["file2.md"].hash);

      // Plain string files have no tool/category metadata
      expect(integrity["file1.txt"].tool).toBeUndefined();
      expect(integrity["file1.txt"].category).toBeUndefined();
    });

    it("should generate hashes with tool and category metadata", () => {
      const packages = {
        "test-pkg": {
          source: "github:org/repo",
          resolved: "https://github.com/org/repo.git",
          version: "1.0.0",
          sha: "abc123",
          files: {
            ".claude/CLAUDE.md": {
              content: "# Memory",
              tool: "claude-code",
              category: "ai" as const,
            },
            ".vscode/settings.json": {
              content: '{"editor.fontSize": 14}',
              tool: "vscode",
              category: "ide" as const,
            },
            Makefile: {
              content: "all: build",
              category: "files" as const,
            },
          },
        },
      };

      const lockfile = generateLock(packages);
      const integrity = lockfile.packages["test-pkg"].integrity;

      // Check AI file metadata
      expect(integrity[".claude/CLAUDE.md"].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(integrity[".claude/CLAUDE.md"].tool).toBe("claude-code");
      expect(integrity[".claude/CLAUDE.md"].category).toBe("ai");

      // Check IDE file metadata
      expect(integrity[".vscode/settings.json"].tool).toBe("vscode");
      expect(integrity[".vscode/settings.json"].category).toBe("ide");

      // Check files category (no tool)
      expect(integrity.Makefile.category).toBe("files");
      expect(integrity.Makefile.tool).toBeUndefined();
    });

    it("should handle multiple packages", () => {
      const packages = {
        pkg1: {
          source: "github:org/repo1",
          resolved: "https://github.com/org/repo1.git",
          version: "1.0.0",
          sha: "abc",
          files: { "file.txt": "content1" },
        },
        pkg2: {
          source: "github:org/repo2",
          resolved: "https://github.com/org/repo2.git",
          version: "2.0.0",
          sha: "def",
          files: { "file.txt": "content2" },
        },
      };

      const lockfile = generateLock(packages);

      expect(Object.keys(lockfile.packages)).toHaveLength(2);
      expect(lockfile.packages.pkg1).toBeDefined();
      expect(lockfile.packages.pkg2).toBeDefined();
    });

    it("should handle mixed plain string and LockFileEntry files", () => {
      const packages = {
        "test-pkg": {
          source: "github:org/repo",
          resolved: "https://github.com/org/repo.git",
          version: "1.0.0",
          sha: "abc123",
          files: {
            "legacy-file.txt": "plain content",
            ".claude/CLAUDE.md": {
              content: "# Memory",
              tool: "claude-code",
              category: "ai" as const,
            },
          },
        },
      };

      const lockfile = generateLock(packages);
      const integrity = lockfile.packages["test-pkg"].integrity;

      // Plain string file
      expect(integrity["legacy-file.txt"].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(integrity["legacy-file.txt"].tool).toBeUndefined();

      // LockFileEntry file
      expect(integrity[".claude/CLAUDE.md"].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(integrity[".claude/CLAUDE.md"].tool).toBe("claude-code");
    });
  });

  describe("writeLock", () => {
    it("should write lockfile as valid YAML with file metadata", async () => {
      const lockfile: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          "test-pkg": {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file1.txt": { hash: "hash1", tool: "claude-code", category: "ai" },
              "file2.md": { hash: "hash2", tool: undefined, category: undefined },
            },
          },
        },
      };

      const lockPath = join(tmpDir, "baton.lock");
      await writeLock(lockfile, lockPath);

      const content = await readFile(lockPath, "utf-8");
      const parsed = parse(content);

      expect(parsed.locked_at).toBe("2024-01-01T00:00:00.000Z");
      expect(parsed.packages["test-pkg"].source).toBe("github:org/repo");
      expect(parsed.packages["test-pkg"].integrity["file1.txt"].hash).toBe("hash1");
      expect(parsed.packages["test-pkg"].integrity["file1.txt"].tool).toBe("claude-code");
      expect(parsed.packages["test-pkg"].integrity["file1.txt"].category).toBe("ai");
    });

    it("should overwrite existing lockfile", async () => {
      const lockfile1: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {},
      };

      const lockfile2: LockFile = {
        locked_at: "2024-02-01T00:00:00.000Z",
        packages: {},
      };

      const lockPath = join(tmpDir, "baton.lock");

      await writeLock(lockfile1, lockPath);
      await writeLock(lockfile2, lockPath);

      const content = await readFile(lockPath, "utf-8");
      const parsed = parse(content);

      expect(parsed.locked_at).toBe("2024-02-01T00:00:00.000Z");
    });
  });

  describe("readLock", () => {
    it("should read and validate existing lockfile with file metadata", async () => {
      const lockfile: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          "test-pkg": {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file.txt": { hash: "hash123", tool: "cursor", category: "ai" },
            },
          },
        },
      };

      const lockPath = join(tmpDir, "baton.lock");
      await writeLock(lockfile, lockPath);

      const readResult = await readLock(lockPath);

      expect(readResult.locked_at).toBe("2024-01-01T00:00:00.000Z");
      expect(readResult.packages["test-pkg"].source).toBe("github:org/repo");
      expect(readResult.packages["test-pkg"].sha).toBe("abc123");
      expect(readResult.packages["test-pkg"].integrity["file.txt"].hash).toBe("hash123");
      expect(readResult.packages["test-pkg"].integrity["file.txt"].tool).toBe("cursor");
    });

    it("should throw FileNotFoundError when lockfile does not exist", async () => {
      const lockPath = join(tmpDir, "nonexistent.lock");

      await expect(readLock(lockPath)).rejects.toThrow(FileNotFoundError);
    });

    it("should throw error when lockfile has invalid format", async () => {
      const lockPath = join(tmpDir, "invalid.lock");
      await writeLock(
        {
          locked_at: "invalid-date",
          packages: {},
        } as LockFile,
        lockPath,
      );

      await expect(readLock(lockPath)).rejects.toThrow();
    });
  });

  describe("compareLock", () => {
    it("should detect SHA mismatch", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "def456",
            integrity: {},
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "sha_mismatch",
      });
    });

    it("should detect version changes", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "2.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "version_changed",
      });
    });

    it("should detect file content changes via hash comparison", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file.txt": { hash: "hash1", tool: "claude-code", category: "ai" },
            },
          },
        },
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file.txt": { hash: "hash2", tool: "claude-code", category: "ai" },
            },
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "file_changed: file.txt",
      });
    });

    it("should detect added files", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file1.txt": { hash: "hash1", tool: undefined, category: undefined },
            },
          },
        },
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file1.txt": { hash: "hash1", tool: undefined, category: undefined },
              "file2.txt": { hash: "hash2", tool: undefined, category: undefined },
            },
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "file_added: file2.txt",
      });
    });

    it("should detect removed files", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file1.txt": { hash: "hash1", tool: undefined, category: undefined },
              "file2.txt": { hash: "hash2", tool: undefined, category: undefined },
            },
          },
        },
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file1.txt": { hash: "hash1", tool: undefined, category: undefined },
            },
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "file_removed: file2.txt",
      });
    });

    it("should detect added packages", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {},
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "added",
      });
    });

    it("should detect removed packages", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {},
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "removed",
      });
    });

    it("should return empty array when lockfiles are identical", () => {
      const lockfile: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file.txt": { hash: "hash", tool: "claude-code", category: "ai" },
            },
          },
        },
      };

      const changes = compareLock(lockfile, lockfile);

      expect(changes).toHaveLength(0);
    });

    it("should handle multiple changes across multiple packages", () => {
      const current: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo1",
            resolved: "https://github.com/org/repo1.git",
            version: "1.0.0",
            sha: "abc",
            integrity: {},
          },
          pkg2: {
            source: "github:org/repo2",
            resolved: "https://github.com/org/repo2.git",
            version: "2.0.0",
            sha: "def",
            integrity: {},
          },
        },
      };

      const remote: LockFile = {
        locked_at: "2024-01-02T00:00:00.000Z",
        packages: {
          pkg1: {
            source: "github:org/repo1",
            resolved: "https://github.com/org/repo1.git",
            version: "1.0.0",
            sha: "xyz", // changed
            integrity: {},
          },
          pkg3: {
            source: "github:org/repo3",
            resolved: "https://github.com/org/repo3.git",
            version: "3.0.0",
            sha: "ghi",
            integrity: {},
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(3);
      expect(changes).toContainEqual({
        packageName: "pkg1",
        reason: "sha_mismatch",
      });
      expect(changes).toContainEqual({
        packageName: "pkg2",
        reason: "removed",
      });
      expect(changes).toContainEqual({
        packageName: "pkg3",
        reason: "added",
      });
    });
  });

  describe("Round-trip with tool metadata", () => {
    it("should preserve tool and category through write+read cycle", async () => {
      const packages = {
        "my-profile": {
          source: "github:org/repo",
          resolved: "https://github.com/org/repo.git",
          version: "1.0.0",
          sha: "abc123",
          files: {
            ".claude/CLAUDE.md": {
              content: "# Memory file",
              tool: "claude-code",
              category: "ai" as const,
            },
            ".vscode/settings.json": {
              content: "{}",
              tool: "vscode",
              category: "ide" as const,
            },
            "README.md": {
              content: "# README",
              category: "files" as const,
            },
          },
        },
      };

      const lockfile = generateLock(packages);
      const lockPath = join(tmpDir, "baton.lock");
      await writeLock(lockfile, lockPath);

      const readResult = await readLock(lockPath);

      const integrity = readResult.packages["my-profile"].integrity;
      expect(integrity[".claude/CLAUDE.md"].tool).toBe("claude-code");
      expect(integrity[".claude/CLAUDE.md"].category).toBe("ai");
      expect(integrity[".vscode/settings.json"].tool).toBe("vscode");
      expect(integrity[".vscode/settings.json"].category).toBe("ide");
      expect(integrity["README.md"].tool).toBeUndefined();
      expect(integrity["README.md"].category).toBe("files");
    });

    it("should read legacy lockfiles with plain string integrity", async () => {
      // Simulate a legacy lockfile written with the old format
      const { writeFile } = await import("node:fs/promises");
      const { stringify } = await import("yaml");

      const legacyLockfile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          "test-pkg": {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file1.txt": "plain-hash-old-format",
              "file2.md": "another-plain-hash",
            },
          },
        },
      };

      const lockPath = join(tmpDir, "legacy.lock");
      await writeFile(lockPath, stringify(legacyLockfile), "utf-8");

      const readResult = await readLock(lockPath);

      // Legacy strings should be transformed to FileMetadata objects
      const integrity = readResult.packages["test-pkg"].integrity;
      expect(integrity["file1.txt"].hash).toBe("plain-hash-old-format");
      expect(integrity["file1.txt"].tool).toBeUndefined();
      expect(integrity["file1.txt"].category).toBeUndefined();
      expect(integrity["file2.md"].hash).toBe("another-plain-hash");
    });
  });
});
