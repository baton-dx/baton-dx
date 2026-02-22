import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAIToolCache,
  detectInstalledAITools,
  setDetectedAITools,
} from "./ai-tool-detection.js";

describe("ai-tool-detection", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearAIToolCache();
  });

  describe("setDetectedAITools", () => {
    it("overrides AI tool detection", async () => {
      setDetectedAITools(["claude-code", "cursor"]);

      const tools = await detectInstalledAITools();

      expect(tools).toEqual(["claude-code", "cursor"]);
    });

    it("returns empty array when no tools set", async () => {
      setDetectedAITools([]);

      const tools = await detectInstalledAITools();

      expect(tools).toEqual([]);
    });

    it("caches detection results on second call", async () => {
      setDetectedAITools(["claude-code"]);

      const tools1 = await detectInstalledAITools();
      const tools2 = await detectInstalledAITools();

      expect(tools1).toEqual(tools2);
      expect(tools1).toEqual(["claude-code"]);
    });
  });

  describe("clearAIToolCache", () => {
    it("clears cached detection results", async () => {
      setDetectedAITools(["claude-code"]);
      await detectInstalledAITools();

      clearAIToolCache();
      setDetectedAITools(["cursor"]);

      const tools = await detectInstalledAITools();

      expect(tools).toEqual(["cursor"]);
    });
  });
});
