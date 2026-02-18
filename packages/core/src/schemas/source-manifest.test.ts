import { describe, expect, it } from "vitest";
import { sourceManifestSchema, sourceProfileEntrySchema, weightSchema } from "./source-manifest.js";

describe("sourceProfileEntrySchema", () => {
  it("validates valid profile entry", () => {
    const valid = {
      name: "frontend",
      path: "profiles/frontend",
      description: "Frontend profile",
    };

    const result = sourceProfileEntrySchema.parse(valid);
    expect(result).toEqual(valid);
  });

  it("validates profile entry without description", () => {
    const valid = {
      name: "backend",
      path: "profiles/backend",
    };

    const result = sourceProfileEntrySchema.parse(valid);
    expect(result).toEqual(valid);
  });

  it("rejects profile entry without name", () => {
    const invalid = {
      path: "profiles/default",
    };

    expect(() => sourceProfileEntrySchema.parse(invalid)).toThrow();
  });

  it("rejects profile entry without path", () => {
    const invalid = {
      name: "default",
    };

    expect(() => sourceProfileEntrySchema.parse(invalid)).toThrow();
  });

  it("validates profile entry with weight", () => {
    const valid = {
      name: "high-priority",
      path: "profiles/high-priority",
      weight: 10,
    };

    const result = sourceProfileEntrySchema.parse(valid);
    expect(result.weight).toBe(10);
  });

  it("validates profile entry without weight (optional)", () => {
    const valid = {
      name: "default",
      path: "profiles/default",
    };

    const result = sourceProfileEntrySchema.parse(valid);
    expect(result.weight).toBeUndefined();
  });

  it("validates profile entry with weight -1 (lock)", () => {
    const valid = {
      name: "locked",
      path: "profiles/locked",
      weight: -1,
    };

    const result = sourceProfileEntrySchema.parse(valid);
    expect(result.weight).toBe(-1);
  });

  it("validates profile entry with weight 0 (default)", () => {
    const valid = {
      name: "default",
      path: "profiles/default",
      weight: 0,
    };

    const result = sourceProfileEntrySchema.parse(valid);
    expect(result.weight).toBe(0);
  });
});

describe("weightSchema", () => {
  it("accepts 0 as default weight", () => {
    expect(weightSchema.parse(0)).toBe(0);
  });

  it("accepts positive integers", () => {
    expect(weightSchema.parse(1)).toBe(1);
    expect(weightSchema.parse(10)).toBe(10);
    expect(weightSchema.parse(100)).toBe(100);
    expect(weightSchema.parse(999)).toBe(999);
  });

  it("accepts -1 (lock)", () => {
    expect(weightSchema.parse(-1)).toBe(-1);
  });

  it("rejects values less than -1", () => {
    expect(() => weightSchema.parse(-2)).toThrow();
    expect(() => weightSchema.parse(-10)).toThrow();
    expect(() => weightSchema.parse(-100)).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => weightSchema.parse(1.5)).toThrow();
    expect(() => weightSchema.parse(0.1)).toThrow();
    expect(() => weightSchema.parse(-0.5)).toThrow();
  });

  it("rejects non-number values", () => {
    expect(() => weightSchema.parse("1")).toThrow();
    expect(() => weightSchema.parse(true)).toThrow();
    expect(() => weightSchema.parse(null)).toThrow();
  });
});

