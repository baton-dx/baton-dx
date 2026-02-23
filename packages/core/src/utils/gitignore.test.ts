import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectComprehensivePatterns,
  ensureBatonDirGitignored,
  removeGitignoreManagedSection,
  updateGitignore,
} from "./gitignore.js";

describe("updateGitignore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `baton-gitignore-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .gitignore with managed section when it does not exist", async () => {
    const updated = await updateGitignore(tmpDir, [".vscode/", "biome.json"]);
    expect(updated).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# Baton managed");
    expect(content).toContain(".vscode/");
    expect(content).toContain("biome.json");
    expect(content).toContain("# End Baton managed");
  });

  it("appends managed section to existing .gitignore", async () => {
    await writeFile(join(tmpDir, ".gitignore"), "node_modules/\n.env\n", "utf-8");

    const updated = await updateGitignore(tmpDir, [".vscode/"]);
    expect(updated).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".env");
    expect(content).toContain("# Baton managed");
    expect(content).toContain(".vscode/");
  });

  it("replaces existing managed section with new patterns", async () => {
    const initial = "node_modules/\n\n# Baton managed\n.vscode/\n# End Baton managed\n";
    await writeFile(join(tmpDir, ".gitignore"), initial, "utf-8");

    const updated = await updateGitignore(tmpDir, [".idea/", ".vscode/", "biome.json"]);
    expect(updated).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain(".idea/");
    expect(content).toContain(".vscode/");
    expect(content).toContain("biome.json");
    // Should only have one managed section
    expect(content.match(/# Baton managed/g)?.length).toBe(1);
  });

  it("returns false when patterns are identical (idempotent)", async () => {
    await updateGitignore(tmpDir, [".vscode/"]);
    const updated = await updateGitignore(tmpDir, [".vscode/"]);
    expect(updated).toBe(false);
  });

  it("returns false when patterns array is empty", async () => {
    const updated = await updateGitignore(tmpDir, []);
    expect(updated).toBe(false);
  });

  it("preserves content before and after managed section", async () => {
    const initial =
      "# Custom\nnode_modules/\n\n# Baton managed\nold-pattern\n# End Baton managed\n\n# Other\n.env\n";
    await writeFile(join(tmpDir, ".gitignore"), initial, "utf-8");

    await updateGitignore(tmpDir, [".vscode/"]);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# Custom\nnode_modules/");
    expect(content).toContain("# Other\n.env");
    expect(content).not.toContain("old-pattern");
  });
});

describe("ensureBatonDirGitignored", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `baton-ensure-gitignore-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .gitignore with .baton/ when it does not exist", async () => {
    await ensureBatonDirGitignored(tmpDir);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# Baton local");
    expect(content).toContain(".baton/");
  });

  it("appends .baton/ to existing .gitignore", async () => {
    await writeFile(join(tmpDir, ".gitignore"), "node_modules/\n.env\n", "utf-8");

    await ensureBatonDirGitignored(tmpDir);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".env");
    expect(content).toContain(".baton/");
  });

  it("is a no-op when .baton/ is already present", async () => {
    const original = "node_modules/\n\n# Baton local\n.baton/\n";
    await writeFile(join(tmpDir, ".gitignore"), original, "utf-8");

    await ensureBatonDirGitignored(tmpDir);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toBe(original);
  });

  it("is a no-op when .baton/ appears in Baton managed section", async () => {
    const original = "# Baton managed\n.baton/\n# End Baton managed\n";
    await writeFile(join(tmpDir, ".gitignore"), original, "utf-8");

    await ensureBatonDirGitignored(tmpDir);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toBe(original);
  });
});

describe("removeGitignoreManagedSection", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `baton-remove-section-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("removes the managed section from .gitignore", async () => {
    const initial =
      "node_modules/\n\n# Baton managed\n.vscode/\nCLAUDE.md\n# End Baton managed\n\n.env\n";
    await writeFile(join(tmpDir, ".gitignore"), initial, "utf-8");

    const removed = await removeGitignoreManagedSection(tmpDir);
    expect(removed).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".env");
    expect(content).not.toContain("# Baton managed");
    expect(content).not.toContain("CLAUDE.md");
    expect(content).not.toContain("# End Baton managed");
  });

  it("returns false when no managed section exists", async () => {
    await writeFile(join(tmpDir, ".gitignore"), "node_modules/\n", "utf-8");
    const removed = await removeGitignoreManagedSection(tmpDir);
    expect(removed).toBe(false);
  });

  it("returns false when .gitignore does not exist", async () => {
    const removed = await removeGitignoreManagedSection(tmpDir);
    expect(removed).toBe(false);
  });

  it("handles managed section as the only content", async () => {
    const initial = "# Baton managed\n.vscode/\n# End Baton managed\n";
    await writeFile(join(tmpDir, ".gitignore"), initial, "utf-8");

    const removed = await removeGitignoreManagedSection(tmpDir);
    expect(removed).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toBe("");
  });

  it("preserves .baton/ cache section when removing managed section", async () => {
    const initial = "# Baton local\n.baton/\n\n# Baton managed\n.vscode/\n# End Baton managed\n";
    await writeFile(join(tmpDir, ".gitignore"), initial, "utf-8");

    const removed = await removeGitignoreManagedSection(tmpDir);
    expect(removed).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# Baton local");
    expect(content).toContain(".baton/");
    expect(content).not.toContain("# Baton managed");
  });
});

