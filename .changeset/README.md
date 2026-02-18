# Changesets

This directory is used by [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Adding a Changeset

When making changes that should be released, run:

```bash
bun changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose a bump type (patch / minor / major)
3. Write a summary of the change

The changeset file will be committed with your PR. When merged to `main`, the release workflow will automatically create a "Version Packages" PR with the version bumps and changelog entries.

## More Info

- [Changesets documentation](https://github.com/changesets/changesets)
- [Common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md)
