import { describe, expect, it } from "vitest";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import { mergeSkills, mergeSkillsWithWarnings } from "./skills.js";
import { sortProfilesByWeight } from "./weight-sort.js";

describe("mergeSkills", () => {
  it("returns empty array when no profiles have skills", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toEqual([]);
  });

  it("returns skills from single profile", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            skills: [
              { name: "code-review", scope: "project" },
              { name: "test-gen", scope: "project" },
            ],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "code-review", scope: "project", profileName: "base" });
    expect(result[1]).toEqual({ name: "test-gen", scope: "project", profileName: "base" });
  });

  it("collects skills from multiple profiles additively", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
      {
        name: "child",
        source: "github:org/child",
        manifest: {
          name: "child",
          version: "1.0.0",
          ai: {
            skills: [{ name: "test-gen", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toContain("code-review");
    expect(result.map((s) => s.name)).toContain("test-gen");
  });

  it("replaces entire skill when same name appears in child profile", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review", scope: "global" }],
          },
        } as ProfileManifest,
      },
      {
        name: "child",
        source: "github:org/child",
        manifest: {
          name: "child",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "code-review", scope: "project", profileName: "child" });
  });

  it("last profile wins when multiple profiles define same skill", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review", scope: "global" }],
          },
        } as ProfileManifest,
      },
      {
        name: "middle",
        source: "github:org/middle",
        manifest: {
          name: "middle",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
      {
        name: "top",
        source: "github:org/top",
        manifest: {
          name: "top",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(1);
    // Top profile wins (most specific)
    expect(result[0]).toEqual({ name: "code-review", scope: "project", profileName: "top" });
  });

  it("deduplicates skills by name across multiple profiles", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            skills: [
              { name: "code-review", scope: "project" },
              { name: "test-gen", scope: "project" },
            ],
          },
        } as ProfileManifest,
      },
      {
        name: "child",
        source: "github:org/child",
        manifest: {
          name: "child",
          version: "1.0.0",
          ai: {
            skills: [
              { name: "code-review", scope: "global" }, // Overrides base
              { name: "pr-summary", scope: "project" }, // New skill
            ],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(3);
    expect(result.map((s) => s.name)).toContain("code-review");
    expect(result.map((s) => s.name)).toContain("test-gen");
    expect(result.map((s) => s.name)).toContain("pr-summary");

    // code-review should be from child (last wins)
    const codeReview = result.find((s) => s.name === "code-review");
    expect(codeReview?.scope).toBe("global");
  });

  it("handles profiles without ai section", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
        } as ProfileManifest,
      },
      {
        name: "child",
        source: "github:org/child",
        manifest: {
          name: "child",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "code-review", scope: "project", profileName: "child" });
  });

  it("higher-weight profile wins on skill name conflict when pre-sorted by weight", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "high-weight",
        source: "github:org/high",
        manifest: {
          name: "high-weight",
          version: "1.0.0",
          weight: 10,
          ai: {
            skills: [{ name: "code-review", scope: "global" }],
          },
        } as ProfileManifest,
      },
      {
        name: "low-weight",
        source: "github:org/low",
        manifest: {
          name: "low-weight",
          version: "1.0.0",
          weight: 1,
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    // Sort by weight first, then merge — higher weight wins
    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkills(sorted);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "code-review",
      scope: "global",
      profileName: "high-weight",
    });
  });

  it("same-weight profiles preserve declaration order (last declared wins)", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "first",
        source: "github:org/first",
        manifest: {
          name: "first",
          version: "1.0.0",
          weight: 5,
          ai: {
            skills: [{ name: "deploy", scope: "global" }],
          },
        } as ProfileManifest,
      },
      {
        name: "second",
        source: "github:org/second",
        manifest: {
          name: "second",
          version: "1.0.0",
          weight: 5,
          ai: {
            skills: [{ name: "deploy", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkills(sorted);

    expect(result).toHaveLength(1);
    // Same weight → stable sort → "second" declared later → wins
    expect(result[0].profileName).toBe("second");
  });

  it("default-weight profile loses to explicit higher-weight profile regardless of order", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "default-weight",
        source: "github:org/default",
        manifest: {
          name: "default-weight",
          version: "1.0.0",
          ai: {
            skills: [{ name: "lint", scope: "project" }],
          },
        } as ProfileManifest,
      },
      {
        name: "prioritized",
        source: "github:org/prio",
        manifest: {
          name: "prioritized",
          version: "1.0.0",
          weight: 3,
          ai: {
            skills: [{ name: "lint", scope: "global" }],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkills(sorted);

    expect(result).toHaveLength(1);
    expect(result[0].profileName).toBe("prioritized");
    expect(result[0].scope).toBe("global");
  });

  it("locked profile (weight -1) skill cannot be overridden by higher-weight profile", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "locked",
        source: "github:org/locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            skills: [{ name: "code-review", scope: "global" }],
          },
        } as ProfileManifest,
      },
      {
        name: "high-weight",
        source: "github:org/high",
        manifest: {
          name: "high-weight",
          version: "1.0.0",
          weight: 100,
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkills(sorted);

    expect(result).toHaveLength(1);
    // Locked profile wins, even though high-weight comes later
    expect(result[0].profileName).toBe("locked");
    expect(result[0].scope).toBe("global");
  });

  it("locked profile skill is preserved regardless of declaration order", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "normal",
        source: "github:org/normal",
        manifest: {
          name: "normal",
          version: "1.0.0",
          weight: 50,
          ai: {
            skills: [{ name: "deploy", scope: "project" }],
          },
        } as ProfileManifest,
      },
      {
        name: "locked",
        source: "github:org/locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            skills: [{ name: "deploy", scope: "global" }],
          },
        } as ProfileManifest,
      },
    ];

    // After sorting: locked (weight -1) first, then normal (weight 50)
    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkills(sorted);

    expect(result).toHaveLength(1);
    expect(result[0].profileName).toBe("locked");
    expect(result[0].scope).toBe("global");
  });

  it("non-conflicting skills from locked and normal profiles both appear", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "locked",
        source: "github:org/locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            skills: [{ name: "code-review", scope: "global" }],
          },
        } as ProfileManifest,
      },
      {
        name: "normal",
        source: "github:org/normal",
        manifest: {
          name: "normal",
          version: "1.0.0",
          ai: {
            skills: [{ name: "test-gen", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkills(sorted);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toContain("code-review");
    expect(result.map((s) => s.name)).toContain("test-gen");
  });

  it("emits warning when same-weight profiles define the same skill", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "team-a",
        source: "github:org/team-a",
        manifest: {
          name: "team-a",
          version: "1.0.0",
          weight: 5,
          ai: {
            skills: [{ name: "code-review", scope: "global" }],
          },
        } as ProfileManifest,
      },
      {
        name: "team-b",
        source: "github:org/team-b",
        manifest: {
          name: "team-b",
          version: "1.0.0",
          weight: 5,
          ai: {
            skills: [{ name: "code-review", scope: "project" }],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkillsWithWarnings(sorted);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toEqual({
      key: "code-review",
      category: "skill",
      profileA: "team-a",
      profileB: "team-b",
      weight: 5,
    });
    // Last declared still wins
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].profileName).toBe("team-b");
  });

  it("no warning when different-weight profiles define the same skill", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "low",
        source: "github:org/low",
        manifest: {
          name: "low",
          version: "1.0.0",
          weight: 1,
          ai: {
            skills: [{ name: "lint", scope: "project" }],
          },
        } as ProfileManifest,
      },
      {
        name: "high",
        source: "github:org/high",
        manifest: {
          name: "high",
          version: "1.0.0",
          weight: 10,
          ai: {
            skills: [{ name: "lint", scope: "global" }],
          },
        } as ProfileManifest,
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeSkillsWithWarnings(sorted);

    expect(result.warnings).toHaveLength(0);
  });

  it("skill without scope inherits profile scope", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "global-profile",
        source: "github:org/global",
        manifest: {
          name: "global-profile",
          version: "1.0.0",
          scope: "global",
          ai: {
            skills: [{ name: "code-review" }],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "code-review",
      scope: "global",
      profileName: "global-profile",
    });
  });

  it("skill without scope and no profile scope defaults to 'project'", () => {
    const profiles: ResolvedProfile[] = [
      {
        name: "base",
        source: "github:org/base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            skills: [{ name: "code-review" }],
          },
        } as ProfileManifest,
      },
    ];

    const result = mergeSkills(profiles);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "code-review",
      scope: "project",
      profileName: "base",
    });
  });
});
