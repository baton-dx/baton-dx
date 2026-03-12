# Baton 1.0.0 — Manual Test Plan

## Prerequisites

1. Build from source: `bun run build`
2. Link locally: `cd packages/cli && bun link`
3. Verify: `baton --version` → shows `1.0.0-alpha.x` or `1.0.0-rc.x`
4. Prepare a test source repo (or use an existing one with 1.0 conventions)

---

## 1. Installation & Self-Update

- [ ] `baton --version` shows correct version
- [ ] `baton --help` shows all commands (no `update` command)
- [ ] `baton self-update --changelog` shows changelog
- [ ] `baton self-update --dry-run` shows what would happen

## 2. Source Management

### 2.1 source create
- [ ] `baton source create` scaffolds `baton.source.yaml` **without** `profiles` field
- [ ] Generated YAML is valid: `baton source validate`

### 2.2 source validate
- [ ] Valid source with profiles in `profiles/` → no errors
- [ ] Source with `profiles:` field in YAML → emits legacy field error
- [ ] Source with invalid profile manifests → reports errors
- [ ] Source with `extends` loop → reports circular inheritance error
- [ ] Source with weight conflicts → reports warnings

### 2.3 source list / connect / disconnect
- [ ] `baton source list` shows global sources
- [ ] `baton source connect <url>` adds a source
- [ ] `baton source disconnect <name>` removes a source

## 3. Profile Management

### 3.1 profile create
- [ ] `baton profile create` scaffolds correct directory structure:
  ```
  profiles/<name>/
  ├── baton.profile.yaml
  ├── ai/
  │   ├── rules/.gitkeep
  │   ├── agents/.gitkeep
  │   ├── skills/.gitkeep
  │   ├── commands/.gitkeep
  │   ├── memory/.gitkeep
  │   └── mcp/.gitkeep
  ├── files/.gitkeep
  └── ide/.gitkeep
  ```
- [ ] Generated `baton.profile.yaml` has no content declarations (no `ai.rules`, etc.)

### 3.2 profile list / remove
- [ ] `baton profile list` shows profiles from project manifest
- [ ] `baton profile remove` removes a profile entry

## 4. Init & Config

### 4.1 baton init
- [ ] `baton init` with a git source → clones, discovers profiles, shows selection
- [ ] `baton init` with a local source → discovers profiles
- [ ] `baton init` with npm source → resolves and discovers profiles
- [ ] Generated `baton.yaml` is valid
- [ ] `baton init --yes --profile <source>` non-interactive mode works

### 4.2 baton config
- [ ] `baton config` shows dashboard
- [ ] `baton config set` modifies settings

## 5. AI Tools & IDE Detection

### 5.1 ai-tools
- [ ] `baton ai-tools scan` detects installed AI tools
- [ ] `baton ai-tools list` shows all supported tools (14 tools)
- [ ] `baton ai-tools configure` sets global AI tool preferences

### 5.2 ides
- [ ] `baton ides scan` detects installed IDEs
- [ ] `baton ides list` shows all supported platforms
- [ ] `baton ides configure` sets global IDE preferences

## 6. Sync Pipeline

### 6.1 baton sync (core)
- [ ] `baton sync` with local source → discovers content from filesystem
- [ ] `baton sync` with git source → clones, discovers, syncs
- [ ] `baton sync` with npm source → resolves, discovers, syncs
- [ ] Memory files placed correctly for each AI tool
- [ ] Rules placed correctly (per-tool paths)
- [ ] Skills directories copied correctly
- [ ] Agents placed correctly
- [ ] Commands placed correctly
- [ ] MCP servers configured correctly
- [ ] Files copied to correct targets
- [ ] IDE configs placed for detected IDEs
- [ ] Gitignore updated with managed section
- [ ] State file (`.baton/state.yaml`) updated correctly
- [ ] Lockfile (`baton.lock`) updated correctly

### 6.2 baton sync (flags)
- [ ] `baton sync --dry-run` shows changes without writing
- [ ] `baton sync --check` returns non-zero if changes needed
- [ ] `baton sync --verbose` shows detailed output
- [ ] `baton sync --category ai-tools` syncs only AI tool configs
- [ ] `baton sync --category ides` syncs only IDE configs
- [ ] `baton sync --category files` syncs only files
- [ ] `baton sync --yes` skips all prompts

### 6.3 Profile inheritance
- [ ] Profile with `extends: base` resolves and merges correctly
- [ ] Weight ordering: higher-weight profile overrides lower
- [ ] Locked profiles (weight: -1) cannot be overridden

### 6.4 Multiple profiles
- [ ] Two profiles with overlapping rules → `concat` merges correctly
- [ ] Two profiles with `merge: replace` → last-wins behavior
- [ ] Skills from multiple profiles both appear

## 7. Apply Pipeline

