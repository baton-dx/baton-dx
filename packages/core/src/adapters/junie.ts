import { BaseAdapter } from "./base-adapter.js";

/**
 * Junie adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .junie/ | Global paths: ~/.junie/
 */
export class JunieAdapter extends BaseAdapter {
  readonly key = "junie";
  readonly name = "Junie";
}
