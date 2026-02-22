import { BaseAIToolAdapter } from "./base-adapter.js";

/**
 * OpenCode adapter — uses canonical formats with AGENTS.md for memory.
 * Global paths: ~/.config/opencode/ (XDG Base Directory)
 */
export class OpenCodeAdapter extends BaseAIToolAdapter {
  readonly key = "opencode";
  readonly name = "OpenCode";
}
