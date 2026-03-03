import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileNotFoundError, ManifestValidationError } from "../errors.js";
import { loadLockfile, loadProfileManifest, loadProjectManifest } from "./yaml-parser.js";

describe("loadProfileManifest", () => {
    it("should load and validate a valid profile manifest", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "baton-test-"));
        const manifestPath = join(tmpDir, "baton.profile.yaml");

        const validManifest = `
name: test-profile
version: 1.0.0
description: Test profile
ai:
  tools:
    - claude-code
    - cursor
  skills:
    - name: code-review
      scope: project
  memory:
    - source: MEMORY.md
      merge: replace
`;

        await writeFile(manifestPath, validManifest, "utf-8");

        const result = await loadProfileManifest(manifestPath);

        expect(result.name).toBe("test-profile");
        expect(result.version).toBe("1.0.0");
        expect(result.description).toBe("Test profile");
        expect(result.ai?.tools).toEqual(["claude-code", "cursor"]);

        await rm(tmpDir, { recursive: true });
    });

    it("should throw FileNotFoundError when file doesn't exist", async () => {
        await expect(loadProfileManifest("/nonexistent/path/baton.profile.yaml")).rejects.toThrow(
            FileNotFoundError,
        );
    });

    it("should throw ManifestValidationError on invalid manifest", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "baton-test-"));
        const manifestPath = join(tmpDir, "invalid.yaml");

        const invalidManifest = `
name: test
version: invalid-version
`;

        await writeFile(manifestPath, invalidManifest, "utf-8");

        await expect(loadProfileManifest(manifestPath)).rejects.toThrow(ManifestValidationError);

        await rm(tmpDir, { recursive: true });
    });

    it("should throw ManifestValidationError on malformed YAML", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "baton-test-"));
        const manifestPath = join(tmpDir, "malformed.yaml");

        const malformedYaml = `
name: test
  invalid: indentation
    - broken
`;

        await writeFile(manifestPath, malformedYaml, "utf-8");

        await expect(loadProfileManifest(manifestPath)).rejects.toThrow(ManifestValidationError);

        await rm(tmpDir, { recursive: true });
    });
});

describe("loadProjectManifest", () => {
    it("should load and validate a valid project manifest", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "baton-test-"));
        const manifestPath = join(tmpDir, "baton.yaml");

        const validManifest = `
profiles:
  - source: github:my-org/my-profile
    version: 1.0.0
variables:
  TEAM_NAME: Engineering
`;

        await writeFile(manifestPath, validManifest, "utf-8");

        const result = await loadProjectManifest(manifestPath);

        expect(result.profiles).toHaveLength(1);
        expect(result.profiles?.[0]?.source).toBe("github:my-org/my-profile");
        expect(result.profiles?.[0]?.version).toBe("1.0.0");
        expect(result.variables?.TEAM_NAME).toBe("Engineering");

        await rm(tmpDir, { recursive: true });
    });

    it("should throw FileNotFoundError when file doesn't exist", async () => {
        await expect(loadProjectManifest("/nonexistent/path/baton.yaml")).rejects.toThrow(
            FileNotFoundError,
        );
    });

    it("should throw ManifestValidationError on invalid project manifest", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "baton-test-"));
        const manifestPath = join(tmpDir, "invalid.yaml");

        const invalidManifest = `
profiles:
  - invalid: structure
`;

        await writeFile(manifestPath, invalidManifest, "utf-8");

        await expect(loadProjectManifest(manifestPath)).rejects.toThrow(ManifestValidationError);

        await rm(tmpDir, { recursive: true });
    });
});

describe("loadLockfile", () => {
    it("should load and validate a valid lockfile", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "baton-test-"));
        const lockfilePath = join(tmpDir, "baton.lock");

        const validLockfile = `
locked_at: "2025-02-13T12:00:00.000Z"
packages:
  my-profile:
    source: github:my-org/my-profile
    resolved: https://github.com/my-org/my-profile.git
    version: 1.0.0
    sha: abc123
    integrity:
      baton.profile.yaml: sha256-xyz789
`;

        await writeFile(lockfilePath, validLockfile, "utf-8");

        const result = await loadLockfile(lockfilePath);

        expect(result.locked_at).toBe("2025-02-13T12:00:00.000Z");
        expect(result.packages).toHaveProperty("my-profile");
        expect(result.packages?.["my-profile"]?.source).toBe("github:my-org/my-profile");
        expect(result.packages?.["my-profile"]?.sha).toBe("abc123");

        await rm(tmpDir, { recursive: true });
    });

    it("should throw FileNotFoundError when file doesn't exist", async () => {
        await expect(loadLockfile("/nonexistent/path/baton.lock")).rejects.toThrow(
            FileNotFoundError,
        );
    });

    it("should throw ManifestValidationError on invalid lockfile", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "baton-test-"));
        const lockfilePath = join(tmpDir, "invalid.lock");

        const invalidLockfile = `
locked_at: invalid-date
packages: {}
`;

        await writeFile(lockfilePath, invalidLockfile, "utf-8");

        await expect(loadLockfile(lockfilePath)).rejects.toThrow(ManifestValidationError);

        await rm(tmpDir, { recursive: true });
    });
});
