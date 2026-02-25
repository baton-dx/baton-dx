import { describe, expect, it } from "vitest";
import { selectMultipleProfilesFromSource } from "./profile-selection.js";

describe("selectMultipleProfilesFromSource", () => {
  it("should return source as array for direct profile path (github with subpath)", async () => {
    const source = "github:org/repo/frontend";
    const result = await selectMultipleProfilesFromSource(source);
    expect(result).toEqual([source]);
  });

  it("should return source as array for npm source", async () => {
    const source = "npm:@scope/package/profile";
    const result = await selectMultipleProfilesFromSource(source);
    expect(result).toEqual([source]);
  });

  // Note: Interactive profile selection tests (GitHub/GitLab without subpath, local sources
  // with multiple profiles) are skipped as they require:
  // 1. Git repository cloning
  // 2. User interaction with prompts
  // These require integration tests with git cloning and user prompts
});