describe("sourceManifestSchema", () => {
  it("validates minimal source manifest", () => {
    const minimal = {
      name: "my-configs",
      version: "1.0.0",
    };

    const result = sourceManifestSchema.parse(minimal);
    expect(result).toEqual(minimal);
  });

  it("validates full source manifest with all fields", () => {
    const full = {
      name: "team-configs",
      version: "2.3.1",
      description: "Team configuration repository",
      repository: "https://github.com/org/team-configs",
      ai: {
        tools: ["claude-code", "cursor"],
      },
      ide: {
        platforms: ["vscode", "jetbrains"],
      },
      profiles: [
        {
          name: "default",
          path: "profiles/default",
          description: "Default profile",
        },
        {
          name: "frontend",
          path: "profiles/frontend",
        },
      ],
      metadata: {
        created: "2024",
        team: "engineering",
      },
    };

    const result = sourceManifestSchema.parse(full);
    expect(result).toEqual(full);
  });

  it("validates source manifest without profiles array (auto-discovery)", () => {
    const withoutProfiles = {
      name: "auto-discover",
      version: "1.0.0",
      description: "Profiles will be auto-discovered",
    };

    const result = sourceManifestSchema.parse(withoutProfiles);
    expect(result).toEqual(withoutProfiles);
  });

  it("rejects manifest without name", () => {
    const invalid = {
      version: "1.0.0",
    };

    expect(() => sourceManifestSchema.parse(invalid)).toThrow();
  });

  it("rejects manifest without version", () => {
    const invalid = {
      name: "missing-version",
    };

    expect(() => sourceManifestSchema.parse(invalid)).toThrow();
  });

  it("rejects manifest with invalid semver version", () => {
    const invalid = {
      name: "bad-version",
      version: "not-a-version",
    };

    expect(() => sourceManifestSchema.parse(invalid)).toThrow(
      "Version must be a valid semver string",
    );
  });

  it("rejects manifest with malformed semver version", () => {
    const testCases = [
      { name: "test", version: "1" }, // Missing minor.patch
      { name: "test", version: "1.2" }, // Missing patch
      { name: "test", version: "v1.2.3" }, // Leading 'v'
      { name: "test", version: "1.2.3-beta" }, // Prerelease not supported
      { name: "test", version: "1.2.3+build" }, // Build metadata not supported
    ];

    for (const testCase of testCases) {
      expect(() => sourceManifestSchema.parse(testCase)).toThrow();
    }
  });

  it("accepts valid semver versions", () => {
    const validVersions = ["0.0.1", "1.0.0", "1.2.3", "10.20.30", "999.999.999"];

    for (const version of validVersions) {
      const manifest = {
        name: "test",
        version,
      };
      const result = sourceManifestSchema.parse(manifest);
      expect(result.version).toBe(version);
    }
  });

  it("validates empty profiles array", () => {
    const emptyProfiles = {
      name: "empty",
      version: "1.0.0",
      profiles: [],
    };

    const result = sourceManifestSchema.parse(emptyProfiles);
    expect(result).toEqual(emptyProfiles);
  });

  it("validates empty metadata object", () => {
    const emptyMetadata = {
      name: "test",
      version: "1.0.0",
      metadata: {},
    };

    const result = sourceManifestSchema.parse(emptyMetadata);
    expect(result).toEqual(emptyMetadata);
  });

  it("rejects profiles with invalid profile entries", () => {
    const invalid = {
      name: "test",
      version: "1.0.0",
      profiles: [
        {
          // Missing name and path
          description: "Invalid",
        },
      ],
    };

    expect(() => sourceManifestSchema.parse(invalid)).toThrow();
  });

  it("validates source manifest with ai.tools", () => {
    const withAiTools = {
      name: "ai-source",
      version: "1.0.0",
      ai: {
        tools: ["claude-code", "cursor", "windsurf"],
      },
    };

    const result = sourceManifestSchema.parse(withAiTools);
    expect(result.ai?.tools).toEqual(["claude-code", "cursor", "windsurf"]);
  });

  it("validates source manifest with empty ai.tools", () => {
    const withEmptyTools = {
      name: "test",
      version: "1.0.0",
      ai: {
        tools: [],
      },
    };

    const result = sourceManifestSchema.parse(withEmptyTools);
    expect(result.ai?.tools).toEqual([]);
  });

  it("validates source manifest with ai section but no tools", () => {
    const withEmptyAi = {
      name: "test",
      version: "1.0.0",
      ai: {},
    };

    const result = sourceManifestSchema.parse(withEmptyAi);
    expect(result.ai).toEqual({});
  });

  it("validates source manifest without ai section", () => {
    const withoutAi = {
      name: "test",
      version: "1.0.0",
    };

    const result = sourceManifestSchema.parse(withoutAi);
    expect(result.ai).toBeUndefined();
  });

  it("validates source manifest with ide.platforms", () => {
    const withIdePlatforms = {
      name: "ide-source",
      version: "1.0.0",
      ide: {
        platforms: ["vscode", "jetbrains", "cursor"],
      },
    };

    const result = sourceManifestSchema.parse(withIdePlatforms);
    expect(result.ide?.platforms).toEqual(["vscode", "jetbrains", "cursor"]);
  });

  it("validates source manifest with empty ide.platforms", () => {
    const withEmptyPlatforms = {
      name: "test",
      version: "1.0.0",
      ide: {
        platforms: [],
      },
    };

    const result = sourceManifestSchema.parse(withEmptyPlatforms);
    expect(result.ide?.platforms).toEqual([]);
  });

  it("validates source manifest with ide section but no platforms", () => {
    const withEmptyIde = {
      name: "test",
      version: "1.0.0",
      ide: {},
    };

    const result = sourceManifestSchema.parse(withEmptyIde);
    expect(result.ide).toEqual({});
  });

  it("validates source manifest without ide section", () => {
    const withoutIde = {
      name: "test",
      version: "1.0.0",
    };

    const result = sourceManifestSchema.parse(withoutIde);
    expect(result.ide).toBeUndefined();
  });

  it("validates source manifest with both ai and ide sections", () => {
    const withBoth = {
      name: "full-source",
      version: "1.0.0",
      ai: { tools: ["claude-code"] },
      ide: { platforms: ["vscode", "jetbrains"] },
    };

    const result = sourceManifestSchema.parse(withBoth);
    expect(result.ai?.tools).toEqual(["claude-code"]);
    expect(result.ide?.platforms).toEqual(["vscode", "jetbrains"]);
  });

  it("rejects non-kebab-case source names", () => {
    const invalidNames = [
      "MySource", // PascalCase
      "my_source", // snake_case
      "my--source", // double hyphens
      "-my-source", // leading hyphen
      "my-source-", // trailing hyphen
      "My-Source", // mixed case
      "123-source", // starts with digit
      "UPPERCASE", // all caps
    ];

    for (const name of invalidNames) {
      expect(() => sourceManifestSchema.parse({ name, version: "1.0.0" })).toThrow(
        "Source name must be kebab-case",
      );
    }
  });

  it("accepts valid kebab-case source names", () => {
    const validNames = ["test", "my-source", "team-dx-configs", "a", "abc123", "my-config-2"];

    for (const name of validNames) {
      const result = sourceManifestSchema.parse({ name, version: "1.0.0" });
      expect(result.name).toBe(name);
    }
  });

  it("allows description as free string without kebab-case restriction", () => {
    const manifest = {
      name: "my-source",
      version: "1.0.0",
      description: "This is a Free Form Description with ANY Characters! 123 @#$",
    };

    const result = sourceManifestSchema.parse(manifest);
    expect(result.description).toBe(manifest.description);
  });

  it("rejects metadata with non-string values", () => {
    const invalid = {
      name: "test",
      version: "1.0.0",
      metadata: {
        count: 42, // Numbers not allowed
      },
    };

    expect(() => sourceManifestSchema.parse(invalid)).toThrow();
  });

  it("strips unknown fields", () => {
    const withUnknown = {
      name: "test",
      version: "1.0.0",
      unknownField: "should be stripped",
      anotherUnknown: 123,
    };

    const result = sourceManifestSchema.parse(withUnknown);
    expect(result).toEqual({
      name: "test",
      version: "1.0.0",
    });
  });
});
