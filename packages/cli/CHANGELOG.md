# @baton-dx/cli

## 0.1.2

### Patch Changes

- [`dcc30a9`](https://github.com/baton-dx/baton-dx/commit/dcc30a9a87e2ef98144dc467f254d3c0ed766cb5) Thanks [@mantaray0](https://github.com/mantaray0)! - Bundle all workspace dependencies into CLI build for zero-dependency install. `core` and `agent-paths` are now private packages bundled via tsdown aliases. Adds `btx` as a short CLI alias.

## 0.1.1

### Patch Changes

- Fix install commands to use correct scoped package name (`@baton-dx/cli` instead of `baton-dx`) and add `btx` as a short CLI alias alongside `baton` and `baton-dx`.

- Updated dependencies []:
  - @baton-dx/agent-paths@0.1.1
  - @baton-dx/core@0.1.1
