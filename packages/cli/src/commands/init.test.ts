import { describe, expect, it } from "vitest";
import { initCommand } from "./init.js";

describe("init command", () => {
  it("should have async run function", () => {
    expect(initCommand.run).toBeDefined();
    expect(typeof initCommand.run).toBe("function");
  });

  it("should export a valid command definition", () => {
    expect(initCommand).toBeDefined();
    expect(initCommand.meta).toBeDefined();
    expect(initCommand.args).toBeDefined();
  });

  it("should have --yes, --force, and --profile flags", () => {
    const args = initCommand.args as Record<string, unknown>;
    expect(args.yes).toBeDefined();
    expect(args.force).toBeDefined();
    expect(args.profile).toBeDefined();
  });

  it("should not have old starter-profile flags or options", () => {
    const args = initCommand.args as Record<string, unknown>;
    expect(args.template).toBeUndefined();
    expect(args.source).toBeUndefined();
  });

  // Integration tests for init flow are skipped
  // as they require:
  // 1. Git repository cloning
  // 2. User interaction with prompts
  // 3. File system operations in test directory
  // These are tested manually and in E2E tests
});
