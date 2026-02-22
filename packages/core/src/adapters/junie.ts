import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * Junie adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .junie/ | Global paths: ~/.junie/
 */
export class JunieAdapter extends BaseAIToolAdapter {
  readonly key = "junie";
  readonly name = "Junie";
}
