---
"@baton-dx/cli": minor
---

Redesign detection system for AI tools and IDEs to eliminate false positives

- Replace flat OR-based detection with structured DetectionConfig using OR-of-ANDs evaluation logic
- Add 5 detection mechanisms: binary (with version verification), directory (with marker files), macOS app bundles, VS Code extensions, JetBrains plugins
- Fix false positives: GitHub Copilot no longer detected from `gh` CLI, leftover directories no longer trigger detection without marker files, binary name collisions prevented via version pattern matching
- Add cross-platform support for binary lookup (`which` on Unix, `where` on Windows)
- Populate detection configs for all 14 AI tools and 6 IDE platforms
- Remove legacy `detection: string[]` field in favor of typed `detectionConfig`
- Consolidate shared detection helpers into single `mechanisms.ts` module
