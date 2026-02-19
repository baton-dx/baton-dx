import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManifestValidationError } from "../errors.js";
import {
  addGlobalAiTool,
  addGlobalIdePlatform,
  addGlobalSource,
  getDefaultGlobalSource,
  getGlobalAiTools,
  getGlobalConfigPath,
  getGlobalIdePlatforms,
  getGlobalSources,
  loadGlobalConfig,
  removeGlobalAiTool,
  removeGlobalIdePlatform,
  removeGlobalSource,
  saveGlobalConfig,
  setGlobalAiTools,
  setGlobalIdePlatforms,
} from "./global-config.js";

describe("Global Config", () => {
  let originalBatonHome: string | undefined;
  let tempDir: string;

  beforeEach(async () => {
    originalBatonHome = process.env.BATON_HOME;
    tempDir = await mkdtemp(join(tmpdir(), "baton-test-"));
    process.env.BATON_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalBatonHome !== undefined) {
      process.env.BATON_HOME = originalBatonHome;
    } else {
      // biome-ignore lint/performance/noDelete: required to properly unset env vars in Node.js
      delete process.env.BATON_HOME;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loadGlobalConfig", () => {
    it("should load default config when file doesn't exist", async () => {
      const config = await loadGlobalConfig();

      expect(config.version).toBe("1.0");
      expect(config.sources).toEqual([]);
    });

    it("should load existing config file", async () => {
      // Create a config file manually
      const testConfig = {
        version: "1.0",
        sources: [
          {
            name: "test",
            url: "github:org/repo",
            default: true,
          },
        ],
      };

      await saveGlobalConfig(testConfig);

      const loaded = await loadGlobalConfig();
      expect(loaded.sources).toHaveLength(1);
      expect(loaded.sources?.[0].name).toBe("test");
    });

    it("should throw on invalid YAML", async () => {
      // Write invalid YAML manually
      await writeFile(getGlobalConfigPath(), "invalid: yaml: content: ::::", "utf-8");

      await expect(loadGlobalConfig()).rejects.toThrow(ManifestValidationError);
    });

    it("should throw on invalid schema", async () => {
      // Write valid YAML but invalid schema
      await writeFile(
        getGlobalConfigPath(),
        "version: 1.0\nsources:\n  - invalid_key: value",
        "utf-8",
      );

      await expect(loadGlobalConfig()).rejects.toThrow(ManifestValidationError);
    });
  });

  describe("addGlobalSource", () => {
    it("should add global source successfully", async () => {
      await addGlobalSource("github:org/repo", { name: "test" });

      const sources = await getGlobalSources();
      expect(sources).toHaveLength(1);
      expect(sources[0].name).toBe("test");
      expect(sources[0].url).toBe("github:org/repo");
      expect(sources[0].default).toBe(false);
    });

    it("should add source with description", async () => {
      await addGlobalSource("github:org/repo", {
        name: "test",
        description: "Test repository",
      });

      const sources = await getGlobalSources();
      expect(sources[0].description).toBe("Test repository");
    });

    it("should prevent duplicate source URLs", async () => {
      await addGlobalSource("github:org/repo", { name: "test1" });

      await expect(addGlobalSource("github:org/repo", { name: "test2" })).rejects.toThrow(
        /already registered/,
      );
    });

    it("should prevent duplicate source names", async () => {
      await addGlobalSource("github:org/repo1", { name: "my-source" });

      await expect(addGlobalSource("github:org/repo2", { name: "my-source" })).rejects.toThrow(
        /already exists/,
      );
    });

    it("should set source as default", async () => {
      await addGlobalSource("github:org/repo", {
        name: "test",
        setAsDefault: true,
      });

      const sources = await getGlobalSources();
      expect(sources[0].default).toBe(true);
    });

    it("should set only one source as default", async () => {
      await addGlobalSource("github:org/repo1", {
        name: "a",
        setAsDefault: true,
      });
      await addGlobalSource("github:org/repo2", {
        name: "b",
        setAsDefault: true,
      });

      const sources = await getGlobalSources();
      const defaults = sources.filter((s) => s.default);

      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe("b");
    });

    it("should infer name from GitHub URL", async () => {
      await addGlobalSource("github:acme-corp/dx-configs");

      const sources = await getGlobalSources();
      expect(sources[0].name).toBe("acme-corp");
    });

    it("should infer name from GitLab URL", async () => {
      await addGlobalSource("gitlab:my-org/profiles");

      const sources = await getGlobalSources();
      expect(sources[0].name).toBe("my-org");
    });

    it("should infer name from file path", async () => {
      await addGlobalSource("../local/my-profiles");

      const sources = await getGlobalSources();
      expect(sources[0].name).toBe("my-profiles");
    });
  });

  describe("removeGlobalSource", () => {
    it("should remove source by name", async () => {
      await addGlobalSource("github:org/repo", { name: "test" });
      await removeGlobalSource("test");

      const sources = await getGlobalSources();
      expect(sources).toHaveLength(0);
    });

    it("should remove source by URL", async () => {
      await addGlobalSource("github:org/repo", { name: "test" });
      await removeGlobalSource("github:org/repo");

      const sources = await getGlobalSources();
      expect(sources).toHaveLength(0);
    });

    it("should throw when source not found", async () => {
      await expect(removeGlobalSource("nonexistent")).rejects.toThrow(/not found/);
    });
  });

  describe("getGlobalSources", () => {
    it("should return empty array when no sources", async () => {
      const sources = await getGlobalSources();
      expect(sources).toEqual([]);
    });

    it("should return all sources", async () => {
      await addGlobalSource("github:org1/repo", { name: "a" });
      await addGlobalSource("github:org2/repo", { name: "b" });

      const sources = await getGlobalSources();
      expect(sources).toHaveLength(2);
      expect(sources.map((s) => s.name)).toEqual(["a", "b"]);
    });
  });

  describe("getDefaultGlobalSource", () => {
    it("should return null when no default source", async () => {
      const defaultSource = await getDefaultGlobalSource();
      expect(defaultSource).toBeNull();
    });

    it("should return default source", async () => {
      await addGlobalSource("github:org1/repo", { name: "a" });
      await addGlobalSource("github:org2/repo", {
        name: "b",
        setAsDefault: true,
      });

      const defaultSource = await getDefaultGlobalSource();
      expect(defaultSource?.name).toBe("b");
    });
  });

  describe("saveGlobalConfig", () => {
    it("should save and load config round-trip", async () => {
      await addGlobalSource("github:org/repo", {
        name: "test",
        description: "Test repo",
        setAsDefault: true,
      });

      const config = await loadGlobalConfig();
      expect(config.sources).toHaveLength(1);
      expect(config.sources?.[0].description).toBe("Test repo");
      expect(config.sources?.[0].default).toBe(true);
    });

    it("should create directory if it doesn't exist", async () => {
      const config = await loadGlobalConfig();
      await saveGlobalConfig(config);

      // Should not throw
      const loaded = await loadGlobalConfig();
      expect(loaded).toBeDefined();
    });
  });

  describe("AI Tools management", () => {
    describe("getGlobalAiTools", () => {
      it("should return empty array when no tools configured", async () => {
        const tools = await getGlobalAiTools();
        expect(tools).toEqual([]);
      });

      it("should return saved tools", async () => {
        await setGlobalAiTools(["claude-code", "cursor"]);
        const tools = await getGlobalAiTools();
        expect(tools).toEqual(["claude-code", "cursor"]);
      });
    });

    describe("setGlobalAiTools", () => {
      it("should persist tools to global config", async () => {
        await setGlobalAiTools(["claude-code", "windsurf"]);

        const config = await loadGlobalConfig();
        expect(config.ai?.tools).toEqual(["claude-code", "windsurf"]);
      });

      it("should overwrite existing tools", async () => {
        await setGlobalAiTools(["claude-code"]);
        await setGlobalAiTools(["cursor", "windsurf"]);

        const tools = await getGlobalAiTools();
        expect(tools).toEqual(["cursor", "windsurf"]);
      });

      it("should preserve other config fields", async () => {
        await addGlobalSource("github:org/repo", { name: "test" });
        await setGlobalAiTools(["claude-code"]);

        const config = await loadGlobalConfig();
        expect(config.sources).toHaveLength(1);
        expect(config.ai?.tools).toEqual(["claude-code"]);
      });
    });

    describe("addGlobalAiTool", () => {
      it("should add a single tool", async () => {
        await addGlobalAiTool("claude-code");

        const tools = await getGlobalAiTools();
        expect(tools).toEqual(["claude-code"]);
      });

      it("should append to existing tools", async () => {
        await setGlobalAiTools(["claude-code"]);
        await addGlobalAiTool("cursor");

        const tools = await getGlobalAiTools();
        expect(tools).toEqual(["claude-code", "cursor"]);
      });

      it("should throw when tool already configured", async () => {
        await addGlobalAiTool("claude-code");

        await expect(addGlobalAiTool("claude-code")).rejects.toThrow(/already configured/);
      });
    });

    describe("removeGlobalAiTool", () => {
      it("should remove a single tool", async () => {
        await setGlobalAiTools(["claude-code", "cursor"]);
        await removeGlobalAiTool("claude-code");

        const tools = await getGlobalAiTools();
        expect(tools).toEqual(["cursor"]);
      });

      it("should throw when tool not found", async () => {
        await expect(removeGlobalAiTool("nonexistent")).rejects.toThrow(/not configured/);
      });
    });

    describe("ai field in globalConfigSchema", () => {
      it("should accept config with ai.tools field", async () => {
        const config = await loadGlobalConfig();
        config.ai = { tools: ["claude-code", "cursor"] };
        await saveGlobalConfig(config);

        const loaded = await loadGlobalConfig();
        expect(loaded.ai?.tools).toEqual(["claude-code", "cursor"]);
      });

      it("should accept config without ai field", async () => {
        const config = await loadGlobalConfig();
        await saveGlobalConfig(config);

        const loaded = await loadGlobalConfig();
        expect(loaded.ai).toBeUndefined();
      });
    });
  });

  describe("IDE Platform management", () => {
    describe("getGlobalIdePlatforms", () => {
      it("should return empty array when no platforms configured", async () => {
        const platforms = await getGlobalIdePlatforms();
        expect(platforms).toEqual([]);
      });

      it("should return saved platforms", async () => {
        await setGlobalIdePlatforms(["vscode", "cursor"]);
        const platforms = await getGlobalIdePlatforms();
        expect(platforms).toEqual(["vscode", "cursor"]);
      });
    });

    describe("setGlobalIdePlatforms", () => {
      it("should persist platforms to global config", async () => {
        await setGlobalIdePlatforms(["vscode", "jetbrains"]);

        const config = await loadGlobalConfig();
        expect(config.ide?.platforms).toEqual(["vscode", "jetbrains"]);
      });

      it("should overwrite existing platforms", async () => {
        await setGlobalIdePlatforms(["vscode"]);
        await setGlobalIdePlatforms(["cursor", "zed"]);

        const platforms = await getGlobalIdePlatforms();
        expect(platforms).toEqual(["cursor", "zed"]);
      });

      it("should preserve other config fields", async () => {
        await addGlobalSource("github:org/repo", { name: "test" });
        await setGlobalAiTools(["claude-code"]);
        await setGlobalIdePlatforms(["vscode"]);

        const config = await loadGlobalConfig();
        expect(config.sources).toHaveLength(1);
        expect(config.ai?.tools).toEqual(["claude-code"]);
        expect(config.ide?.platforms).toEqual(["vscode"]);
      });
    });

    describe("addGlobalIdePlatform", () => {
      it("should add a single platform", async () => {
        await addGlobalIdePlatform("vscode");

        const platforms = await getGlobalIdePlatforms();
        expect(platforms).toEqual(["vscode"]);
      });

      it("should append to existing platforms", async () => {
        await setGlobalIdePlatforms(["vscode"]);
        await addGlobalIdePlatform("cursor");

        const platforms = await getGlobalIdePlatforms();
        expect(platforms).toEqual(["vscode", "cursor"]);
      });

      it("should throw when platform already configured", async () => {
        await addGlobalIdePlatform("vscode");

        await expect(addGlobalIdePlatform("vscode")).rejects.toThrow(/already configured/);
      });
    });

    describe("removeGlobalIdePlatform", () => {
      it("should remove a single platform", async () => {
        await setGlobalIdePlatforms(["vscode", "cursor"]);
        await removeGlobalIdePlatform("vscode");

        const platforms = await getGlobalIdePlatforms();
        expect(platforms).toEqual(["cursor"]);
      });

      it("should throw when platform not found", async () => {
        await expect(removeGlobalIdePlatform("nonexistent")).rejects.toThrow(/not configured/);
      });
    });

    describe("ide field in globalConfigSchema", () => {
      it("should accept config with ide.platforms field", async () => {
        const config = await loadGlobalConfig();
        config.ide = { platforms: ["vscode", "cursor"] };
        await saveGlobalConfig(config);

        const loaded = await loadGlobalConfig();
        expect(loaded.ide?.platforms).toEqual(["vscode", "cursor"]);
      });

      it("should accept config without ide field", async () => {
        const config = await loadGlobalConfig();
        await saveGlobalConfig(config);

        const loaded = await loadGlobalConfig();
        expect(loaded.ide).toBeUndefined();
      });
    });
  });
});
