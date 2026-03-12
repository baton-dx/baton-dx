---
"@baton-dx/cli": major
---

Convention-over-configuration: content auto-discovered from filesystem, merge strategies simplified to concat/replace, directive system expanded with else/expressions/conditions, preview command added.

BREAKING CHANGES:
- Profile manifests no longer declare content (ai.rules, ai.skills, ai.agents, ai.memory, ai.commands, ai.mcp, files, ide removed)
- Content is auto-discovered from the profile filesystem (ai/rules/*.md, ai/skills/*/SKILL.md, etc.)
- Source manifests no longer declare profiles (profiles are auto-discovered from profiles/ directory)
- Merge strategies reduced from 8 to 2: only "concat" (default) and "replace"
- Legacy merge functions removed without backward compatibility

New features:
- baton:else directive for conditional content
- Expression-based conditions (AND, OR, NOT, parentheses)
- Condition registry with tool, ide, scope, type, file, has, variable conditions
- baton preview command for inspecting processed output per AI tool
- Filesystem discovery for convention-over-configuration
- Frontmatter parser for Baton-specific keys (scope, merge, globs, etc.)
- Explain mode for directive debugging
