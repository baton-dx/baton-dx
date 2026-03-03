# Troubleshooting

Common issues and solutions when using Baton.

## Git operations hang (spinner never stops)

**Symptoms:** Running `baton init`, `baton sync`, `baton apply`, or `baton diff` with a GitHub/GitLab source causes the CLI to hang — the spinner keeps spinning but nothing happens.

**Cause:** The source repository requires authentication (private repo, or rate-limited), but no git credentials are available. Git tries to prompt for a username/password, but the prompt is hidden behind Baton's spinner.

**Since v0.x.x:** Baton automatically detects this condition, stops the spinner, and shows `Authentication required` so your credential manager or browser OAuth flow can run.

**If you're on an older version**, or the auto-detection doesn't trigger:

### Solutions

1. **Set up a GitHub personal access token (recommended):**

   ```bash
   # Store token in git credential manager
   gh auth login
   # or
   git config --global credential.helper store
   ```

2. **Use SSH instead of HTTPS:**

   Update your source string to use SSH:
   ```yaml
   # baton.yaml
   profiles:
     - source: git:git@github.com:org/repo.git
   ```

3. **Set `GITHUB_TOKEN` environment variable:**

   ```bash
   export GITHUB_TOKEN=ghp_your_token_here
   ```

4. **For public repos hitting rate limits:**

   Even public repos can trigger auth prompts when GitHub rate-limits unauthenticated requests. Setting up any form of authentication (steps 1-3) resolves this.

### How to diagnose

To verify the issue is auth-related:

```bash
# Test if git can access the repo without prompting
GIT_TERMINAL_PROMPT=0 git ls-remote https://github.com/org/repo.git

# If this fails with "terminal prompts disabled", authentication is the issue
```

## Git not installed

**Symptoms:** `baton init` or `baton sync` fails immediately with a `GIT_NOT_INSTALLED_ERROR`.

**Solution:** Install git:

```bash
# macOS
xcode-select --install
# or
brew install git

# Ubuntu/Debian
sudo apt install git

# Windows
winget install Git.Git
```

## Cache issues

**Symptoms:** `baton sync` uses outdated profile content even after the source repo was updated.

**Solution:** Clear the Baton cache and sync fresh:

```bash
rm -rf ~/.baton/cache
baton sync
```

Or use the `--fresh` flag with `baton apply`:

```bash
baton apply --fresh
```
