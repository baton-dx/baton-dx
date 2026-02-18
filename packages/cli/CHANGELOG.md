# @baton-dx/cli

## 0.1.3

### Patch Changes

- [`97e9e8f`](https://github.com/baton-dx/baton-dx/commit/97e9e8f4d4b21b8f7f2b52374d4dcd64d97420a3) Thanks [@mantaray0](https://github.com/mantaray0)! - Include root README.md in published npm package via prepack script.

## 0.1.2

### Patch Changes

- [`dcc30a9`](https://github.com/baton-dx/baton-dx/commit/dcc30a9a87e2ef98144dc467f254d3c0ed766cb5) Thanks [@mantaray0](https://github.com/mantaray0)! - Bundle all workspace dependencies into CLI build for zero-dependency install. `core` and `agent-paths` are now private packages bundled via tsdown aliases. Adds `btx` as a short CLI alias.

## 0.1.1

### Patch Changes

- Fix install commands to use correct scoped package name (`@baton-dx/cli` instead of `baton-dx`) and add `btx` as a short CLI alias alongside `baton` and `baton-dx`.

- Updated dependencies []:
  - @baton-dx/agent-paths@0.1.1
  - @baton-dx/core@0.1.1
