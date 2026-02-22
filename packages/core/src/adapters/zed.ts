import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * Zed adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .zed/ | Global paths: ~/.zed/
 */
export class ZedAdapter extends BaseAIToolAdapter {
  readonly key = "zed";
  readonly name = "Zed";
}
