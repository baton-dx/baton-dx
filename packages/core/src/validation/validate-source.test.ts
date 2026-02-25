import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateSource } from "./validate-source.js";

const TEST_DIR = join(process.cwd(), "tmp", "validate-source-test");

/**
 * Helper: write a minimal valid baton.source.yaml
 */
async function writeSourceManifest(
  root: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const manifest = {
    name: "test-source",
    version: "1.0.0",
    ...overrides,
  };
  await writeFile(join(root, "baton.source.yaml"), toYaml(manifest));
}

/**
 * Helper: write a minimal valid baton.profile.yaml
 */
async function writeProfileManifest(
  profileDir: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const manifest = {
    name: "default",
    version: "1.0.0",
    ...overrides,
  };
  await mkdir(profileDir, { recursive: true });
  await writeFile(join(profileDir, "baton.profile.yaml"), toYaml(manifest));
}

/**
 * Minimal YAML serializer sufficient for tests (avoids importing yaml).
 */
function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (typeof value[0] === "object" && value[0] !== null) {
        lines.push(`${pad}${key}:`);
        for (const item of value) {
          const entries = Object.entries(item as Record<string, unknown>);
          const first = entries[0];
          if (first) {
            lines.push(`${pad}  - ${first[0]}: ${JSON.stringify(first[1])}`);
            for (const [k, v] of entries.slice(1)) {
              lines.push(`${pad}    ${k}: ${JSON.stringify(v)}`);
            }
          }
        }
      } else {
        lines.push(`${pad}${key}:`);
        for (const item of value) {
          lines.push(`${pad}  - ${JSON.stringify(item)}`);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(value as Record<string, unknown>, indent + 2));
    } else {
      lines.push(`${pad}${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join("\n");
}

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("validateSource", () => {
  // ── Check 1: Source manifest exists ──────────────────────────────
  it("reports error when baton.source.yaml is missing", async () => {
    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].severity).toBe("error");
    expect(report.issues[0].message).toContain("baton.source.yaml");
    expect(report.issues[0].context).toBe("source-manifest");
  });

  // ── Check 2: Source manifest is schema-valid ─────────────────────
  it("reports error for invalid source manifest schema", async () => {
    // Missing required 'version' field
    await writeFile(join(TEST_DIR, "baton.source.yaml"), 'name: "bad-manifest"\n');

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(
      report.issues.some((i) => i.severity === "error" && i.context === "source-manifest"),
    ).toBe(true);
  });

  // ── Valid minimal source ─────────────────────────────────────────
  it("passes for a valid minimal source with no profiles", async () => {
    await writeSourceManifest(TEST_DIR);

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
  });

  // ── Check 3: Declared profile directories exist ──────────────────
  it("reports error when declared profile directory does not exist", async () => {
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "missing", path: "profiles/missing" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(
      report.issues.some((i) => i.severity === "error" && i.message.includes("does not exist")),
    ).toBe(true);
  });

  // ── Check 5: Unknown AI tool keys ───────────────────────────────
  it("warns about unknown AI tool keys in source manifest", async () => {
    await writeSourceManifest(TEST_DIR, {
      ai: { tools: ["claude-code", "not-a-real-tool"] },
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true); // warnings don't make it invalid
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("not-a-real-tool")),
    ).toBe(true);
  });

  // ── Check 4: Profile manifest is schema-valid ────────────────────
  it("reports error for invalid profile manifest", async () => {
    const profileDir = join(TEST_DIR, "profiles", "bad");
    await mkdir(profileDir, { recursive: true });
    // Write invalid profile manifest (missing version)
    await writeFile(join(profileDir, "baton.profile.yaml"), 'name: "bad-profile"\n');
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "bad", path: "profiles/bad" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.severity === "error" && i.context === "profile:bad")).toBe(
      true,
    );
  });

  // ── Check 6: Skills ──────────────────────────────────────────────
  it("warns when skill SKILL.md is missing", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        skills: [{ name: "code-review", scope: "project" }],
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("SKILL.md")),
    ).toBe(true);
  });

  it("does not warn when skill SKILL.md is present", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        skills: [{ name: "code-review", scope: "project" }],
      },
    });
    const skillDir = join(profileDir, "ai", "skills", "code-review");
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), "# Code Review Skill");
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(report.issues.some((i) => i.message.includes("SKILL.md"))).toBe(false);
  });

  // ── Check 7: Rules ──────────────────────────────────────────────
  it("warns when rule file is missing (array format)", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        rules: ["coding-standards"],
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(
      report.issues.some(
        (i) => i.severity === "warning" && i.message.includes("coding-standards.md"),
      ),
    ).toBe(true);
  });

  it("warns when rule file is missing (object format)", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        rules: {
          "claude-code": ["special-rule"],
        },
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("special-rule.md")),
    ).toBe(true);
  });

  // ── Check 8: Agents ─────────────────────────────────────────────
  it("warns when agent file is missing (array format)", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        agents: ["code-reviewer"],
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("code-reviewer.md")),
    ).toBe(true);
  });

  it("warns when agent file is missing (object/scoped format)", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        agents: {
          "claude-code": ["reviewer"],
        },
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("reviewer.md")),
    ).toBe(true);
  });

  // ── Check 9: Memory ─────────────────────────────────────────────
  it("warns when memory file is missing", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        memory: [{ source: "MEMORY.md", merge: "append" }],
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("MEMORY.md")),
    ).toBe(true);
  });

  // ── Check 10: Commands ──────────────────────────────────────────
  it("warns when command file is missing", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ai: {
        commands: ["review"],
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("review.md")),
    ).toBe(true);
  });

  // ── Check 11: Files ─────────────────────────────────────────────
  it("warns when files/ source is missing", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      files: [{ source: "biome.json" }],
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("biome.json")),
    ).toBe(true);
  });

  // ── Check 12: IDE files ─────────────────────────────────────────
  it("warns when IDE file is missing", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      ide: {
        vscode: ["settings.json"],
      },
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("settings.json")),
    ).toBe(true);
  });

  // ── Check 13: Extends references ────────────────────────────────
  it("reports error when extends sibling profile does not exist", async () => {
    const profileDir = join(TEST_DIR, "profiles", "child");
    await writeProfileManifest(profileDir, {
      name: "child",
      extends: "base",
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "child", path: "profiles/child" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(
      report.issues.some((i) => i.severity === "error" && i.message.includes('extends "base"')),
    ).toBe(true);
  });

  it("does not error when extends sibling profile exists", async () => {
    // Create the base profile
    const baseDir = join(TEST_DIR, "profiles", "base");
    await writeProfileManifest(baseDir, { name: "base" });

    // Create the child profile that extends base by name
    const childDir = join(TEST_DIR, "profiles", "child");
    await writeProfileManifest(childDir, {
      name: "child",
      extends: "base",
    });

    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "base", path: "profiles/base" },
        { name: "child", path: "profiles/child" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.issues.some((i) => i.message.includes('extends "base"'))).toBe(false);
  });

  // ── Check 14: Undefined variables ───────────────────────────────
  it("warns about undefined variables in .md files", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      variables: { project_name: "my-app" },
    });
    // Create a .md file with an undefined variable
    const skillDir = join(profileDir, "ai", "skills", "demo");
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), "Use {{project_name}} and {{undefined_var}} here.");
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    // undefined_var should be flagged
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("undefined_var")),
    ).toBe(true);
    // project_name should NOT be flagged (it is declared)
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("project_name")),
    ).toBe(false);
  });

  it("does not flag declared variables", async () => {
    const profileDir = join(TEST_DIR, "profiles", "default");
    await writeProfileManifest(profileDir, {
      variables: { project_name: "my-app", framework: "react" },
    });
    const docsDir = join(profileDir, "ai", "rules", "universal");
    await mkdir(docsDir, { recursive: true });
    await writeFile(
      join(docsDir, "rule1.md"),
      "Project: {{project_name}}, Framework: {{framework}}",
    );
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "default", path: "profiles/default" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(report.issues.filter((i) => i.message.includes("Undefined variable"))).toHaveLength(0);
  });

  // ── Check 15: Orphaned profiles ─────────────────────────────────
  it("warns about orphaned profiles on disk", async () => {
    // Create two profiles on disk
    await writeProfileManifest(join(TEST_DIR, "profiles", "declared"), {
      name: "declared",
    });
    await writeProfileManifest(join(TEST_DIR, "profiles", "orphaned"), {
      name: "orphaned",
    });
    // Only declare one in the source manifest
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "declared", path: "profiles/declared" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(
      report.issues.some((i) => i.severity === "warning" && i.message.includes("Orphaned profile")),
    ).toBe(true);
  });

  // ── Profile count in summary ────────────────────────────────────
  it("counts profiles checked in summary", async () => {
    await writeProfileManifest(join(TEST_DIR, "profiles", "alpha"), {
      name: "alpha",
    });
    await writeProfileManifest(join(TEST_DIR, "profiles", "beta"), {
      name: "beta",
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "alpha", path: "profiles/alpha" },
        { name: "beta", path: "profiles/beta" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.summary.profilesChecked).toBe(2);
  });

  // ── Fully valid complex source ──────────────────────────────────
  it("passes for a fully valid complex source", async () => {
    // Source manifest with explicit profiles
    await writeSourceManifest(TEST_DIR, {
      description: "Complex valid source",
      ai: { tools: ["claude-code", "cursor"] },
      profiles: [
        { name: "base", path: "profiles/base" },
        { name: "frontend", path: "profiles/frontend" },
      ],
    });

    // ── Base profile ──
    const baseDir = join(TEST_DIR, "profiles", "base");
    await writeProfileManifest(baseDir, {
      name: "base",
      variables: { project_name: "my-app" },
      ai: {
        tools: ["claude-code"],
        skills: [{ name: "code-review", scope: "project" }],
        rules: ["coding-standards"],
        agents: ["reviewer"],
        memory: [{ source: "MEMORY.md", merge: "append" }],
        commands: ["review"],
      },
      files: [{ source: "biome.json" }],
      ide: {
        vscode: ["settings.json"],
      },
    });

    // Create all referenced files for base profile
    await mkdir(join(baseDir, "ai", "skills", "code-review"), { recursive: true });
    await writeFile(
      join(baseDir, "ai", "skills", "code-review", "SKILL.md"),
      "# Skill\nUse {{project_name}}",
    );

    await mkdir(join(baseDir, "ai", "rules", "universal"), { recursive: true });
    await writeFile(join(baseDir, "ai", "rules", "universal", "coding-standards.md"), "# Rules");

    await mkdir(join(baseDir, "ai", "agents"), { recursive: true });
    await writeFile(join(baseDir, "ai", "agents", "reviewer.md"), "# Agent");

    await mkdir(join(baseDir, "ai", "memory"), { recursive: true });
    await writeFile(join(baseDir, "ai", "memory", "MEMORY.md"), "# Memory");

    await mkdir(join(baseDir, "ai", "commands"), { recursive: true });
    await writeFile(join(baseDir, "ai", "commands", "review.md"), "# Review command");

    await mkdir(join(baseDir, "files"), { recursive: true });
    await writeFile(join(baseDir, "files", "biome.json"), "{}");

    await mkdir(join(baseDir, "ide", "vscode"), { recursive: true });
    await writeFile(join(baseDir, "ide", "vscode", "settings.json"), "{}");

    // ── Frontend profile (extends base) ──
    const frontendDir = join(TEST_DIR, "profiles", "frontend");
    await writeProfileManifest(frontendDir, {
      name: "frontend",
      extends: "base",
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.profilesChecked).toBe(2);
    expect(report.issues).toHaveLength(0);
  });

  // ── Auto-discovery when profiles not declared ────────────────────
  it("auto-discovers profiles when not explicitly declared", async () => {
    await writeSourceManifest(TEST_DIR);
    await writeProfileManifest(join(TEST_DIR, "profiles", "auto"), {
      name: "auto",
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(report.summary.profilesChecked).toBe(1);
  });

  // ── Check 16: Extend-Loop-Erkennung ─────────────────────────────
  it("reports error for direct extend loop (a extends b, b extends a)", async () => {
    const profileA = join(TEST_DIR, "profiles", "a");
    await writeProfileManifest(profileA, { name: "a", extends: "b" });
    const profileB = join(TEST_DIR, "profiles", "b");
    await writeProfileManifest(profileB, { name: "b", extends: "a" });
    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "a", path: "profiles/a" },
        { name: "b", path: "profiles/b" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(
      report.issues.some(
        (i) => i.severity === "error" && i.message.includes("Extend loop detected"),
      ),
    ).toBe(true);
  });

  it("reports error for indirect extend loop (a → b → c → a)", async () => {
    await writeProfileManifest(join(TEST_DIR, "profiles", "a"), { name: "a", extends: "b" });
    await writeProfileManifest(join(TEST_DIR, "profiles", "b"), { name: "b", extends: "c" });
    await writeProfileManifest(join(TEST_DIR, "profiles", "c"), { name: "c", extends: "a" });
    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "a", path: "profiles/a" },
        { name: "b", path: "profiles/b" },
        { name: "c", path: "profiles/c" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(
      report.issues.some(
        (i) => i.severity === "error" && i.message.includes("Extend loop detected"),
      ),
    ).toBe(true);
  });

  it("does not report loop for valid linear chain", async () => {
    await writeProfileManifest(join(TEST_DIR, "profiles", "base"), { name: "base" });
    await writeProfileManifest(join(TEST_DIR, "profiles", "child"), {
      name: "child",
      extends: "base",
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "base", path: "profiles/base" },
        { name: "child", path: "profiles/child" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.issues.some((i) => i.message.includes("Extend loop"))).toBe(false);
  });

  // ── Check 17: Weight-Konflikt unter Geschwisterprofilen ──────────
  it("warns when sibling profiles share the same parent and weight", async () => {
    await writeProfileManifest(join(TEST_DIR, "profiles", "base"), { name: "base" });
    await writeProfileManifest(join(TEST_DIR, "profiles", "react"), {
      name: "react",
      extends: "base",
      weight: 10,
    });
    await writeProfileManifest(join(TEST_DIR, "profiles", "vue"), {
      name: "vue",
      extends: "base",
      weight: 10,
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "base", path: "profiles/base" },
        { name: "react", path: "profiles/react" },
        { name: "vue", path: "profiles/vue" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true); // warning, not error
    expect(
      report.issues.some(
        (i) => i.severity === "warning" && i.message.includes("last-installed wins"),
      ),
    ).toBe(true);
  });

  it("warns when root-level profiles share the same weight", async () => {
    await writeProfileManifest(join(TEST_DIR, "profiles", "standalone-a"), {
      name: "standalone-a",
    });
    await writeProfileManifest(join(TEST_DIR, "profiles", "standalone-b"), {
      name: "standalone-b",
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "standalone-a", path: "profiles/standalone-a" },
        { name: "standalone-b", path: "profiles/standalone-b" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(true);
    expect(
      report.issues.some(
        (i) =>
          i.severity === "warning" &&
          i.message.includes("none (root level)") &&
          i.message.includes("last-installed wins"),
      ),
    ).toBe(true);
  });

  it("does not warn when siblings have different weights", async () => {
    await writeProfileManifest(join(TEST_DIR, "profiles", "base"), { name: "base" });
    await writeProfileManifest(join(TEST_DIR, "profiles", "react"), {
      name: "react",
      extends: "base",
      weight: 10,
    });
    await writeProfileManifest(join(TEST_DIR, "profiles", "vue"), {
      name: "vue",
      extends: "base",
      weight: 20,
    });
    await writeSourceManifest(TEST_DIR, {
      profiles: [
        { name: "base", path: "profiles/base" },
        { name: "react", path: "profiles/react" },
        { name: "vue", path: "profiles/vue" },
      ],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.issues.some((i) => i.message.includes("last-installed wins"))).toBe(false);
  });

  // ── Missing profile manifest file ───────────────────────────────
  it("reports error when profile directory exists but baton.profile.yaml is missing", async () => {
    const profileDir = join(TEST_DIR, "profiles", "empty");
    await mkdir(profileDir, { recursive: true });
    await writeSourceManifest(TEST_DIR, {
      profiles: [{ name: "empty", path: "profiles/empty" }],
    });

    const report = await validateSource(TEST_DIR);

    expect(report.valid).toBe(false);
    expect(
      report.issues.some(
        (i) =>
          i.severity === "error" &&
          i.message.includes("baton.profile.yaml") &&
          i.message.includes("not found"),
      ),
    ).toBe(true);
  });
});
