---
"@baton-dx/cli": patch
---

Fix "No AI tools in intersection" for users without system-level git credentials by adding auth cascade to `buildIntersection`. Previously, intersection computation re-cloned repos without authentication, silently failing for private repositories. Also adds verbose logging for intersection errors.
