import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeProjectPreferences } from "./preferences-io.js";
import { resolvePreferences } from "./preferences-resolver.js";

vi.mock("../config/global-config.js", () => ({
  getGlobalAiTools: vi.fn(async () => ["claude-code", "cursor"]),
  getGlobalIdePlatforms: vi.fn(async () => ["vscode"]),
}));

describe("Preference Resolution", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = join(
      tmpdir(),
      `baton-resolve-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("uses global config when no preferences file exists", async () => {
    const result = await resolvePreferences(projectRoot);

    expect(result.ai.source).toBe("global");
    expect(result.ai.tools).toEqual(["claude-code", "cursor"]);
    expect(result.ide.source).toBe("global");
    expect(result.ide.platforms).toEqual(["vscode"]);
  });

  it("uses global config when useGlobal is true", async () => {
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: { useGlobal: true, tools: ["windsurf"] },
      ide: { useGlobal: true, platforms: ["jetbrains"] },
    });

    const result = await resolvePreferences(projectRoot);

    expect(result.ai.source).toBe("global");
    expect(result.ai.tools).toEqual(["claude-code", "cursor"]);
    expect(result.ide.source).toBe("global");
    expect(result.ide.platforms).toEqual(["vscode"]);
  });

  it("uses project preferences when useGlobal is false", async () => {
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: { useGlobal: false, tools: ["windsurf"] },
      ide: { useGlobal: false, platforms: ["jetbrains", "zed"] },
    });

    const result = await resolvePreferences(projectRoot);

    expect(result.ai.source).toBe("project");
    expect(result.ai.tools).toEqual(["windsurf"]);
    expect(result.ide.source).toBe("project");
    expect(result.ide.platforms).toEqual(["jetbrains", "zed"]);
  });

  it("supports mixed configs: AI from project, IDE from global", async () => {
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: { useGlobal: false, tools: ["codex"] },
      ide: { useGlobal: true, platforms: [] },
    });

    const result = await resolvePreferences(projectRoot);

    expect(result.ai.source).toBe("project");
    expect(result.ai.tools).toEqual(["codex"]);
    expect(result.ide.source).toBe("global");
    expect(result.ide.platforms).toEqual(["vscode"]);
  });

  it("supports mixed configs: AI from global, IDE from project", async () => {
    await writeProjectPreferences(projectRoot, {
      version: "1.0",
      ai: { useGlobal: true, tools: [] },
      ide: { useGlobal: false, platforms: ["cursor"] },
    });

    const result = await resolvePreferences(projectRoot);

    expect(result.ai.source).toBe("global");
    expect(result.ai.tools).toEqual(["claude-code", "cursor"]);
    expect(result.ide.source).toBe("project");
    expect(result.ide.platforms).toEqual(["cursor"]);
  });
});
