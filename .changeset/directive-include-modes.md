---
"@baton-dx/cli": minor
---

Refactor baton:include directive modes and add link mode with hint support

- Rename `mode="merge"` to `mode="inline"` (now the default)
- Add `mode="link"` — outputs a Markdown link `[src](src)`
- Update `mode="reference"` — outputs `@src` mention (Claude Code native, plain text for other tools)
- Add `hint` attribute with `{{file}}` placeholder for `link` and `reference` modes
- Add `optional="true"` attribute to silently skip missing files