describe("collectComprehensivePatterns", () => {
  it("includes patterns for all known AI tools", () => {
    const result = collectComprehensivePatterns({ fileTargets: [] });
    // Claude Code
    expect(result).toContain(".claude/commands/");
    expect(result).toContain(".claude/rules/");
    expect(result).toContain(".claude/skills/");
    expect(result).toContain(".claude/agents/");
    expect(result).toContain("CLAUDE.md");
    // Cursor
    expect(result).toContain(".cursor/commands/");
    expect(result).toContain(".cursor/rules/");
    expect(result).toContain(".cursor/skills/");
    expect(result).toContain(".cursor/agents/");
    expect(result).toContain("AGENTS.md");
    expect(result).toContain(".cursorrules");
    // Windsurf
    expect(result).toContain(".windsurf/rules/");
    expect(result).toContain(".windsurfrules");
    // Codex
    expect(result).toContain(".codex/commands/");
    // GitHub Copilot
    expect(result).toContain(".github/copilot/commands/");
    // Antigravity
    expect(result).toContain("GEMINI.md");
  });

  it("includes patterns for all known IDE platforms", () => {
    const result = collectComprehensivePatterns({ fileTargets: [] });
    expect(result).toContain(".vscode/");
    expect(result).toContain(".idea/");
  });

  it("includes file targets when provided", () => {
    const result = collectComprehensivePatterns({
      fileTargets: ["biome.json", ".editorconfig"],
    });
    expect(result).toContain("biome.json");
    expect(result).toContain(".editorconfig");
  });

  it("does not include baton.lock (lockfile should be committed)", () => {
    const result = collectComprehensivePatterns({ fileTargets: [] });
    expect(result).not.toContain("baton.lock");
  });

  it("returns sorted, deduplicated patterns", () => {
    const result = collectComprehensivePatterns({ fileTargets: [] });
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
    expect(result.length).toBe(new Set(result).size);
  });

  it("produces stable output across multiple calls", () => {
    const first = collectComprehensivePatterns({ fileTargets: ["a.json"] });
    const second = collectComprehensivePatterns({ fileTargets: ["a.json"] });
    expect(first).toEqual(second);
  });

  it("deduplicates shared memory files (e.g., AGENTS.md)", () => {
    const result = collectComprehensivePatterns({ fileTargets: [] });
    // Multiple tools share AGENTS.md — should appear only once
    const agentsCount = result.filter((p) => p === "AGENTS.md").length;
    expect(agentsCount).toBe(1);
  });

  it("uses full file paths for static adapter paths (not parent directories)", () => {
    const result = collectComprehensivePatterns({ fileTargets: [] });
    // GitHub Copilot memory/rules are static: .github/copilot-instructions.md
    // Should NOT produce the broad ".github/" pattern
    expect(result).toContain(".github/copilot-instructions.md");
    expect(result).not.toContain(".github/");
  });
});
