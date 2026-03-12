---
name: commit
description: Stage all changes and create a conventional commit. Use when the user asks to commit the current work.
allowed-tools: Bash
---

# Commit

1. Run `git diff --stat` to review what changed
2. Run `git add -A`
3. Write a conventional commit message (`type(scope): description`) based on the diff
4. Commit with `git commit -m "..."`

Keep the message under 72 characters. Use `feat`, `fix`, `chore`, `docs`, `refactor`, or `test` as type.
