---
"@baton-dx/cli": patch
---

perf(cli): parallel source fetching with incremental sync

- Sources are now resolved in parallel with configurable concurrency (`--concurrency N`, default: 5)
- Incremental sync: `baton sync` compares remote SHA with lockfile to skip unchanged sources
- Discovery and intersection computation parallelized
- New `resolveSourcesBatch()` API in `@baton-dx/core`
