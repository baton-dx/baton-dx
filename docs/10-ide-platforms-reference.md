# IDE Platforms Reference

Baton can place IDE-specific settings and configurations alongside AI tool configs.

## Supported Platforms

| Platform | Key | Target Directory | Detection |
|----------|-----|-----------------|-----------|
| VS Code | `vscode` | `.vscode/` | `code` binary, `~/.vscode/` |
| JetBrains | `jetbrains` | `.idea/` | `idea` binary, `~/.config/JetBrains/` |
| Cursor | `cursor` | `.cursor/` | `cursor` binary, `~/.cursor/` |
| Windsurf | `windsurf` | `.windsurf/` | `windsurf` binary, `~/.windsurf/` |
| Antigravity | `antigravity` | `.antigravity/` | `antigravity` binary, `~/.antigravity/` |
| Zed | `zed` | `.config/zed/` | `zed` binary, `~/.config/zed/` |

## Detection

Run `baton ides scan` to detect installed IDE platforms. Detection checks for:

1. **CLI binary** in `PATH`
2. **Config directory** in the user's home directory

## Configuring IDE Settings in Profiles

In a profile manifest (`baton.profile.yaml`), define IDE settings:

```yaml
ide:
  vscode:
    settings: ide/vscode/settings.json
    extensions: ide/vscode/extensions.json
  jetbrains:
    settings: ide/jetbrains/settings.xml
```

The `settings` and `extensions` paths are relative to the profile directory.

## Profile Directory Structure

```
my-profile/
├── ide/
│   ├── vscode/
│   │   ├── settings.json
│   │   └── extensions.json
│   ├── jetbrains/
│   │   └── settings.xml
│   └── zed/
│       └── settings.json
└── baton.profile.yaml
```

## Common IDE Settings

### VS Code

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### VS Code Extensions

```json
{
  "recommendations": [
    "biomejs.biome",
    "dbaeumer.vscode-eslint"
  ]
}
```

These files are placed into the project's `.vscode/` directory during `baton sync`.
