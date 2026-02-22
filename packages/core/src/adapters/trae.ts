import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * Trae adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .trae/ | Global paths: ~/.trae/
 */
export class TraeAdapter extends BaseAIToolAdapter {
  readonly key = "trae";
  readonly name = "Trae";
}
