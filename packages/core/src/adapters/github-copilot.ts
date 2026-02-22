import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * GitHub Copilot adapter — uses copilot-instructions.md for memory.
 * Memory path: .github/copilot-instructions.md
 */
export class GitHubCopilotAdapter extends BaseAIToolAdapter {
  readonly key = "github-copilot";
  readonly name = "GitHub Copilot";
  protected override memoryFilename = "copilot-instructions.md";
}
