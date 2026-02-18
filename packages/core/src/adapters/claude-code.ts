import { BaseAdapter } from "./base-adapter.js";

/**
 * Claude Code adapter — reference implementation for ToolAdapter interface.
 *
 * Uses canonical formats:
 * - Skills: 1:1 copy (SKILL.md with optional scripts/)
 * - Rules: .md with optional YAML frontmatter (paths:)
 * - Agents: .md with full YAML frontmatter
 * - Memory: CLAUDE.md or .claude/CLAUDE.md
 * - Commands: .claude/commands/{name}.md
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  readonly key = "claude-code";
  readonly name = "Claude Code";
  protected override memoryFilename = "CLAUDE.md";
}
