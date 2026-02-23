import { describe, expect, it } from "vitest";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import { mergeMemory, mergeMemoryWithWarnings } from "./memory.js";
import { sortProfilesByWeight } from "./weight-sort.js";

describe("mergeMemory", () => {
  it("returns empty array when no profiles have memory", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toEqual([]);
  });

  it("returns memory entries from single profile", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            memory: [
              { source: "CLAUDE.md", merge: "append" },
              { source: "AGENTS.md", merge: "replace" },
            ],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          filename: "CLAUDE.md",
          mergeStrategy: "append",
          scope: "project",
          contributions: [{ profileName: "base", mergeStrategy: "append" }],
        },
        {
          filename: "AGENTS.md",
          mergeStrategy: "replace",
          scope: "project",
          contributions: [{ profileName: "base", mergeStrategy: "replace" }],
        },
      ]),
    );
  });

  it("merges memory files from multiple profiles with different filenames", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "github:org/base",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
      {
        source: "github:org/child",
        name: "child",
        manifest: {
          name: "child",
          version: "1.0.0",
          ai: {
            memory: [{ source: "AGENTS.md", merge: "prepend" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          filename: "CLAUDE.md",
          mergeStrategy: "append",
          scope: "project",
          contributions: [{ profileName: "base", mergeStrategy: "append" }],
        },
        {
          filename: "AGENTS.md",
          mergeStrategy: "prepend",
          scope: "project",
          contributions: [{ profileName: "child", mergeStrategy: "prepend" }],
        },
      ]),
    );
  });

  it("collects all contributions when same file appears in multiple profiles", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "override",
        manifest: {
          name: "override",
          version: "1.0.0",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "import" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      filename: "CLAUDE.md",
      mergeStrategy: "import", // most-specific profile wins
      scope: "project",
      contributions: [
        { profileName: "base", mergeStrategy: "append" },
        { profileName: "override", mergeStrategy: "import" },
      ],
    });
  });

  it("handles all merge strategies", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "all-strategies",
        manifest: {
          name: "all-strategies",
          version: "1.0.0",
          ai: {
            memory: [
              { source: "file1.md", merge: "replace" },
              { source: "file2.md", merge: "deep" },
              { source: "file3.md", merge: "append" },
              { source: "file4.md", merge: "prepend" },
              { source: "file5.md", merge: "skip" },
              { source: "file6.md", merge: "prompt" },
              { source: "file7.md", merge: "directory" },
              { source: "file8.md", merge: "import" },
            ],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(8);

    const strategies = result.map((entry) => entry.mergeStrategy);
    expect(strategies).toEqual(
      expect.arrayContaining([
        "replace",
        "deep",
        "append",
        "prepend",
        "skip",
        "prompt",
        "directory",
        "import",
      ]),
    );
  });

  it("handles three-level inheritance chain with different filenames", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "middle",
        manifest: {
          name: "middle",
          version: "1.0.0",
          ai: {
            memory: [{ source: "AGENTS.md", merge: "prepend" }],
          },
        },
      },
      {
        source: "local",
        name: "leaf",
        manifest: {
          name: "leaf",
          version: "1.0.0",
          ai: {
            memory: [{ source: "GEMINI.md", merge: "replace" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          filename: "CLAUDE.md",
          mergeStrategy: "append",
          scope: "project",
          contributions: [{ profileName: "base", mergeStrategy: "append" }],
        },
        {
          filename: "AGENTS.md",
          mergeStrategy: "prepend",
          scope: "project",
          contributions: [{ profileName: "middle", mergeStrategy: "prepend" }],
        },
        {
          filename: "GEMINI.md",
          mergeStrategy: "replace",
          scope: "project",
          contributions: [{ profileName: "leaf", mergeStrategy: "replace" }],
        },
      ]),
    );
  });

  it("preserves profile name for attribution in contributions", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "github:company/standards",
        name: "company-standards",
        manifest: {
          name: "company-standards",
          version: "2.0.0",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result[0].contributions[0].profileName).toBe("company-standards");
  });

  it("handles profile with empty memory array", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            memory: [],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toEqual([]);
  });

  it("handles profiles with and without memory sections", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "no-memory",
        manifest: {
          name: "no-memory",
          version: "1.0.0",
        },
      },
      {
        source: "local",
        name: "with-memory",
        manifest: {
          name: "with-memory",
          version: "1.0.0",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "no-ai-section",
        manifest: {
          name: "no-ai-section",
          version: "1.0.0",
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      filename: "CLAUDE.md",
      mergeStrategy: "append",
      scope: "project",
      contributions: [{ profileName: "with-memory", mergeStrategy: "append" }],
    });
  });

  it("collects contributions and uses most-specific strategy for overrides", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "parent",
        manifest: {
          name: "parent",
          version: "1.0.0",
          ai: {
            memory: [
              { source: "CLAUDE.md", merge: "append" },
              { source: "AGENTS.md", merge: "replace" },
            ],
          },
        },
      },
      {
        source: "local",
        name: "child",
        manifest: {
          name: "child",
          version: "1.0.0",
          ai: {
            memory: [
              { source: "CLAUDE.md", merge: "import" }, // Override parent's strategy
            ],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(2);

    const claudeEntry = result.find((e) => e.filename === "CLAUDE.md");
    expect(claudeEntry).toEqual({
      filename: "CLAUDE.md",
      mergeStrategy: "import", // child's strategy wins
      scope: "project",
      contributions: [
        { profileName: "parent", mergeStrategy: "append" },
        { profileName: "child", mergeStrategy: "import" },
      ],
    });

    const agentsEntry = result.find((e) => e.filename === "AGENTS.md");
    expect(agentsEntry).toEqual({
      filename: "AGENTS.md",
      mergeStrategy: "replace",
      scope: "project",
      contributions: [{ profileName: "parent", mergeStrategy: "replace" }],
    });
  });

  it("collects three profiles contributing to the same file", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            memory: [{ source: "MEMORY.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "middle",
        manifest: {
          name: "middle",
          version: "1.0.0",
          ai: {
            memory: [{ source: "MEMORY.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "top",
        manifest: {
          name: "top",
          version: "1.0.0",
          ai: {
            memory: [{ source: "MEMORY.md", merge: "append" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      filename: "MEMORY.md",
      mergeStrategy: "append",
      scope: "project",
      contributions: [
        { profileName: "base", mergeStrategy: "append" },
        { profileName: "middle", mergeStrategy: "append" },
        { profileName: "top", mergeStrategy: "append" },
      ],
    });
  });

  it("higher-weight profile's merge strategy wins when pre-sorted by weight", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "high-weight",
        manifest: {
          name: "high-weight",
          version: "1.0.0",
          weight: 10,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "import" }],
          },
        },
      },
      {
        source: "local",
        name: "low-weight",
        manifest: {
          name: "low-weight",
          version: "1.0.0",
          weight: 1,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeMemory(sorted);

    expect(result).toHaveLength(1);
    // Higher weight appears last after sort → its strategy governs
    expect(result[0].mergeStrategy).toBe("import");
    expect(result[0].contributions).toHaveLength(2);
    // Contributions are in weight-sorted order: low first, high last
    expect(result[0].contributions[0].profileName).toBe("low-weight");
    expect(result[0].contributions[1].profileName).toBe("high-weight");
  });

  it("weight-sorted contributions preserve order for same-weight profiles", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "first",
        manifest: {
          name: "first",
          version: "1.0.0",
          weight: 0,
          ai: {
            memory: [{ source: "MEMORY.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "second",
        manifest: {
          name: "second",
          version: "1.0.0",
          weight: 0,
          ai: {
            memory: [{ source: "MEMORY.md", merge: "prepend" }],
          },
        },
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeMemory(sorted);

    expect(result).toHaveLength(1);
    // Same weight → stable sort → second declared later → its strategy wins
    expect(result[0].mergeStrategy).toBe("prepend");
    expect(result[0].contributions[0].profileName).toBe("first");
    expect(result[0].contributions[1].profileName).toBe("second");
  });

  it("locked profile (weight -1) merge strategy cannot be overridden", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "replace" }],
          },
        },
      },
      {
        source: "local",
        name: "high-weight",
        manifest: {
          name: "high-weight",
          version: "1.0.0",
          weight: 100,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeMemory(sorted);

    expect(result).toHaveLength(1);
    // Locked profile's strategy wins
    expect(result[0].mergeStrategy).toBe("replace");
    // Both profiles still contribute content
    expect(result[0].contributions).toHaveLength(2);
    expect(result[0].contributions[0].profileName).toBe("locked");
    expect(result[0].contributions[1].profileName).toBe("high-weight");
  });

  it("locked profile strategy is preserved with multiple overriding profiles", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "locked",
        manifest: {
          name: "locked",
          version: "1.0.0",
          weight: -1,
          ai: {
            memory: [{ source: "MEMORY.md", merge: "import" }],
          },
        },
      },
      {
        source: "local",
        name: "normal",
        manifest: {
          name: "normal",
          version: "1.0.0",
          weight: 0,
          ai: {
            memory: [{ source: "MEMORY.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "high",
        manifest: {
          name: "high",
          version: "1.0.0",
          weight: 50,
          ai: {
            memory: [{ source: "MEMORY.md", merge: "prepend" }],
          },
        },
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeMemory(sorted);

    expect(result).toHaveLength(1);
    // Locked profile's strategy governs
    expect(result[0].mergeStrategy).toBe("import");
    // All three profiles contribute
    expect(result[0].contributions).toHaveLength(3);
  });

  it("emits warning when same-weight profiles define the same memory file", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "team-a",
        manifest: {
          name: "team-a",
          version: "1.0.0",
          weight: 5,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "team-b",
        manifest: {
          name: "team-b",
          version: "1.0.0",
          weight: 5,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "replace" }],
          },
        },
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeMemoryWithWarnings(sorted);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toEqual({
      key: "CLAUDE.md",
      category: "memory",
      profileA: "team-a",
      profileB: "team-b",
      weight: 5,
    });
  });

  it("no warning when different-weight profiles define the same memory file", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "low",
        manifest: {
          name: "low",
          version: "1.0.0",
          weight: 1,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
      {
        source: "local",
        name: "high",
        manifest: {
          name: "high",
          version: "1.0.0",
          weight: 10,
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "replace" }],
          },
        },
      },
    ];

    const sorted = sortProfilesByWeight(profiles);
    const result = mergeMemoryWithWarnings(sorted);

    expect(result.warnings).toHaveLength(0);
  });

  it("memory item with scope 'global' gets scope 'global'", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append", scope: "global" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(1);
    expect(result[0].scope).toBe("global");
  });

  it("memory item scope overrides profile scope", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          scope: "global",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append", scope: "project" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(1);
    expect(result[0].scope).toBe("project");
  });

  it("memory inherits profile scope when item scope is not set", () => {
    const profiles: ResolvedProfile[] = [
      {
        source: "local",
        name: "base",
        manifest: {
          name: "base",
          version: "1.0.0",
          scope: "global",
          ai: {
            memory: [{ source: "CLAUDE.md", merge: "append" }],
          },
        },
      },
    ];

    const result = mergeMemory(profiles);
    expect(result).toHaveLength(1);
    expect(result[0].scope).toBe("global");
  });
});
