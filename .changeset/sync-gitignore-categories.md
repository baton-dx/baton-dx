---
"@baton-dx/cli": minor
"@baton-dx/core": minor
---

feat: granular gitignore categories, categorized state.yaml, and remove-baton fixes

- Add granular `gitignore` config: `{ ai-tools, ides, files }` object form alongside existing boolean (backward-compatible)
- `.gitignore` managed block now uses `## category` section headers for ai-tools, ides, and files
- `state.yaml` `placed_files` is now categorized by type (`ai-tools`, `ides`, `files`) instead of a flat array
- `baton manage → Configure .gitignore` immediately applies changes to `.gitignore` (no sync required)
- `baton manage → Remove Baton` now also removes the `.baton/` directory
- `baton init` uses multiselect for gitignore categories (ai-tools ✓, ides ✓, files ✗ default)
- Add `parseGitignoreConfig`, `collectAiToolPatterns`, `collectIdePatterns`, `collectFilePatterns`, `updateGitignoreWithSections`, `flattenPlacedFiles` to core exports
