import { describe, expect, it } from "vitest";
import { type ProjectPreferences, projectPreferencesSchema } from "./preferences-schema.js";

describe("Project Preferences Schema", () => {
  describe("valid preferences", () => {
    it("validates a full preferences object", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "1.0",
        ai: { useGlobal: false, tools: ["claude-code", "cursor"] },
        ide: { useGlobal: true, platforms: ["vscode"] },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe("1.0");
        expect(result.data.ai.useGlobal).toBe(false);
        expect(result.data.ai.tools).toEqual(["claude-code", "cursor"]);
        expect(result.data.ide.useGlobal).toBe(true);
        expect(result.data.ide.platforms).toEqual(["vscode"]);
      }
    });

    it("applies defaults for ai and ide when omitted", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "1.0",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ai).toEqual({ useGlobal: true, tools: [] });
        expect(result.data.ide).toEqual({ useGlobal: true, platforms: [] });
      }
    });

    it("defaults tools to empty array when only useGlobal is provided", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "1.0",
        ai: { useGlobal: false },
        ide: { useGlobal: false },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ai.tools).toEqual([]);
        expect(result.data.ide.platforms).toEqual([]);
      }
    });

    it("allows empty tools and platforms arrays", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "1.0",
        ai: { useGlobal: true, tools: [] },
        ide: { useGlobal: true, platforms: [] },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("invalid preferences", () => {
    it("rejects missing version", () => {
      const result = projectPreferencesSchema.safeParse({
        ai: { useGlobal: true, tools: [] },
        ide: { useGlobal: true, platforms: [] },
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid version value", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "2.0",
        ai: { useGlobal: true, tools: [] },
        ide: { useGlobal: true, platforms: [] },
      });

      expect(result.success).toBe(false);
    });

    it("rejects non-string version", () => {
      const result = projectPreferencesSchema.safeParse({
        version: 1.0,
        ai: { useGlobal: true, tools: [] },
        ide: { useGlobal: true, platforms: [] },
      });

      expect(result.success).toBe(false);
    });

    it("rejects non-boolean useGlobal", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "1.0",
        ai: { useGlobal: "yes", tools: [] },
      });

      expect(result.success).toBe(false);
    });

    it("rejects non-array tools", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "1.0",
        ai: { useGlobal: false, tools: "claude-code" },
      });

      expect(result.success).toBe(false);
    });

    it("rejects non-string items in tools array", () => {
      const result = projectPreferencesSchema.safeParse({
        version: "1.0",
        ai: { useGlobal: false, tools: [123] },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("type inference", () => {
    it("produces a valid ProjectPreferences type", () => {
      const prefs: ProjectPreferences = {
        version: "1.0",
        ai: { useGlobal: false, tools: ["claude-code"] },
        ide: { useGlobal: true, platforms: [] },
      };

      const result = projectPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });
  });
});
