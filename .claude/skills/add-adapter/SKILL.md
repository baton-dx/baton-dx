---
name: add-adapter
description: Step-by-step guide for adding a new AI tool adapter to Baton. Use when adding support for a new AI coding tool (e.g., a new IDE or AI assistant). Generates all required files from templates.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
argument-hint: <tool-name> (e.g., "aider", "continue", "supermaven")
---

# Add New AI Tool Adapter

Add support for a new AI coding tool to Baton. This involves changes across all three packages.

## Before You Start

Gather the following information about the new AI tool:
- **Key**: kebab-case identifier (e.g., `my-tool`)
- **Name**: Human-readable name (e.g., `My Tool`)
- **Config directory**: Where the tool stores config (e.g., `.my-tool/` or `~/.config/my-tool/`)
- **Memory filename**: What file the tool reads for context (e.g., `AGENTS.md`, `CLAUDE.md`, or a custom name)
- **Rule format**: Does it use plain `.md` or a custom format like Cursor's `.mdc`?
- **Legacy paths**: Any old-format config paths (e.g., `.mytoolrules`)
- **Detection**: CLI binary name and/or config directory for auto-detection
- **Commands directory**: Where slash commands go (e.g., `.my-tool/commands/` or `.my-tool/workflows/`)

## Step 1: Add Path Config (`@baton-dx/agent-paths`)

**File**: `packages/agent-paths/src/registry.ts`

Add a new entry to the `AGENT_PATHS` array:

```typescript
{
  key: "my-tool",
  name: "My Tool",
  skills: {
    project: ".my-tool/skills/{name}",
    global: "~/.my-tool/skills/{name}",
  },
  rules: {
    project: ".my-tool/rules/{name}.md",
    global: "~/.my-tool/rules/{name}.md",
  },
  agents: {
    project: ".my-tool/agents/{name}.md",
    global: "~/.my-tool/agents/{name}.md",
  },
  memory: {
    project: "AGENTS.md",                    // or tool-specific filename
    global: "~/.my-tool/AGENTS.md",
  },
  settings: {
    project: ".my-tool/settings.json",
    global: "~/.my-tool/settings.json",
  },
  commands: {
    project: ".my-tool/commands/{name}.md",  // or "workflows" etc.
    global: "~/.my-tool/commands/{name}.md",
  },
  detection: ["my-tool", "~/.my-tool/"],     // CLI binary name + config dir
  legacy: {},                                 // e.g., { rules: [".mytoolrules"] }
},
```

## Step 2: Create Adapter Class (`@baton-dx/core`)

**File**: `packages/core/src/adapters/my-tool.ts`

Most adapters extend `BaseAdapter` (from `./base-adapter.js`) which provides default implementations. Only override methods that differ. For full control, implement `ToolAdapter` directly.

Use the minimal adapter template (no transformations needed for most tools):

```typescript
import { getAgentPath } from "@baton-dx/agent-paths";
import type { ConfigType, Scope } from "@baton-dx/agent-paths";

import type {
  ToolAdapter,
  AgentFile,
  CommandFile,
  MemoryFile,
  RuleFile,
  SkillDir,
  ValidationResult,
} from "./types.js";

/**
 * My Tool adapter
 *
 * Specifics:
 * - Skills: 1:1 copy
 * - Rules: 1:1 copy (or describe transformation)
 * - Agents: 1:1 copy
 * - Memory: AGENTS.md (or tool-specific filename)
 * - Commands: 1:1 copy
 * - Legacy: (list any legacy paths)
 */
export class MyToolAdapter implements ToolAdapter {
  key = "my-tool";
  name = "My Tool";

  async isInstalled(): Promise<boolean> {
    try {
      const { detectInstalledAgents } = await import("../detection/agent-detection.js");
      const installed = await detectInstalledAgents();
      return installed.includes(this.key);
    } catch {
      return false;
    }
  }

  getPath(type: ConfigType, scope: Scope, name: string): string {
    return getAgentPath(this.key, type, scope, name);
  }

  getLegacyPaths(_type: ConfigType): string[] {
    return [];
  }

  transformSkill(skill: SkillDir): SkillDir {
    return skill;
  }

  transformRule(rule: RuleFile): RuleFile {
    return rule;
  }

  transformAgent(agent: AgentFile): AgentFile {
    return agent;
  }

  transformMemory(memory: MemoryFile): MemoryFile {
    if (memory.filename === "MEMORY.md") {
      return { ...memory, filename: "AGENTS.md" }; // Adjust filename
    }
    return memory;
  }

  transformCommand(command: CommandFile): CommandFile {
    return command;
  }

  validate(_type: ConfigType, _file: unknown): ValidationResult {
    return { valid: true, errors: [] };
  }
}
```

