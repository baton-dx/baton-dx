import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * Roo adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .roo/ | Global paths: ~/.roo/
 */
export class RooAdapter extends BaseAIToolAdapter {
  readonly key = "roo";
  readonly name = "Roo";
}
