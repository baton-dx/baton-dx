import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { writeMcpJson, writeMcpJsonc, writeMcpToml } from "./writer.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "baton-writer-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("writeMcpJson", () => {
  test("writes correct shape { configKey: { name: { ... } } }", async () => {
    const filePath = join(tmpDir, "mcp.json");
    await writeMcpJson(filePath, "mcpServers", {
      github: { command: "npx", args: ["@github/mcp"] },
    });
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content).toHaveProperty("mcpServers");
    expect(content.mcpServers.github.command).toBe("npx");
  });

  test("writes nested path under parent key when parentConfigPath is dot-separated", async () => {
    const filePath = join(tmpDir, "amp.json");
    // nestedPath "amp.x" → parts=["amp","x"], loop runs once for i=0:
    //   sets content["amp"]={}, then current["mcpServers"]=servers
    // Result: { amp: { mcpServers: { github: ... } } }
    await writeMcpJson(filePath, "mcpServers", { github: { command: "npx" } }, "amp.x");
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.amp).toBeDefined();
    expect(content.amp.mcpServers).toBeDefined();
    expect(content.amp.mcpServers.github.command).toBe("npx");
  });

  test("creates parent directories if needed", async () => {
    const filePath = join(tmpDir, "deep", "nested", "mcp.json");
    await writeMcpJson(filePath, "mcpServers", { srv: { command: "node" } });
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers.srv).toBeDefined();
  });

  test("file ends with newline", async () => {
    const filePath = join(tmpDir, "mcp.json");
    await writeMcpJson(filePath, "mcpServers", { srv: { command: "node" } });
    const raw = await readFile(filePath, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
  });
});

describe("writeMcpJsonc", () => {
  test("writes valid JSON (JSONC superset)", async () => {
    const filePath = join(tmpDir, "mcp.jsonc");
    await writeMcpJsonc(filePath, "mcpServers", {
      github: { command: "npx" },
    });
    // Should be parseable as plain JSON
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers.github.command).toBe("npx");
  });
});

describe("writeMcpToml", () => {
  test("writes valid TOML array-of-tables format", async () => {
    const filePath = join(tmpDir, "config.toml");
    await writeMcpToml(filePath, [{ name: "github", command: "npx", args: ["@github/mcp"] }]);
    const raw = await readFile(filePath, "utf-8");
    expect(raw).toContain("[[mcp_servers]]");
    expect(raw).toContain('name = "github"');
    expect(raw).toContain('command = "npx"');
  });

  test("writes env section for server with env vars", async () => {
    const filePath = join(tmpDir, "config.toml");
    await writeMcpToml(filePath, [
      {
        name: "github",
        command: "npx",
        env: { TOKEN: "abc123" },
      },
    ]);
    const raw = await readFile(filePath, "utf-8");
    expect(raw).toContain("[mcp_servers.env]");
    expect(raw).toContain('TOKEN = "abc123"');
  });

  test("writes multiple servers as separate [[mcp_servers]] entries", async () => {
    const filePath = join(tmpDir, "config.toml");
    await writeMcpToml(filePath, [
      { name: "server-a", command: "cmd-a" },
      { name: "server-b", url: "http://localhost:3000" },
    ]);
    const raw = await readFile(filePath, "utf-8");
    const count = (raw.match(/\[\[mcp_servers\]\]/g) || []).length;
    expect(count).toBe(2);
    expect(raw).toContain('name = "server-a"');
    expect(raw).toContain('name = "server-b"');
  });

  test("creates parent directories if needed", async () => {
    const filePath = join(tmpDir, "deep", "config.toml");
    await writeMcpToml(filePath, [{ name: "srv", command: "node" }]);
    const raw = await readFile(filePath, "utf-8");
    expect(raw).toContain("[[mcp_servers]]");
  });
});
