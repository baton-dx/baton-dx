---
"@baton-dx/core": patch
---

Default to all AI tools when no `ai.tools` is declared in profile or source manifest

In Baton 1.0, AI content (skills, rules, agents, memory) is auto-discovered from the filesystem — it is no longer declared in the manifest YAML. The previous `hasAiContent()` check looked at the manifest's `ai` field to decide whether to apply the implicit wildcard, but profiles using convention-over-configuration have no `ai:` section in their YAML at all. This caused the intersection to resolve to zero tools, blocking sync with "No AI tools in intersection".

Now, when neither the profile nor the source manifest declares `ai.tools`, the default is all registered tools (implicit wildcard). To explicitly opt out, set `ai.tools: []`.
