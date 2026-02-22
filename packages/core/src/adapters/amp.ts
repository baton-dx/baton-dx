import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * Amp adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .agents/ | Global paths: ~/.config/agents/
 */
export class AmpAdapter extends BaseAIToolAdapter {
  readonly key = "amp";
  readonly name = "Amp";
}
