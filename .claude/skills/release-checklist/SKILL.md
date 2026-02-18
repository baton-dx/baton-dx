---
name: release-checklist
description: Walk through the full Baton release process — version bumps, testing, CHANGELOG, git tags, npm publish, and Homebrew formula update. Use when preparing a new release.
allowed-tools: Read, Edit, Bash, Grep, Glob
argument-hint: <version> (e.g., "0.2.0", "patch", "minor")
---

# Release Checklist

Complete release workflow for the Baton monorepo. Follow each step in order.

## Step 1: Pre-Release Validation

Run all checks to ensure the codebase is in a releasable state:

```bash
# Type check
bun run typecheck

# Run full test suite
bun run test

# Lint check
bun run lint

# Dead code check
bun run dead-code
```

All must pass with zero errors before proceeding.

## Step 2: Determine Version

Follow [Semantic Versioning](https://semver.org/):
- **patch** (0.1.x): Bug fixes, no new features
- **minor** (0.x.0): New features, backward compatible (new adapters, commands, merge strategies)
- **major** (x.0.0): Breaking changes (schema changes, removed commands, API changes)

Check what changed since last release:
```bash
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~50)..HEAD
```

## Step 3: Update Version Numbers

Update version in all package.json files:

```bash
# Root
# packages/cli/package.json
# packages/core/package.json
# packages/agent-paths/package.json
```

Ensure workspace dependency versions are updated if packages reference each other:
```bash
grep -rn "@baton-dx/" packages/*/package.json
```

## Step 4: Update CHANGELOG.md

Move items from `[Unreleased]` to a new version section:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...
```

Categories to use (only include sections with content):
- **Added**: New features, new adapters, new commands
- **Changed**: Changes in existing functionality
- **Deprecated**: Features that will be removed in future versions
- **Removed**: Removed features or commands
- **Fixed**: Bug fixes
- **Security**: Security-related fixes

## Step 5: Build and Verify

```bash
# Clean build
rm -rf packages/*/dist
bun run build

# Verify CLI works from built output
node packages/cli/dist/index.js --version
node packages/cli/dist/index.js --help
```

## Step 6: Commit and Tag

```bash
# Stage all version changes
git add package.json packages/*/package.json CHANGELOG.md

# Commit
git commit -m "chore: release vX.Y.Z"

# Create annotated tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

## Step 7: Push

```bash
git push origin main --tags
```

## Step 8: Publish to npm

Publish packages in dependency order:

```bash
# 1. agent-paths first (no internal deps)
cd packages/agent-paths && npm publish --access public && cd ../..

# 2. core second (depends on agent-paths)
cd packages/core && npm publish --access public && cd ../..

# 3. cli last (depends on core)
cd packages/cli && npm publish --access public && cd ../..
```

Verify published packages:
```bash
npm info @baton-dx/agent-paths version
npm info @baton-dx/core version
npm info @baton-dx/cli version
```

## Step 9: Update Homebrew Formula

**File**: `Formula/baton-dx.rb`

1. Update the `url` to point to the new npm tarball:
```ruby
url "https://registry.npmjs.org/@baton-dx/cli/-/cli-X.Y.Z.tgz"
```

2. Get the SHA256 of the published tarball:
```bash
curl -sL "https://registry.npmjs.org/@baton-dx/cli/-/cli-X.Y.Z.tgz" | shasum -a 256
```

3. Update the `sha256` in the formula.

4. Commit and push:
```bash
git add Formula/baton-dx.rb
git commit -m "chore: update homebrew formula to vX.Y.Z"
git push origin main
```

## Step 10: Create GitHub Release

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md | head -n -1)
```

Or create manually with the CHANGELOG section as release notes.

## Post-Release Checklist

- [ ] All CI checks pass on the release commit
- [ ] npm packages are accessible: `npm info @baton-dx/cli`
- [ ] Homebrew install works: `brew install baton-dx/tap/baton-dx`
- [ ] `baton --version` shows new version
- [ ] GitHub release is published with correct notes
- [ ] `[Unreleased]` section in CHANGELOG.md is empty (ready for next cycle)