**If the tool has custom rule format** (like Cursor's `.mdc`), implement `transformRule()` with the transformation logic. See `cursor.ts` as reference.

**If the tool has a unique memory filename** (like Claude Code's `CLAUDE.md` or Antigravity's `GEMINI.md`), update `transformMemory()` accordingly.

## Step 3: Register Adapter

**File**: `packages/core/src/adapters/registry.ts`

1. Add import at the top:
```typescript
import { MyToolAdapter } from "./my-tool.js";
```

2. Add instance to the `adapters` array in `initializeAdapters()`:
```typescript
new MyToolAdapter(),
```

## Step 4: Create Tests

**File**: `packages/core/src/adapters/my-tool.test.ts`

Follow the established test pattern from `cursor.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { MyToolAdapter } from "./my-tool.js";
import type { AgentFile, CommandFile, MemoryFile, RuleFile, SkillDir } from "./types.js";

describe("MyToolAdapter", () => {
  let adapter: MyToolAdapter;

  beforeEach(() => {
    adapter = new MyToolAdapter();
  });

  describe("metadata", () => {
    it("should have correct key and name", () => {
      expect(adapter.key).toBe("my-tool");
      expect(adapter.name).toBe("My Tool");
    });
  });

  describe("getPath", () => {
    it("should return correct project paths", () => {
      expect(adapter.getPath("skills", "project", "code-review")).toContain(
        ".my-tool/skills/code-review",
      );
      expect(adapter.getPath("rules", "project", "typescript")).toContain(
        ".my-tool/rules/typescript.md",
      );
      expect(adapter.getPath("memory", "project", "AGENTS.md")).toContain("AGENTS.md");
    });

    it("should return correct global paths", () => {
      expect(adapter.getPath("skills", "global", "code-review")).toContain(
        "/.my-tool/skills/code-review",
      );
    });
  });

  describe("getLegacyPaths", () => {
    it("should return empty array for all types", () => {
      expect(adapter.getLegacyPaths("rules")).toEqual([]);
      expect(adapter.getLegacyPaths("skills")).toEqual([]);
      expect(adapter.getLegacyPaths("memory")).toEqual([]);
    });
  });

  describe("transformSkill", () => {
    it("should return skill unchanged", () => {
      const skill: SkillDir = {
        name: "code-review",
        skillFile: "/path/to/SKILL.md",
        files: ["/path/to/SKILL.md"],
      };
      expect(adapter.transformSkill(skill)).toBe(skill);
    });
  });

  describe("transformRule", () => {
    it("should return rule unchanged", () => {
      const rule: RuleFile = {
        name: "test-rule",
        content: "Rule content",
        frontmatter: {},
      };
      expect(adapter.transformRule(rule)).toBe(rule);
    });
  });

  describe("transformMemory", () => {
    it("should convert MEMORY.md to AGENTS.md", () => {
      const memory: MemoryFile = { filename: "MEMORY.md", content: "Content" };
      const transformed = adapter.transformMemory(memory);
      expect(transformed.filename).toBe("AGENTS.md");
      expect(transformed.content).toBe("Content");
    });

    it("should keep explicit filenames unchanged", () => {
      const memory: MemoryFile = { filename: "CLAUDE.md", content: "Content" };
      expect(adapter.transformMemory(memory).filename).toBe("CLAUDE.md");
    });
  });

  describe("transformCommand", () => {
    it("should return command unchanged", () => {
      const command: CommandFile = { name: "review", content: "Command" };
      expect(adapter.transformCommand(command)).toBe(command);
    });
  });
});
```

## Step 5: Update Documentation

**File**: `docs/08-ai-tools-reference.md`

Add the new tool to the tools table and create a detail section with paths, memory file, rule format, detection, and legacy paths.

## Step 6: Verify

Run in order:

```bash
# 1. Type check
bun run typecheck

# 2. Run tests
bun run test

# 3. Lint
bun run lint

# 4. Dead code check
bun run dead-code
```

## Checklist

- [ ] Path config added to `AGENT_PATHS` in `packages/agent-paths/src/registry.ts`
- [ ] Adapter class created in `packages/core/src/adapters/<key>.ts`
- [ ] Adapter imported and registered in `packages/core/src/adapters/registry.ts`
- [ ] Tests created in `packages/core/src/adapters/<key>.test.ts`
- [ ] `transformMemory()` maps `MEMORY.md` to tool's memory filename
- [ ] `transformRule()` handles any tool-specific format (if needed)
- [ ] `getLegacyPaths()` returns legacy paths (if any)
- [ ] `detection` array in path config has correct CLI binary and config dir
- [ ] Documentation updated in `docs/08-ai-tools-reference.md`
- [ ] All tests pass (`bun run test`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] No lint errors (`bun run lint`)