### 7.1 baton apply
- [ ] `baton apply` uses lockfile (no network)
- [ ] `baton apply --dry-run` shows changes
- [ ] `baton apply --check` checks for drift
- [ ] Apply produces same result as sync (deterministic)

## 8. Diff

- [ ] `baton diff` shows differences between local and remote
- [ ] `baton diff --nameOnly` shows only file names

## 9. Preview Command

### 9.1 Basic preview
- [ ] `baton preview --tool claude-code` shows processed output
- [ ] `baton preview --tool cursor` shows cursor-adapted output
- [ ] Output differs between tools (paths, format)

### 9.2 Filtered preview
- [ ] `baton preview --tool claude-code --type memory` shows only memory
- [ ] `baton preview --tool claude-code --type rules` shows only rules
- [ ] `baton preview --tool claude-code --type skills` shows only skills
- [ ] `baton preview --tool claude-code --type agents` shows only agents
- [ ] `baton preview --tool claude-code --type commands` shows only commands

### 9.3 Diff mode
- [ ] `baton preview --tool claude-code --diff cursor` shows differences
- [ ] Same content between tools → "No differences" message

## 10. Directives

### 10.1 baton:if / baton:endif
- [ ] `<!-- baton:if tool="claude-code" -->` includes content for Claude Code
- [ ] `<!-- baton:if tool="cursor" -->` excludes content when tool is Claude Code
- [ ] Multiple tools: `<!-- baton:if tool="claude-code,cursor" -->` OR logic

### 10.2 baton:else
- [ ] `<!-- baton:if tool="claude-code" -->A<!-- baton:else -->B<!-- baton:endif -->`
  - Claude Code sees A, Cursor sees B
- [ ] Nested if/else blocks work correctly

### 10.3 Expression conditions
- [ ] `<!-- baton:if expr="tool('claude-code') AND scope('project')" -->` evaluates correctly
- [ ] `OR`, `NOT`, parentheses work
- [ ] Condition types: `tool()`, `ide()`, `scope()`, `type()`, `file()`, `has()`, `variable()`

### 10.4 baton:include
- [ ] `<!-- baton:include src="fragment.md" -->` inlines content
- [ ] `<!-- baton:include src="fragment.md" mode="link" -->` creates link
- [ ] `<!-- baton:include src="fragment.md" mode="reference" -->` creates reference
- [ ] Missing include files → warning (not error)
- [ ] Includes inside code blocks → ignored

### 10.5 Directives in code blocks
- [ ] Directives inside ``` fenced blocks are NOT processed
- [ ] Directives inside ~~~ fenced blocks are NOT processed

## 11. Variable Substitution

- [ ] `${VAR_NAME}` in content files gets substituted
- [ ] Variables from `baton.yaml` `variables:` section work
- [ ] Variables from profile `variables:` section work
- [ ] Unset variables → warning or remain as-is

## 12. Authentication

- [ ] `baton auth status` shows auth diagnostics
- [ ] Private GitHub repo → auth cascade works (gh CLI, git credential, SSH)
- [ ] Private GitLab repo → auth works
- [ ] Auth failure → clear error message with setup instructions

## 13. Manage Wizard

- [ ] `baton manage` shows interactive menu
- [ ] Add profile → profile selection works
- [ ] Remove profile → removes correctly
- [ ] Configure gitignore → updates .gitignore
- [ ] Remove Baton → cleans up all files

## 14. Edge Cases

- [ ] Empty profile (no content files) → syncs without errors
- [ ] Profile with only MCP servers → MCP configured correctly
- [ ] Source with single profile → works without profiles/ nesting
- [ ] Very large content files → no performance issues
- [ ] Unicode in content files → preserved correctly
- [ ] Binary files in `files/` → copied correctly (not processed as text)
- [ ] Stale lockfile → `baton sync` updates it
- [ ] Missing baton.yaml → clear error message
- [ ] Invalid baton.yaml → clear error message with schema details

## 15. Legacy Detection

- [ ] Profile manifest with `ai.rules` → clear error pointing to migration guide
- [ ] Profile manifest with `files` → clear error pointing to migration guide
- [ ] Source manifest with `profiles` → clear error pointing to migration guide
- [ ] Old merge strategies in frontmatter → clear error

## 16. Gitignore Management

- [ ] AI tool config files added to .gitignore managed section
- [ ] IDE config files added to .gitignore managed section
- [ ] Files from `files/` NOT added to .gitignore (unless configured)
- [ ] Managed section markers present and correct
- [ ] Existing .gitignore content preserved

## Completion Criteria

All checkboxes above must be checked. Any failure must be fixed before the stable 1.0.0 release.

After all tests pass:
1. Exit prerelease mode: `bun changeset pre exit`
2. Create final changeset: `bun changeset` (major)
3. Version: `bun changeset version` → 1.0.0
4. Commit, PR, merge → automated release to npm + Homebrew
