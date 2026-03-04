---
"@baton-dx/core": patch
---

fix(core): resolve ai.tools wildcard when profile has AI content but no explicit tools

Profiles with AI content (skills, rules, agents, memory, mcp, commands) but no `ai.tools` declaration
now resolve to all registered AI tools instead of an empty list. This fixes "No AI tools in intersection"
failures for profiles that omit the optional `ai.tools` field.

- Add implicit wildcard: profiles with AI content but no `ai.tools` target all tools
- Add explicit `["*"]` wildcard support in both source and profile manifests
- Source `ai.tools` serves as default for all profiles; individual profiles can override
- Validation skips `"*"` in unknown-tool-key checks
