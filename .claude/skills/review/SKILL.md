---
name: review
description: Run a comprehensive code review covering dead code, redundancy, best practices, and security for the Baton CLI monorepo. Use when the user asks for a full review, audit, or quality check of the project.
allowed-tools: Read, Grep, Glob, Bash
model: opus
---

# Comprehensive Code Review

Run a full project audit combining dead code detection, redundancy analysis, and best practice enforcement for the Baton CLI monorepo.

## Phase 1: Dead Code Analysis
Run `bun run dead-code 2>&1` and parse the results. Then manually check for:
- Unused adapters, schemas, commands, and utility functions
- Refer to the [dead-code skill](../dead-code/SKILL.md) for the full checklist

## Phase 2: Redundancy Scan
Search for duplicate logic, near-identical adapter implementations, and consolidation opportunities.
- Refer to the [redundancy-finder skill](../redundancy-finder/SKILL.md) for patterns to check

## Phase 3: Best Practices & Security
Review code against stack conventions:
- Refer to the [code-reviewer skill](../code-reviewer/SKILL.md) for the full checklist
- Check the [CLI patterns checklist](./checklists/cli-patterns.md)
- Check the [core conventions checklist](./checklists/core-conventions.md)

## Phase 4: Compile Report

Save findings to `.claude/reports/review-YYYY-MM-DD.md` with this structure:

```markdown
# Code Review Report — [Date]

## Summary
- Total findings: X
- Blockers: X | High: X | Medium: X
- Estimated cleanup effort: X hours

## Blockers (must fix)
...

## High Priority
...

## Medium Priority (suggestions)
...

## Good Practices Observed
...

## Dead Code Summary
- Unused files: X
- Unused exports: X
- Unused dependencies: X

## Redundancy Summary
- Exact duplicates: X
- Near-identical patterns: X
- Consolidation opportunities: X
```
