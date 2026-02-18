# GitHub Repository Setup Checklist

> Temporary document — can be deleted after completing the setup.

## A) Repository Settings → General

- [ ] **Description:** "CLI package manager for Developer Experience & AI configuration"
- [ ] **Website:** npm package URL or docs URL
- [ ] **Topics:** `cli`, `developer-experience`, `ai-tools`, `configuration-management`, `typescript`, `monorepo`
- [ ] **Features:** Issues ✅, Projects ✅, Wiki ❌ (docs are in the repo)
- [ ] **Pull Requests:** Allow merge commits ✅, Allow squash merging ✅, Allow rebase merging ❌
- [ ] **Auto-delete head branches:** ✅

## B) Branch Protection Rules → `main`

- [ ] **Require a pull request before merging:** ✅
  - [ ] Required approving reviews: **1**
  - [ ] Dismiss stale PR reviews: ✅
  - [ ] Require review from CODEOWNERS: ✅
- [ ] **Require status checks to pass before merging:** ✅
  - [ ] Required checks: `Quality Checks` (the CI workflow job name)
- [ ] **Require branches to be up to date before merging:** ✅
- [ ] **Require conversation resolution before merging:** ✅
- [ ] **Do not allow bypassing the above settings:** ❌ (maintainer may bypass for hotfixes)
- [ ] **Restrict who can push to matching branches:** ✅
  - [ ] Only maintainer team or specific users

## C) Repository Settings → Actions → General

- [ ] **Fork pull request workflows:** Require approval for first-time contributors ✅
- [ ] **Workflow permissions:** Read repository contents and packages ✅

## D) npm Organisation

- [ ] Go to https://www.npmjs.com/org/create
- [ ] Create organisation `baton-dx`
- [ ] Select "Unlimited public packages" (free)
- [ ] Create Access Token: npmjs.com → Profile → Access Tokens → Generate New Token
  - Type: **Granular Access Token**
  - Packages: `@baton-dx/*` with **Read and Write**

## E) Repository Settings → Secrets and Variables → Actions

- [ ] **`NPM_TOKEN`:** The npm access token created above

## F) Teams / Collaborators

- [ ] Create a **"maintainers"** team in the `baton-dx` organisation
- [ ] Add maintainers to the team
- [ ] Set team permission to **"Maintain"** or **"Admin"**
- [ ] In Branch Protection: reference this team

## G) GitHub Environments (optional, for enhanced release control)

- [ ] Create environment `npm-publish`
- [ ] Set **Required Reviewers:** maintainer team
- [ ] Release workflow references this environment → every release requires manual approval
