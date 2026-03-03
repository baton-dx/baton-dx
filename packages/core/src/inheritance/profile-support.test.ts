import { describe, expect, it } from "vitest";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import {
  type ResolvedProfileSupport,
  resolveProfileSupport,
  type SourceManifest,
} from "./profile-support.js";

/**
 * Helper to create a minimal profile manifest for testing
 */
function makeProfile(overrides: Partial<ProfileManifest> = {}): ProfileManifest {
  return {
    name: "test-profile",
    version: "1.0.0",
    ...overrides,
  };
}

/**
 * Helper to create a minimal source manifest for testing
 */
function makeSource(overrides: Partial<SourceManifest> = {}): SourceManifest {
  return {
    name: "test-source",
    version: "1.0.0",
    ...overrides,
  };
}

describe("resolveProfileSupport", () => {
  describe("AI tools inheritance", () => {
    it("returns profile ai.tools when profile defines them", () => {
      const profile = makeProfile({ ai: { tools: ["cursor", "claude-code"] } });
      const source = makeSource({ ai: { tools: ["cursor", "claude-code", "windsurf"] } });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["cursor", "claude-code"]);
    });

    it("falls back to source ai.tools when profile has no ai section", () => {
      const profile = makeProfile();
      const source = makeSource({ ai: { tools: ["cursor", "windsurf"] } });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["cursor", "windsurf"]);
    });

    it("falls back to source ai.tools when profile ai has no tools field", () => {
      const profile = makeProfile({ ai: { skills: [{ name: "test", scope: "project" }] } });
      const source = makeSource({ ai: { tools: ["claude-code"] } });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["claude-code"]);
    });

    it("uses profile empty array when profile explicitly sets tools to empty", () => {
      const profile = makeProfile({ ai: { tools: [] } });
      const source = makeSource({ ai: { tools: ["cursor", "claude-code"] } });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual([]);
    });

    it("returns empty array when neither profile nor source define tools", () => {
      const profile = makeProfile();
      const source = makeSource();

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual([]);
    });

    it("returns empty array when source has ai section but no tools", () => {
      const profile = makeProfile();
      const source = makeSource({ ai: {} });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual([]);
    });

    it("allows profile to have a subset of source tools", () => {
      const profile = makeProfile({ ai: { tools: ["cursor"] } });
      const source = makeSource({
        ai: { tools: ["cursor", "claude-code", "windsurf", "codex"] },
      });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["cursor"]);
    });
  });

  describe("IDE platforms inheritance", () => {
    it("returns profile ide keys when profile defines ide section", () => {
      const profile = makeProfile({
        ide: {
          vscode: [".vscode/settings.json"],
          jetbrains: [".idea/codeStyles/codeStyleConfig.xml"],
        },
      });
      const source = makeSource({
        ide: { platforms: ["vscode", "jetbrains", "zed"] },
      });

      const result = resolveProfileSupport(profile, source);

      expect(result.idePlatforms).toEqual(["vscode", "jetbrains"]);
    });

    it("falls back to source ide.platforms when profile has no ide section", () => {
      const profile = makeProfile();
      const source = makeSource({ ide: { platforms: ["vscode", "cursor"] } });

      const result = resolveProfileSupport(profile, source);

      expect(result.idePlatforms).toEqual(["vscode", "cursor"]);
    });

    it("uses profile empty ide object (no platforms)", () => {
      const profile = makeProfile({ ide: {} });
      const source = makeSource({ ide: { platforms: ["vscode", "jetbrains"] } });

      const result = resolveProfileSupport(profile, source);

      expect(result.idePlatforms).toEqual([]);
    });

    it("returns empty array when neither profile nor source define ide", () => {
      const profile = makeProfile();
      const source = makeSource();

      const result = resolveProfileSupport(profile, source);

      expect(result.idePlatforms).toEqual([]);
    });

    it("returns empty array when source has ide section but no platforms", () => {
      const profile = makeProfile();
      const source = makeSource({ ide: {} });

      const result = resolveProfileSupport(profile, source);

      expect(result.idePlatforms).toEqual([]);
    });

    it("allows profile to have a subset of source platforms", () => {
      const profile = makeProfile({
        ide: { vscode: [".vscode/settings.json"] },
      });
      const source = makeSource({
        ide: { platforms: ["vscode", "jetbrains", "zed"] },
      });

      const result = resolveProfileSupport(profile, source);

      expect(result.idePlatforms).toEqual(["vscode"]);
    });
  });

  describe("combined resolution", () => {
    it("resolves both ai tools and ide platforms from profile", () => {
      const profile = makeProfile({
        ai: { tools: ["claude-code", "cursor"] },
        ide: {
          vscode: [".vscode/settings.json"],
          zed: [".zed/settings.json"],
        },
      });
      const source = makeSource({
        ai: { tools: ["claude-code", "cursor", "windsurf"] },
        ide: { platforms: ["vscode", "jetbrains", "zed"] },
      });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["claude-code", "cursor"]);
      expect(result.idePlatforms).toEqual(["vscode", "zed"]);
    });

    it("resolves ai from profile and ide from source (mixed inheritance)", () => {
      const profile = makeProfile({
        ai: { tools: ["cursor"] },
        // no ide section → inherits from source
      });
      const source = makeSource({
        ai: { tools: ["cursor", "claude-code"] },
        ide: { platforms: ["vscode", "jetbrains"] },
      });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["cursor"]);
      expect(result.idePlatforms).toEqual(["vscode", "jetbrains"]);
    });

    it("resolves ai from source and ide from profile (mixed inheritance)", () => {
      const profile = makeProfile({
        // no ai section → inherits from source
        ide: { vscode: [".vscode/extensions.json"] },
      });
      const source = makeSource({
        ai: { tools: ["windsurf", "codex"] },
        ide: { platforms: ["vscode", "jetbrains", "zed"] },
      });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["windsurf", "codex"]);
      expect(result.idePlatforms).toEqual(["vscode"]);
    });

    it("returns empty arrays when both profile and source are minimal", () => {
      const profile = makeProfile();
      const source = makeSource();

      const result: ResolvedProfileSupport = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual([]);
      expect(result.idePlatforms).toEqual([]);
    });

    it("handles full source support with full profile override", () => {
      const profile = makeProfile({
        ai: { tools: ["claude-code"] },
        ide: { jetbrains: [".idea/misc.xml"] },
      });
      const source = makeSource({
        ai: { tools: ["claude-code", "cursor", "windsurf", "codex", "amp"] },
        ide: { platforms: ["vscode", "jetbrains", "cursor", "zed"] },
      });

      const result = resolveProfileSupport(profile, source);

      expect(result.aiTools).toEqual(["claude-code"]);
      expect(result.idePlatforms).toEqual(["jetbrains"]);
    });
  });
});
