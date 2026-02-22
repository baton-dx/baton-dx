import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * Kiro adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .kiro/ | Global paths: ~/.kiro/
 */
export class KiroAdapter extends BaseAIToolAdapter {
  readonly key = "kiro";
  readonly name = "Kiro";
}
