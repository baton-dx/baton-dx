import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import { mergeRules, mergeRulesWithWarnings } from "./rules.js";
import { sortProfilesByWeight } from "./weight-sort.js";

describe("mergeRules", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "baton-rules-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("merges universal rules from array format", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: ["coding-standards.md", "security.md"],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      name: "coding-standards.md",
      agents: [],
      profileName: "base",
    });
    expect(result).toContainEqual({
      name: "security.md",
      agents: [],
      profileName: "base",
    });
  });

  test("merges agent-specific rules from object format", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: {
              "claude-code": ["code-review.md"],
              cursor: ["cursor-style.mdc"],
            },
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      name: "code-review.md",
      agents: ["claude-code"],
      profileName: "base",
    });
    expect(result).toContainEqual({
      name: "cursor-style.mdc",
      agents: ["cursor"],
      profileName: "base",
    });
  });

  test("merges universal rules from object format", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: {
              universal: ["coding-standards.md", "security.md"],
            },
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      name: "coding-standards.md",
      agents: [],
      profileName: "base",
    });
    expect(result).toContainEqual({
      name: "security.md",
      agents: [],
      profileName: "base",
    });
  });

  test("combines rules from multiple profiles additively", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: ["base-rule.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./override",
        name: "override",
        manifest: {
          name: "override",
          version: "1.0.0",
          ai: {
            rules: ["override-rule.md"],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      name: "base-rule.md",
      agents: [],
      profileName: "base",
    });
    expect(result).toContainEqual({
      name: "override-rule.md",
      agents: [],
      profileName: "override",
    });
  });

  test("more specific profile wins on name conflict (universal rules)", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: ["coding-standards.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./override",
        name: "override",
        manifest: {
          name: "override",
          version: "1.0.0",
          ai: {
            rules: ["coding-standards.md"], // Same name, should override
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    // Only one rule with this name should exist (last wins)
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("coding-standards.md");
    expect(result[0].agents).toEqual([]);
  });

  test("more specific profile wins on name conflict (agent-specific rules)", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: {
              cursor: ["style.mdc"],
            },
          },
        } as ProfileManifest,
      },
      {
        source: "./override",
        name: "override",
        manifest: {
          name: "override",
          version: "1.0.0",
          ai: {
            rules: {
              cursor: ["style.mdc"], // Same agent and name, should override
            },
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    // Only one cursor:style.mdc should exist
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("style.mdc");
    expect(result[0].agents).toEqual(["cursor"]);
  });

  test("preserves subdirectory structure in rule names", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: ["frontend/react.md", "backend/api.md"],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(2);
    expect(result.some((r) => r.name === "frontend/react.md")).toBe(true);
    expect(result.some((r) => r.name === "backend/api.md")).toBe(true);
  });

  test("allows same rule name for different agents", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: {
              "claude-code": ["code-style.md"],
              cursor: ["code-style.md"],
              universal: ["code-style.md"],
            },
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    // Three different rules with same name but different agent scopes
    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.name === "code-style.md")).toHaveLength(3);
  });

  test("handles profiles without rules section", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            skills: [{ name: "test", scope: "project" }],
            // No rules
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(0);
  });

  test("handles profiles without ai section", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          // No ai section
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(0);
  });

  test("handles empty rules array", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: [],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(0);
  });

  test("handles empty rules object", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: {},
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(0);
  });

  test("combines array and object format rules", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            rules: ["universal-rule.md"], // Array format
          },
        } as ProfileManifest,
      },
      {
        source: "./override",
        name: "override",
        manifest: {
          name: "override",
          version: "1.0.0",
          ai: {
            rules: {
              // Object format
              cursor: ["cursor-rule.mdc"],
            },
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeRules(profiles);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      name: "universal-rule.md",
      agents: [],
      profileName: "base",
    });
    expect(result).toContainEqual({
      name: "cursor-rule.mdc",
      agents: ["cursor"],
      profileName: "override",
    });
  });

  test("higher-weight profile wins on rule key conflict when pre-sorted by weight", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./high",
        name: "high-weight",
        manifest: {
          name: "high-weight",
          version: "1.0.0",
          weight: 10,
          ai: {
            rules: ["coding-standards.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./low",
        name: "low-weight",
        manifest: {
          name: "low-weight",
          version: "1.0.0",
          weight: 1,
          ai: {
            rules: ["coding-standards.md"],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRules(sorted);

    expect(result).toHaveLength(1);
    expect(result[0].profileName).toBe("high-weight");
  });

  test("higher-weight profile wins agent-specific rule conflicts", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./low",
        name: "low-weight",
        manifest: {
          name: "low-weight",
          version: "1.0.0",
          weight: 1,
          ai: {
            rules: {
              cursor: ["style.mdc"],
            },
          },
        } as ProfileManifest,
      },
      {
        source: "./high",
        name: "high-weight",
        manifest: {
          name: "high-weight",
          version: "1.0.0",
          weight: 10,
          ai: {
            rules: {
              cursor: ["style.mdc"],
            },
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRules(sorted);

    expect(result).toHaveLength(1);
    expect(result[0].profileName).toBe("high-weight");
  });

  test("default-weight profile loses to higher-weight profile regardless of declaration order", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./default",
        name: "default-weight",
        manifest: {
          name: "default-weight",
          version: "1.0.0",
          ai: {
            rules: ["security.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./prio",
        name: "prioritized",
        manifest: {
          name: "prioritized",
          version: "1.0.0",
          weight: 5,
          ai: {
            rules: ["security.md"],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRules(sorted);

    expect(result).toHaveLength(1);
    expect(result[0].profileName).toBe("prioritized");
  });

  test("locked profile (weight -1) rule cannot be overridden by higher-weight profile", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./locked",
        name: "locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            rules: ["coding-standards.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./high",
        name: "high-weight",
        manifest: {
          name: "high-weight",
          version: "1.0.0",
          weight: 100,
          ai: {
            rules: ["coding-standards.md"],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRules(sorted);

    expect(result).toHaveLength(1);
    expect(result[0].profileName).toBe("locked");
  });

  test("locked profile agent-specific rule cannot be overridden", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./locked",
        name: "locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            rules: {
              cursor: ["style.mdc"],
            },
          },
        } as ProfileManifest,
      },
      {
        source: "./override",
        name: "override",
        manifest: {
          name: "override",
          version: "1.0.0",
          weight: 50,
          ai: {
            rules: {
              cursor: ["style.mdc"],
            },
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRules(sorted);

    expect(result).toHaveLength(1);
    expect(result[0].profileName).toBe("locked");
  });

  test("non-conflicting rules from locked and normal profiles both appear", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./locked",
        name: "locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            rules: ["security.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./normal",
        name: "normal",
        manifest: {
          name: "normal",
          version: "1.0.0",
          ai: {
            rules: ["formatting.md"],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRules(sorted);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toContain("security.md");
    expect(result.map((r) => r.name)).toContain("formatting.md");
  });

  test("emits warning when same-weight profiles define the same rule", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./team-a",
        name: "team-a",
        manifest: {
          name: "team-a",
          version: "1.0.0",
          weight: 5,
          ai: {
            rules: ["coding-standards.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./team-b",
        name: "team-b",
        manifest: {
          name: "team-b",
          version: "1.0.0",
          weight: 5,
          ai: {
            rules: ["coding-standards.md"],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRulesWithWarnings(sorted);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].key).toBe("coding-standards.md");
    expect(result.warnings[0].category).toBe("rule");
    expect(result.warnings[0].profileA).toBe("team-a");
    expect(result.warnings[0].profileB).toBe("team-b");
    expect(result.warnings[0].weight).toBe(5);
  });

  test("no warning when different-weight profiles define the same rule", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "./low",
        name: "low",
        manifest: {
          name: "low",
          version: "1.0.0",
          weight: 1,
          ai: {
            rules: ["security.md"],
          },
        } as ProfileManifest,
      },
      {
        source: "./high",
        name: "high",
        manifest: {
          name: "high",
          version: "1.0.0",
          weight: 10,
          ai: {
            rules: ["security.md"],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeRulesWithWarnings(sorted);

    expect(result.warnings).toHaveLength(0);
  });
});
