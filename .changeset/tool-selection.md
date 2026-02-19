---
"@baton-dx/cli": minor
"@baton-dx/core": minor
---

feat: developer tool & IDE selection

Allow developers to choose which AI tools and IDEs Baton configures, both globally and per-project.

- Add project preferences (.baton/preferences.yaml) with resolution chain: project overrides > global config
- Enhanced multiselect in `baton ai-tools scan` and `baton ides scan` (choose which detected tools to save)
- New `baton ai-tools configure` and `baton ides configure` commands with `--project` flag
- First-run preferences prompt in `baton init` and `baton sync`
- Project preference options in `baton manage` wizard
- Source attribution in `baton config` dashboard (shows "from global config" or "from project preferences")
- Auto-gitignore .baton/preferences.yaml
