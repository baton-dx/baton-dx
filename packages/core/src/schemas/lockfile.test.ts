import { describe, expect, it } from "vitest";
import { lockfileSchema } from "./lockfile.js";

describe("Schema Validation - Lockfile", () => {
  describe("baton_version field", () => {
    it("is optional — lockfiles without baton_version are valid (backward-compat)", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.baton_version).toBeUndefined();
      }
    });

    it("accepts a semver string when present", () => {
      const result = lockfileSchema.safeParse({
        baton_version: "1.4.2",
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.baton_version).toBe("1.4.2");
      }
    });
  });

  describe("Valid lockfiles", () => {
    it("validates lockfile with one package (legacy string integrity)", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123def456",
            integrity: {
              "baton.profile.yaml": "sha256-hash1",
              "ai/memory/CLAUDE.md": "sha256-hash2",
            },
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Legacy strings are transformed to FileMetadata objects
        const integrity = result.data.packages["org/profile"].integrity;
        expect(integrity["baton.profile.yaml"].hash).toBe("sha256-hash1");
        expect(integrity["baton.profile.yaml"].tool).toBeUndefined();
        expect(integrity["baton.profile.yaml"].category).toBeUndefined();
      }
    });

    it("validates lockfile with FileMetadata integrity entries", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123def456",
            integrity: {
              ".claude/CLAUDE.md": {
                hash: "sha256-hash1",
                tool: "claude-code",
                category: "ai",
              },
              ".vscode/settings.json": {
                hash: "sha256-hash2",
                tool: "vscode",
                category: "ide",
              },
              Makefile: {
                hash: "sha256-hash3",
                category: "files",
              },
            },
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const integrity = result.data.packages["org/profile"].integrity;
        expect(integrity[".claude/CLAUDE.md"].hash).toBe("sha256-hash1");
        expect(integrity[".claude/CLAUDE.md"].tool).toBe("claude-code");
        expect(integrity[".claude/CLAUDE.md"].category).toBe("ai");
        expect(integrity[".vscode/settings.json"].tool).toBe("vscode");
        expect(integrity[".vscode/settings.json"].category).toBe("ide");
        expect(integrity.Makefile.tool).toBeUndefined();
        expect(integrity.Makefile.category).toBe("files");
      }
    });

    it("validates lockfile with mixed integrity formats (backward compat)", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "legacy-file.md": "plain-hash-string",
              ".claude/CLAUDE.md": {
                hash: "sha256-hash1",
                tool: "claude-code",
                category: "ai",
              },
            },
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const integrity = result.data.packages["org/profile"].integrity;
        // Legacy string transformed to object
        expect(integrity["legacy-file.md"].hash).toBe("plain-hash-string");
        expect(integrity["legacy-file.md"].tool).toBeUndefined();
        // New format preserved
        expect(integrity[".claude/CLAUDE.md"].tool).toBe("claude-code");
      }
    });

    it("validates lockfile with multiple packages", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "baton.profile.yaml": "sha256-hash1",
            },
          },
          "local/skill": {
            source: "./local/skill",
            resolved: "/absolute/path/to/skill",
            version: "0.1.0",
            sha: "",
            integrity: {
              "SKILL.md": "sha256-hash2",
            },
          },
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates lockfile with empty integrity", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Invalid lockfiles", () => {
    it("rejects missing locked_at", () => {
      const result = lockfileSchema.safeParse({
        packages: {},
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("locked_at");
      }
    });

    it("rejects invalid ISO 8601 datetime", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "not-a-datetime",
        packages: {},
      });

      expect(result.success).toBe(false);
    });

    it("rejects datetime without milliseconds", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45Z",
        packages: {},
      });

      expect(result.success).toBe(false);
    });

    it("rejects missing packages", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("packages");
      }
    });

    it("rejects package without source", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      });

      expect(result.success).toBe(false);
    });

    it("provides error path for nested invalid fields", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: 123,
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {},
          },
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPath = result.error.issues[0].path.join(".");
        expect(errorPath).toContain("packages");
      }
    });

    it("rejects invalid category value in FileMetadata", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              "file.md": {
                hash: "sha256-hash",
                tool: "claude-code",
                category: "invalid-category",
              },
            },
          },
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Tool annotation queries", () => {
    it("allows filtering files by tool from parsed lockfile", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              ".claude/CLAUDE.md": { hash: "h1", tool: "claude-code", category: "ai" },
              ".cursor/rules/main.md": { hash: "h2", tool: "cursor", category: "ai" },
              ".vscode/settings.json": { hash: "h3", tool: "vscode", category: "ide" },
              Makefile: { hash: "h4", category: "files" },
            },
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const integrity = result.data.packages["org/profile"].integrity;
        const entries = Object.entries(integrity);

        // Filter by tool
        const claudeFiles = entries.filter(([, meta]) => meta.tool === "claude-code");
        expect(claudeFiles).toHaveLength(1);
        expect(claudeFiles[0][0]).toBe(".claude/CLAUDE.md");

        // Filter by category
        const aiFiles = entries.filter(([, meta]) => meta.category === "ai");
        expect(aiFiles).toHaveLength(2);

        // Files without tool annotation
        const noToolFiles = entries.filter(([, meta]) => !meta.tool);
        expect(noToolFiles).toHaveLength(1);
        expect(noToolFiles[0][0]).toBe("Makefile");
      }
    });

    it("identifies files for a deinstalled tool", () => {
      const result = lockfileSchema.safeParse({
        locked_at: "2025-02-13T10:30:45.123Z",
        packages: {
          "org/profile": {
            source: "github:org/profile",
            resolved: "https://github.com/org/profile.git",
            version: "1.0.0",
            sha: "abc123",
            integrity: {
              ".claude/CLAUDE.md": { hash: "h1", tool: "claude-code", category: "ai" },
              ".cursor/rules/main.md": { hash: "h2", tool: "cursor", category: "ai" },
              ".windsurf/rules/main.md": { hash: "h3", tool: "windsurf", category: "ai" },
            },
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const integrity = result.data.packages["org/profile"].integrity;
        const entries = Object.entries(integrity);

        // Simulate: developer removes "windsurf" from their tools
        const configuredTools = ["claude-code", "cursor"];
        const orphanedByTool = entries.filter(
          ([, meta]) => meta.tool && !configuredTools.includes(meta.tool),
        );

        expect(orphanedByTool).toHaveLength(1);
        expect(orphanedByTool[0][0]).toBe(".windsurf/rules/main.md");
      }
    });
  });
});
