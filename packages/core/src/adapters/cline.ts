import { BaseAdapter } from "./base-adapter.js";

/**
 * Cline adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .cline/ | Global paths: ~/.cline/
 */
export class ClineAdapter extends BaseAdapter {
  readonly key = "cline";
  readonly name = "Cline";
}
