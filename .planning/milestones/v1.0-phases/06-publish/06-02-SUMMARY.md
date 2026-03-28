---
phase: 06-publish
plan: 02
subsystem: build, packaging, publishing
tags: [build, npm-publish, dist, verification, publish-checklist]
dependency_graph:
  requires: [06-01]
  provides: [publish-ready-build, fresh-dist, publish-checklist]
  affects:
    - packages/core/dist/
    - packages/node/dist/
    - packages/core/README.md
    - packages/node/README.md
    - packages/node/package.json
tech_stack:
  added: []
  patterns:
    - "npm pack --dry-run for publish file verification"
    - "git submodule update --init for worktree submodule setup"
key_files:
  created: []
  modified:
    - packages/core/README.md
    - packages/node/README.md
    - packages/node/package.json
decisions:
  - "Applied 06-01 README and version fixes to main branch (worktree was on main, not rewrite)"
  - "ztractor-node 0.1.0 -> 1.0.0 and workspace:* -> ^1.0.0 applied as Rule 3 blocking fix"
metrics:
  duration: ~5min
  completed: "2026-03-28"
  tasks_completed: 2
  files_modified: 3
---

# Phase 6 Plan 2: Build Verification and Publish Checklist Summary

Both packages build cleanly with 682 bundled translators, 244 tests pass (0 fail), dist artifacts are fresh for both core and node, npm pack dry-run confirms correct file lists, and both packages are at version 1.0.0 and ready to publish.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build both packages and run all tests | cd7ce89 | packages/core/README.md, packages/node/README.md, packages/node/package.json |
| 2 | Write publish instructions in plan summary | (this file) | .planning/phases/06-publish/06-02-SUMMARY.md |

## What Was Done

**Task 1 — Build and Verification:**

- Initialized the `translators` git submodule (was empty in worktree) — 742 translator files found, 682 web translators bundled
- Built both packages from repo root with `bun run build`
  - core: 7.82 MB total output (includes 7.75 MB translator registry chunk)
  - node: 13.26 KB total output
- Ran `bun test`: **244 pass, 0 fail** across 8 test files
- Verified `node -e "import(...)"` resolves exports for both packages
  - core exports: `Item, ZU, executeDetectWeb, executeDoWeb, extractMetadata`
  - node exports: `BundledRegistry, HTTPRegistry, Item, ZU, executeDetectWeb`
- `npm pack --dry-run` for both packages: only dist/ + package.json + LICENSE + README listed
  - `ztractor@1.0.0` — 2.0 MB packed, 8.2 MB unpacked, 7 files
  - `ztractor-node@1.0.0` — 17.9 KB packed, 53.5 KB unpacked, 5 files

**Task 2 — Publish Checklist:**

Documented in the "Publish Checklist" section below.

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — Blocking)

**1. [Rule 3 - Blocking] ztractor-node version and workspace dependency**
- **Found during:** Task 1 (npm pack --dry-run showed 0.1.0 and workspace:* dependency)
- **Issue:** This worktree is based on `main` branch; the 06-01 version bump (0.1.0 -> 1.0.0) and workspace:* fix (-> ^1.0.0) were committed on the `rewrite` branch but never merged to `main`. The `workspace:*` protocol fails on npm registry — packages cannot be published with it.
- **Fix:** Applied both changes directly: bumped ztractor-node to 1.0.0, replaced `workspace:*` with `^1.0.0` in dependencies
- **Files modified:** packages/node/package.json
- **Commit:** cd7ce89

**2. [Rule 3 - Blocking] README NYTimes placeholder URLs**
- **Found during:** Task 1 (checking publish-readiness)
- **Issue:** Both READMEs still had `https://www.nytimes.com/2024/01/15/technology/example.html` placeholder (06-01 arXiv updates were on `rewrite` branch, not `main`)
- **Fix:** Updated both READMEs with arXiv quick-start example (2303.08774, GPT-4 Technical Report)
- **Files modified:** packages/core/README.md, packages/node/README.md
- **Commit:** cd7ce89

**3. [Rule 3 - Blocking] Translators submodule not initialized in worktree**
- **Found during:** First build attempt (0 translator files found)
- **Issue:** Git worktrees don't automatically inherit submodule checkouts; `packages/core/translators/` was empty
- **Fix:** Ran `git submodule update --init` from worktree root — cloned translators at commit ee1746de
- **Impact:** Without this, all translator-related tests fail and the registry generates empty (0 translators)
- **Commit:** N/A — submodule checkout, not committed

## Publish Checklist

Prerequisites:
- [ ] Run `npm login` (if not already logged in)
- [ ] Verify you're on the correct npm account: `npm whoami`

Publish core package first (node depends on it):
- [ ] `cd packages/core && npm publish`
- [ ] Verify: `npm view ztractor version` should show `1.0.0`

Then publish node package:
- [ ] `cd packages/node && npm publish`
- [ ] Verify: `npm view ztractor-node version` should show `1.0.0`

Post-publish verification:
- [ ] `mkdir /tmp/ztractor-test && cd /tmp/ztractor-test && npm init -y && npm install ztractor-node`
- [ ] Create test.mjs with the quick-start example from the README
- [ ] `node test.mjs` should extract metadata from the arXiv URL

## Known Stubs

None — all dist artifacts are built from source with real translators.

## Self-Check

- packages/core/dist/index.js: FOUND
- packages/core/dist/index.d.ts: FOUND
- packages/node/dist/index.js: FOUND
- packages/node/dist/index.d.ts: FOUND
- Commit cd7ce89: FOUND (confirmed via git rev-parse)
- 244 tests pass, 0 fail
- Both packages version 1.0.0
- ztractor-node dependency: ztractor ^1.0.0 (no workspace:*)

## Self-Check: PASSED
