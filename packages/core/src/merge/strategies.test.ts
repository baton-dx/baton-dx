import { describe, expect, it } from "vitest";
import {
  mergeAppend,
  mergeDeep,
  mergeDirectory,
  mergeImport,
  mergePrepend,
  mergePrompt,
  mergeReplace,
  mergeSkip,
} from "./strategies";

describe("mergeReplace", () => {
  it("should replace target with source", () => {
    const source = "new content";
    const target = "old content";
    expect(mergeReplace(source, target)).toBe(source);
  });

  it("should work with empty target", () => {
    const source = "new content";
    const target = "";
    expect(mergeReplace(source, target)).toBe(source);
  });
});

describe("mergeDeep", () => {
  it("should deep merge two YAML objects", () => {
    const source = "b: 2\nc: 3";
    const target = "a: 1\nb: 0";
    const result = mergeDeep(source, target);

    // Parse result to verify merge
    const parsed = result.split("\n").reduce(
      (acc, line) => {
        const [key, value] = line.split(": ");
        if (key && value) {
          acc[key] = Number.parseInt(value, 10);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(parsed.a).toBe(1); // From target
    expect(parsed.b).toBe(2); // Overridden by source
    expect(parsed.c).toBe(3); // New from source
  });

  it("should deep merge nested objects", () => {
    const source = "config:\n  b: 2\n  c: 3";
    const target = "config:\n  a: 1\n  b: 0";
    const result = mergeDeep(source, target);

    expect(result).toContain("a: 1"); // Kept from target
    expect(result).toContain("b: 2"); // Overridden by source
    expect(result).toContain("c: 3"); // New from source
  });

  it("should replace arrays instead of merging", () => {
    const source = "items:\n  - x\n  - y";
    const target = "items:\n  - a\n  - b";
    const result = mergeDeep(source, target);

    expect(result).toContain("- x");
    expect(result).toContain("- y");
    expect(result).not.toContain("- a");
    expect(result).not.toContain("- b");
  });

  it("should handle new keys in source", () => {
    const source = "newKey: value";
    const target = "existingKey: value";
    const result = mergeDeep(source, target);

    expect(result).toContain("newKey: value");
    expect(result).toContain("existingKey: value");
  });

  it("should replace if source is not an object", () => {
    const source = "plain text";
    const target = "key: value";
    const result = mergeDeep(source, target);

    expect(result).toBe(source);
  });

  it("should replace if target is not an object", () => {
    const source = "key: value";
    const target = "plain text";
    const result = mergeDeep(source, target);

    expect(result).toBe(source);
  });
});

describe("mergeAppend", () => {
  it("should append source to target with separator", () => {
    const source = "new content";
    const target = "existing content";
    const result = mergeAppend(source, target, "test-profile");

    expect(result).toContain("existing content");
    expect(result).toContain("---");
    expect(result).toContain("# From profile: test-profile");
    expect(result).toContain("new content");

    // Check order
    expect(result.indexOf("existing content")).toBeLessThan(result.indexOf("new content"));
  });

  it("should use generic attribution when profile name not provided", () => {
    const source = "new content";
    const target = "existing content";
    const result = mergeAppend(source, target);

    expect(result).toContain("# From profile");
    expect(result).not.toContain("# From profile:");
  });

  it("should work with empty target", () => {
    const source = "new content";
    const target = "";
    const result = mergeAppend(source, target, "test-profile");

    expect(result).toContain("new content");
    expect(result).toContain("# From profile: test-profile");
  });
});

describe("mergePrepend", () => {
  it("should prepend source to target with separator", () => {
    const source = "new content";
    const target = "existing content";
    const result = mergePrepend(source, target, "test-profile");

    expect(result).toContain("existing content");
    expect(result).toContain("---");
    expect(result).toContain("# From profile: test-profile");
    expect(result).toContain("new content");

    // Check order
    expect(result.indexOf("new content")).toBeLessThan(result.indexOf("existing content"));
  });

  it("should use generic attribution when profile name not provided", () => {
    const source = "new content";
    const target = "existing content";
    const result = mergePrepend(source, target);

    expect(result).toContain("# From profile");
    expect(result).not.toContain("# From profile:");
  });

  it("should work with empty target", () => {
    const source = "new content";
    const target = "";
    const result = mergePrepend(source, target, "test-profile");

    expect(result).toContain("new content");
    expect(result).toContain("# From profile: test-profile");
  });
});

describe("mergeSkip", () => {
  it("should return target if it exists", () => {
    const source = "new content";
    const target = "existing content";
    const result = mergeSkip(source, target);

    expect(result).toBe(target);
  });

  it("should return source if target is empty", () => {
    const source = "new content";
    const target = "";
    const result = mergeSkip(source, target);

    expect(result).toBe(source);
  });
});

describe("mergePrompt", () => {
  it("should return source by default", () => {
    const source = "new content";
    const target = "existing content";
    const result = mergePrompt(source, target);

    expect(result).toBe(source);
  });
});

describe("mergeDirectory", () => {
  it("should return source (directory merge handled at file system level)", () => {
    const source = "new content";
    const target = "existing content";
    const result = mergeDirectory(source, target);

    expect(result).toBe(source);
  });
});

describe("mergeImport", () => {
  it("should add import reference to target", () => {
    const source = "source content";
    const target = "existing content";
    const result = mergeImport(source, target, "team-profile", "CLAUDE.md");

    expect(result).toContain("@.baton/profiles/team-profile/memory/CLAUDE.md");
    expect(result).toContain("existing content");
    expect(result.indexOf("@.baton")).toBeLessThan(result.indexOf("existing content"));
  });

  it("should not duplicate import if already exists", () => {
    const source = "source content";
    const target = "@.baton/profiles/team-profile/memory/CLAUDE.md\n\nexisting content";
    const result = mergeImport(source, target, "team-profile", "CLAUDE.md");

    expect(result).toBe(target);
    const matches = result.match(/@\.baton\/profiles\/team-profile/g);
    expect(matches).toHaveLength(1);
  });

  it("should work with empty target", () => {
    const source = "source content";
    const target = "";
    const result = mergeImport(source, target, "team-profile", "CLAUDE.md");

    expect(result).toBe("@.baton/profiles/team-profile/memory/CLAUDE.md");
  });

  it("should handle different filenames", () => {
    const source = "source content";
    const target = "existing content";
    const result = mergeImport(source, target, "team-profile", "AGENTS.md");

    expect(result).toContain("@.baton/profiles/team-profile/memory/AGENTS.md");
  });
});
