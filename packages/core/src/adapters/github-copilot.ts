import { BaseAdapter } from "./base-adapter.js";

/**
 * GitHub Copilot adapter — uses copilot-instructions.md for memory.
 * Memory path: .github/copilot-instructions.md
 */
export class GitHubCopilotAdapter extends BaseAdapter {
  readonly key = "github-copilot";
  readonly name = "GitHub Copilot";
  protected override memoryFilename = "copilot-instructions.md";
}
