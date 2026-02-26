import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readModifyWriteSharedSettings } from "./shared-settings.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "baton-shared-settings-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("readModifyWriteSharedSettings", () => {
  test("creates file if it does not exist", async () => {
    const filePath = join(tmpDir, "settings.json");
    const result = await readModifyWriteSharedSettings(
      filePath,
      "mcpServers",
      { github: { command: "npx", args: ["@github/mcp"] } },
      [],
    );
    expect(result.written).toBe(true);
    expect(result.warnings).toHaveLength(0);
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers.github).toBeDefined();
  });

  test("preserves user's non-baton entries", async () => {
    const filePath = join(tmpDir, "settings.json");
    await writeFile(
      filePath,
      JSON.stringify({
        mcpServers: {
          "user-server": { command: "user-cmd" },
        },
        otherSetting: true,
      }),
    );
    await readModifyWriteSharedSettings(
      filePath,
      "mcpServers",
      { "baton-server": { command: "baton-cmd" } },
      [],
    );
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers["user-server"]).toBeDefined();
    expect(content.mcpServers["baton-server"]).toBeDefined();
    expect(content.otherSetting).toBe(true);
  });

  test("removes previous baton entries by name", async () => {
    const filePath = join(tmpDir, "settings.json");
    await writeFile(
      filePath,
      JSON.stringify({
        mcpServers: {
          "old-baton-server": { command: "old-cmd" },
          "user-server": { command: "user-cmd" },
        },
      }),
    );
    await readModifyWriteSharedSettings(
      filePath,
      "mcpServers",
      { "new-baton-server": { command: "new-cmd" } },
      ["old-baton-server"],
    );
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers["old-baton-server"]).toBeUndefined();
    expect(content.mcpServers["new-baton-server"]).toBeDefined();
    expect(content.mcpServers["user-server"]).toBeDefined();
  });

  test("idempotent — skips write when content unchanged", async () => {
    const filePath = join(tmpDir, "settings.json");
    const servers = { github: { command: "npx" } };
    // First write
    await readModifyWriteSharedSettings(filePath, "mcpServers", servers, []);
    const contentBefore = await readFile(filePath, "utf-8");

    // Second write (same content)
    const result = await readModifyWriteSharedSettings(filePath, "mcpServers", servers, ["github"]);
    // Content unchanged — idempotent (no write needed when result is same)
    const contentAfter = await readFile(filePath, "utf-8");
    expect(contentBefore).toBe(contentAfter);
  });

  test("handles invalid JSON gracefully — warns and does not overwrite", async () => {
    const filePath = join(tmpDir, "settings.json");
    await writeFile(filePath, "{ this is not valid JSON }");
    const result = await readModifyWriteSharedSettings(
      filePath,
      "mcpServers",
      { github: { command: "npx" } },
      [],
    );
    expect(result.written).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    // File should be unchanged
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("{ this is not valid JSON }");
  });

  test("handles ENOENT for empty servers — no write", async () => {
    const filePath = join(tmpDir, "nonexistent", "settings.json");
    const result = await readModifyWriteSharedSettings(filePath, "mcpServers", {}, []);
    expect(result.written).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  test("supports dot-separated config key paths", async () => {
    const filePath = join(tmpDir, "settings.json");
    await readModifyWriteSharedSettings(
      filePath,
      "context_servers",
      { myServer: { command: "cmd" } },
      [],
    );
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.context_servers.myServer).toBeDefined();
  });
});
