# Troubleshooting

Common issues and solutions when using Baton.

## Authentication errors for private repos

**Symptoms:** `baton init`, `baton sync`, `baton apply`, or `baton diff` fails with "No authentication found for …" when using a private source repository.

**How Baton resolves auth:** Baton automatically detects credentials using an auth cascade — it never prompts interactively and never hangs. The cascade checks these sources in order:

1. **Environment variables** — `GITHUB_TOKEN`, `GH_TOKEN`, or `BATON_GIT_TOKEN`
2. **Git credential helper** — queries your system credential store via `git credential fill` (macOS Keychain, Windows Credential Manager, GitHub CLI credential helper, etc.)
3. **GitHub CLI** — runs `gh auth token` (GitHub hosts only)
4. **SSH keys** — looks for `~/.ssh/id_*` keys and verifies connectivity

If none succeed, Baton shows a clear error with setup instructions and which methods were attempted.

### Solutions

1. **GitHub CLI (recommended):**

   ```bash
   gh auth login
   gh auth setup-git
   ```

   `gh auth setup-git` registers the GitHub CLI as a git credential helper, so `git credential fill` picks up the token automatically. This is the fastest and most reliable path.

2. **SSH key:**

   If you have SSH keys, Baton auto-detects them. To add one:

   ```bash
   ssh-keygen -t ed25519
   ssh-add
   ```

   Then add the public key to your Git host. You can also use SSH source URLs explicitly:

   ```yaml
   # baton.yaml
   profiles:
     - source: git:git@github.com:org/repo.git
   ```

3. **Environment variable:**

   ```bash
   # GitHub
   export GITHUB_TOKEN=ghp_your_token_here
   # or
   export GH_TOKEN=ghp_your_token_here

   # Other Git hosts
   export BATON_GIT_TOKEN=your_token_here
   ```

   > **Tip:** Running `export TOKEN=...` in an interactive shell writes the token to your shell history. To avoid this, add the export to `~/.zshenv` (zsh) or `~/.bash_profile` (bash) instead.

4. **For public repos hitting rate limits:**

   Even public repos can trigger auth failures when GitHub rate-limits unauthenticated requests. Setting up any form of authentication (steps 1-3) resolves this.

### How to diagnose

Use `baton auth status` to see which auth methods are available:

```bash
baton auth status
baton auth status --hostname gitlab.example.com
```

This runs the full auth cascade and shows the status of each method, helping you identify what's configured and what's missing.

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
