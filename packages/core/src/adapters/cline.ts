import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * Cline adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .cline/ | Global paths: ~/.cline/
 */
export class ClineAdapter extends BaseAIToolAdapter {
  readonly key = "cline";
  readonly name = "Cline";
}
