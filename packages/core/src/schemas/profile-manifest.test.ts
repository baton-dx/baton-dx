import { describe, expect, it } from "vitest";
import { mergeStrategySchema, profileManifestSchema, scopeSchema } from "./profile-manifest.js";

describe("Schema Validation - Profile Manifest", () => {
  describe("Valid manifests", () => {
    it("validates minimal profile manifest", () => {
      const result = profileManifestSchema.safeParse({
        name: "minimal-profile",
        version: "1.0.0",
      });

      expect(result.success).toBe(true);
    });

    it("validates full profile manifest with all sections", () => {
      const result = profileManifestSchema.safeParse({
        name: "full-profile",
        version: "2.3.5",
        description: "Complete profile with all sections",
        extends: "base-profile",
        ai: {
          tools: ["claude-code", "cursor"],
          skills: [{ name: "code-review", scope: "project" }],
          agents: ["code-reviewer", "test-writer"],
          rules: {
            universal: ["coding-standards"],
            cursor: ["code-style"],
          },
          memory: [
            { source: "CLAUDE.md", merge: "append" },
            { source: "AGENTS.md", merge: "prepend" },
          ],
          commands: ["review", "test"],
        },
        files: [{ source: "biome.json" }],
        ide: {
          vscode: [".vscode/settings.json"],
          jetbrains: [".idea/settings.xml"],
        },
        variables: {
          PROJECT_NAME: "my-project",
          TEAM: "frontend",
        },
        hooks: {
          "post-install": "echo 'Installed'",
          "post-update": "echo 'Updated'",
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates rules as array (universal format)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          rules: ["rule1", "rule2", "rule3"],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates rules as object (agent-specific format)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          rules: {
            universal: ["rule1"],
            "claude-code": ["rule2"],
            cursor: ["rule3"],
          },
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Invalid manifests", () => {
    it("rejects missing name", () => {
      const result = profileManifestSchema.safeParse({
        version: "1.0.0",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("name");
      }
    });

    it("rejects non-kebab-case profile names", () => {
      const invalidNames = [
        "MyProfile",
        "my_profile",
        "my--profile",
        "-profile",
        "profile-",
        "UPPERCASE",
      ];
      for (const name of invalidNames) {
        const result = profileManifestSchema.safeParse({
          name,
          version: "1.0.0",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("kebab-case");
        }
      }
    });

    it("accepts valid kebab-case profile names", () => {
      const validNames = [
        "test",
        "my-profile",
        "frontend",
        "team-dx-standards",
        "a1",
        "abc-123-xyz",
        "3d",
        "123-profile",
        "3d-web",
      ];
      for (const name of validNames) {
        const result = profileManifestSchema.safeParse({
          name,
          version: "1.0.0",
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects missing version", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("version");
      }
    });

    it("rejects invalid semver version", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "not-a-version",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("semver");
      }
    });

    it("rejects version without patch", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0",
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid merge strategy", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ai: {
          memory: [{ source: "CLAUDE.md", merge: "invalid-strategy" }],
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.issues[0].message;
        // Zod enum error contains "Invalid enum value"
        expect(errorMessage).toContain("Invalid enum value");
      }
    });

    it("rejects invalid scope", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ai: {
          skills: [{ name: "skill1", scope: "invalid" }],
        },
      });

      expect(result.success).toBe(false);
    });

    it("provides error path for nested invalid fields", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ai: {
          skills: [{ name: 123, scope: "project" }],
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPath = result.error.issues[0].path.join(".");
        expect(errorPath).toContain("ai");
        expect(errorPath).toContain("skills");
      }
    });
  });

  describe("Weight property", () => {
    it("accepts profile with weight 0 (default)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        weight: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBe(0);
      }
    });

    it("accepts profile with positive weight", () => {
      const result = profileManifestSchema.safeParse({
        name: "high-priority",
        version: "1.0.0",
        weight: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBe(10);
      }
    });

    it("accepts profile with weight -1 (lock)", () => {
      const result = profileManifestSchema.safeParse({
        name: "locked-profile",
        version: "1.0.0",
        weight: -1,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBe(-1);
      }
    });

    it("accepts profile without weight (optional)", () => {
      const result = profileManifestSchema.safeParse({
        name: "no-weight",
        version: "1.0.0",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBeUndefined();
      }
    });

    it("rejects weight less than -1", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        weight: -2,
      });

      expect(result.success).toBe(false);
    });

    it("rejects non-integer weight", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        weight: 1.5,
      });

      expect(result.success).toBe(false);
    });

    it("has no upper limit for positive weight", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        weight: 9999,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBe(9999);
      }
    });
  });

  describe("IDE section (flexible schema)", () => {
    it("validates ide with vscode and jetbrains (backward compatible)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ide: {
          vscode: ["settings.json", "extensions.json"],
          jetbrains: ["settings.xml"],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates ide with arbitrary platform keys", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ide: {
          vscode: ["settings.json"],
          zed: ["settings.json"],
          fleet: ["config.xml"],
          cursor: ["settings.json"],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates empty ide section", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ide: {},
      });

      expect(result.success).toBe(true);
    });

    it("rejects ide with non-array values", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ide: {
          vscode: "settings.json",
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Agents in AI section", () => {
    it("validates agents as array (universal format)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          agents: ["code-reviewer", "test-writer"],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates agents as object (tool-specific format)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          agents: {
            universal: ["shared-agent"],
            "claude-code": ["claude-only"],
            cursor: ["cursor-only"],
          },
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates agents with mixed keys including optional arrays", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          agents: {
            universal: ["shared"],
            "claude-code": undefined,
          },
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates empty agents array", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          agents: [],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates missing agents field (optional)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          tools: ["claude-code"],
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ai?.agents).toBeUndefined();
      }
    });

    it("rejects agents with non-string array items", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          agents: [123, true],
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects agents with nested objects as values", () => {
      const result = profileManifestSchema.safeParse({
        name: "test-profile",
        version: "1.0.0",
        ai: {
          agents: {
            universal: [{ name: "invalid" }],
          },
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Scope property", () => {
    it("validates profile manifest with scope field", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        scope: "project",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scope).toBe("project");
      }
    });

    it("validates profile manifest with scope 'global'", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        scope: "global",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scope).toBe("global");
      }
    });

    it("validates profile manifest without scope (optional)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scope).toBeUndefined();
      }
    });

    it("validates memory item with scope field", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ai: {
          memory: [{ source: "CLAUDE.md", merge: "append", scope: "global" }],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates memory item without scope (optional)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ai: {
          memory: [{ source: "CLAUDE.md", merge: "append" }],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates skill item without scope (now optional)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ai: {
          skills: [{ name: "code-review" }],
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates skill item with scope (still accepted)", () => {
      const result = profileManifestSchema.safeParse({
        name: "test",
        version: "1.0.0",
        ai: {
          skills: [{ name: "code-review", scope: "project" }],
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Schema types", () => {
    it("validates scope schema with project and global", () => {
      expect(scopeSchema.safeParse("project").success).toBe(true);
      expect(scopeSchema.safeParse("global").success).toBe(true);
      expect(scopeSchema.safeParse("invalid").success).toBe(false);
    });

    it("validates merge strategy schema with all strategies", () => {
      const strategies = [
        "replace",
        "deep",
        "append",
        "prepend",
        "skip",
        "prompt",
        "directory",
        "import",
      ];

      for (const strategy of strategies) {
        expect(mergeStrategySchema.safeParse(strategy).success).toBe(true);
      }
    });
  });
});
