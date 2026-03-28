---
phase: 06-publish
plan: 01
subsystem: documentation, packaging
tags: [readme, npm-publish, versioning, docs]
dependency_graph:
  requires: []
  provides: [publish-ready-readme-core, publish-ready-readme-node, npm-compatible-version]
  affects: [packages/core/README.md, packages/node/README.md, packages/node/package.json]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - packages/core/README.md
    - packages/node/README.md
    - packages/node/package.json
decisions:
  - "Use arXiv GPT-4 paper (2303.08774) as stable quick-start example — paper is stable, URL won't change, output fields (preprint, DOI, creators) demonstrate full metadata"
  - "Replace workspace:* with ^1.0.0 in ztractor-node — workspace protocol doesn't resolve on npm registry; semver range is required for publishing"
metrics:
  duration: 68s
  completed: "2026-03-28"
  tasks_completed: 3
  files_modified: 3
---

# Phase 6 Plan 1: README Updates and Package Versioning Summary

Updated both READMEs with a stable arXiv quick-start example (GPT-4 paper, arxiv.org/abs/2303.08774), bumped ztractor-node to 1.0.0, and replaced the workspace:* dependency with ^1.0.0 for npm compatibility.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update core README with arXiv quick-start | a590abe | packages/core/README.md |
| 2 | Update node README with arXiv quick-start and XPath caveat | b7cef4d | packages/node/README.md |
| 3 | Bump ztractor-node to 1.0.0 and fix workspace dependency | 18559b0 | packages/node/package.json |

## What Was Done

**Task 1 — Core README:**
- Replaced the NYTimes placeholder URL with `https://arxiv.org/abs/2303.08774`
- Quick-start now shows realistic output: `itemType: "preprint"`, `title: "GPT-4 Technical Report"`, `creators`, `date`, `DOI`
- Simplified Node.js section to reference `ztractor-node` with `bun add`

**Task 2 — Node README:**
- Replaced the NYTimes placeholder URL with `https://arxiv.org/abs/2303.08774`
- Node.js-Specific Example updated to the same arXiv URL
- Added XPath caveat in Technical Details > DOM Implementation: "XPath support uses an xmldom bridge (XPath 1.0). XPath 2.0 is not supported."

**Task 3 — Package versioning:**
- `packages/node/package.json` version: `0.1.0` → `1.0.0`
- `packages/node/package.json` ztractor dependency: `workspace:*` → `^1.0.0`

## Decisions Made

1. **arXiv GPT-4 paper as quick-start example** — This is a stable, permanent arXiv paper URL. The output fields (preprint type, DOI with arXiv prefix, multi-author list) are ideal for demonstrating what the library returns.

2. **workspace:* replaced with ^1.0.0** — The `workspace:*` protocol is a Bun/pnpm workspace feature that resolves to the local package during development but fails on npm. Publishing requires a real semver range.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all metadata shown in quick-start examples is real output from the arXiv translator.

## Self-Check: PASSED

- packages/core/README.md: modified and committed in a590abe
- packages/node/README.md: modified and committed in b7cef4d
- packages/node/package.json: modified and committed in 18559b0
- Both READMEs contain arxiv.org/abs/2303.08774
- No nytimes URLs remain in either README
- packages/node/package.json has version 1.0.0 and ztractor ^1.0.0
