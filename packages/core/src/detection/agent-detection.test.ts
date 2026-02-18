import { beforeEach, describe, expect, it } from "vitest";
import { clearAgentCache, detectInstalledAgents, setDetectedAgents } from "./agent-detection.js";

describe("agent-detection", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearAgentCache();
  });

  describe("setDetectedAgents", () => {
    it("overrides agent detection", async () => {
      setDetectedAgents(["claude-code", "cursor"]);

      const agents = await detectInstalledAgents();

      expect(agents).toEqual(["claude-code", "cursor"]);
    });

    it("returns empty array when no agents set", async () => {
      setDetectedAgents([]);

      const agents = await detectInstalledAgents();

      expect(agents).toEqual([]);
    });

    it("caches detection results on second call", async () => {
      setDetectedAgents(["claude-code"]);

      const agents1 = await detectInstalledAgents();
      const agents2 = await detectInstalledAgents();

      expect(agents1).toEqual(agents2);
      expect(agents1).toEqual(["claude-code"]);
    });
  });

  describe("clearAgentCache", () => {
    it("clears cached detection results", async () => {
      setDetectedAgents(["claude-code"]);
      await detectInstalledAgents();

      clearAgentCache();
      setDetectedAgents(["cursor"]);

      const agents = await detectInstalledAgents();

      expect(agents).toEqual(["cursor"]);
    });
  });
});
