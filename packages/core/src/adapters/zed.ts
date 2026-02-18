import { BaseAdapter } from "./base-adapter.js";

/**
 * Zed adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .zed/ | Global paths: ~/.zed/
 */
export class ZedAdapter extends BaseAdapter {
  readonly key = "zed";
  readonly name = "Zed";
}
