import { describe, expect, it } from "vitest";
import { selectProfileFromSource } from "./profile-selection.js";

describe("selectProfileFromSource", () => {
  it("should return source as-is for direct profile path (github with subpath)", async () => {
    const source = "github:org/repo/frontend";
    const result = await selectProfileFromSource(source);
    expect(result).toBe(source);
  });

  it("should return source as-is for file source", async () => {
    const source = "file:./my-profile";
    const result = await selectProfileFromSource(source);
    expect(result).toBe(source);
  });

  it("should return source as-is for npm source", async () => {
    const source = "npm:@scope/package/profile";
    const result = await selectProfileFromSource(source);
    expect(result).toBe(source);
  });

  it("should return source as-is for local source", async () => {
    const source = "./my-local-profile";
    const result = await selectProfileFromSource(source);
    expect(result).toBe(source);
  });

  // Note: Interactive profile selection tests (GitHub/GitLab without subpath)
  // are skipped as they require:
  // 1. Git repository cloning
  // 2. User interaction with prompts
  // These require integration tests with git cloning and user prompts
});
