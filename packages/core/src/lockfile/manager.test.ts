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
            "memory/MEMORY.md": "# Test",
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

      // Plain string files have no type metadata
      expect(integrity["file1.txt"].type).toBeUndefined();
    });

    it("should generate hashes with canonical type metadata", () => {
      const packages = {
        "test-pkg": {
          source: "github:org/repo",
          resolved: "https://github.com/org/repo.git",
          version: "1.0.0",
          sha: "abc123",
          files: {
            "memory/MEMORY.md": {
              content: "# Memory",
              type: "memory" as const,
            },
            "skills/add-adapter": {
              content: "# Skill content",
              type: "skills" as const,
            },
            "files/Makefile": {
              content: "all: build",
              type: "files" as const,
            },
            "ide/vscode/settings.json": {
              content: '{"editor.fontSize": 14}',
              type: "ide" as const,
            },
          },
        },
      };

      const lockfile = generateLock(packages);
      const integrity = lockfile.packages["test-pkg"].integrity;

      // Check canonical type metadata
      expect(integrity["memory/MEMORY.md"].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(integrity["memory/MEMORY.md"].type).toBe("memory");

      expect(integrity["skills/add-adapter"].type).toBe("skills");
      expect(integrity["files/Makefile"].type).toBe("files");
      expect(integrity["ide/vscode/settings.json"].type).toBe("ide");

      // No legacy tool/category fields in new entries
      expect(integrity["memory/MEMORY.md"].tool).toBeUndefined();
      expect(integrity["memory/MEMORY.md"].category).toBeUndefined();
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
            "memory/MEMORY.md": {
              content: "# Memory",
              type: "memory" as const,
            },
          },
        },
      };

      const lockfile = generateLock(packages);
      const integrity = lockfile.packages["test-pkg"].integrity;

      // Plain string file
      expect(integrity["legacy-file.txt"].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(integrity["legacy-file.txt"].type).toBeUndefined();

      // LockFileEntry file
      expect(integrity["memory/MEMORY.md"].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(integrity["memory/MEMORY.md"].type).toBe("memory");
    });
  });

  describe("writeLock", () => {
    it("should write lockfile as valid YAML with canonical type metadata", async () => {
      const lockfile: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          "test-pkg": {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "skills/foo": { hash: "hash1", type: "skills" },
              "memory/MEMORY.md": { hash: "hash2", type: "memory" },
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
      expect(parsed.packages["test-pkg"].integrity["skills/foo"].hash).toBe("hash1");
      expect(parsed.packages["test-pkg"].integrity["skills/foo"].type).toBe("skills");
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
    it("should read and validate existing lockfile with canonical metadata", async () => {
      const lockfile: LockFile = {
        locked_at: "2024-01-01T00:00:00.000Z",
        packages: {
          "test-pkg": {
            source: "github:org/repo",
            resolved: "https://github.com/org/repo.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "skills/foo": { hash: "hash123", type: "skills" },
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
      expect(readResult.packages["test-pkg"].integrity["skills/foo"].hash).toBe("hash123");
      expect(readResult.packages["test-pkg"].integrity["skills/foo"].type).toBe("skills");
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
              "skills/foo": { hash: "hash1", type: "skills" },
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
              "skills/foo": { hash: "hash2", type: "skills" },
            },
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "file_changed: skills/foo",
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
              "skills/foo": { hash: "hash1", type: "skills" },
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
              "skills/foo": { hash: "hash1", type: "skills" },
              "skills/bar": { hash: "hash2", type: "skills" },
            },
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "file_added: skills/bar",
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
              "skills/foo": { hash: "hash1", type: "skills" },
              "skills/bar": { hash: "hash2", type: "skills" },
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
              "skills/foo": { hash: "hash1", type: "skills" },
            },
          },
        },
      };

      const changes = compareLock(current, remote);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        packageName: "pkg1",
        reason: "file_removed: skills/bar",
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
              "skills/foo": { hash: "hash", type: "skills" },
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

  describe("Round-trip with canonical type metadata", () => {
    it("should preserve type through write+read cycle", async () => {
      const packages = {
        "my-profile": {
          source: "github:org/repo",
          resolved: "https://github.com/org/repo.git",
          version: "1.0.0",
          sha: "abc123",
          files: {
            "memory/MEMORY.md": {
              content: "# Memory file",
              type: "memory" as const,
            },
            "skills/add-adapter": {
              content: "# Skill",
              type: "skills" as const,
            },
            "files/README.md": {
              content: "# README",
              type: "files" as const,
            },
          },
        },
      };

      const lockfile = generateLock(packages);
      const lockPath = join(tmpDir, "baton.lock");
      await writeLock(lockfile, lockPath);

      const readResult = await readLock(lockPath);

      const integrity = readResult.packages["my-profile"].integrity;
      expect(integrity["memory/MEMORY.md"].type).toBe("memory");
      expect(integrity["skills/add-adapter"].type).toBe("skills");
      expect(integrity["files/README.md"].type).toBe("files");
    });

    it("should read legacy lockfiles with plain string integrity", async () => {
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
      expect(integrity["file1.txt"].type).toBeUndefined();
      expect(integrity["file1.txt"].tool).toBeUndefined();
      expect(integrity["file2.md"].hash).toBe("another-plain-hash");
    });

    it("should read legacy lockfiles with tool/category fields", async () => {
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
              ".claude/skills/foo": {
                hash: "abc123",
                tool: "claude-code",
                category: "ai",
              },
            },
          },
        },
      };

      const lockPath = join(tmpDir, "legacy-v2.lock");
      await writeFile(lockPath, stringify(legacyLockfile), "utf-8");

      const readResult = await readLock(lockPath);

      // Legacy tool/category fields should still be readable
      const integrity = readResult.packages["test-pkg"].integrity;
      expect(integrity[".claude/skills/foo"].hash).toBe("abc123");
      expect(integrity[".claude/skills/foo"].tool).toBe("claude-code");
      expect(integrity[".claude/skills/foo"].category).toBe("ai");
    });
  });
});
