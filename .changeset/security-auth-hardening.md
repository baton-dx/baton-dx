---
"@baton-dx/cli": patch
---

Harden git authentication: tokens are no longer embedded in clone URLs (injected via scoped HTTP header env vars instead), preventing leakage in error messages, logs, and cached .git/config files. SSH connectivity checks use ephemeral known_hosts, hostnames are validated before use, and child process timeouts use SIGKILL.
