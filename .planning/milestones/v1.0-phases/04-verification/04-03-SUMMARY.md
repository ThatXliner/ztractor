---
phase: 04-verification
plan: 03
subsystem: testing
tags: [bun, bunfig, test-setup, preload]

# Dependency graph
requires:
  - phase: 04-verification
    provides: packages/core/tests/setup.ts (DOMParser and document globals for tests)
provides:
  - Root-level bunfig.toml with test preload so `bun test packages/core/` from repo root exits 0
affects: [04-verification, ci]

# Tech tracking
tech-stack:
  added: []
  patterns: [Root bunfig.toml mirrors package-level config with repo-root-relative path]

key-files:
  created: [bunfig.toml]
  modified: []

key-decisions:
  - "Root bunfig.toml uses repo-root-relative path (./packages/core/tests/setup.ts) to fix bun test packages/core/ from repo root without modifying the package-level bunfig.toml"

patterns-established:
  - "Monorepo bunfig pattern: root bunfig.toml with repo-root-relative preload path mirrors package bunfig.toml; both configs coexist"

requirements-completed: [VERIFY-02]

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 04 Plan 03: Root bunfig.toml for repo-root test invocation Summary

**Root-level bunfig.toml with `./packages/core/tests/setup.ts` preload so `bun test packages/core/` from repo root exits 0 (212 pass, 0 fail)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-27T21:06:54Z
- **Completed:** 2026-03-27T21:08:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created root-level `bunfig.toml` with a `[test]` section that preloads `packages/core/tests/setup.ts`
- Fixed 35 previously-failing tests (missing `DOMParser`/`document` globals) when invoking from repo root
- Package-level `cd packages/core && bun test` continues to work unchanged (still 212 pass, 0 fail)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create root-level bunfig.toml with test preload** - `b0d8f8b` (chore)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `bunfig.toml` — Root-level Bun test configuration; preloads `./packages/core/tests/setup.ts` so that `bun test packages/core/` from the monorepo root sets up DOMParser and document globals

## Decisions Made
- Root bunfig.toml uses a repo-root-relative path (`./packages/core/tests/setup.ts`) — mirroring the existing `packages/core/bunfig.toml` entry but adjusted for the working directory when Bun is invoked from the monorepo root. The package-level bunfig.toml was left untouched.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VERIFY-02 acceptance criterion met: `bun test packages/core/` from repo root exits 0
- Ready to proceed with plan 04 (04-04) if applicable

## Self-Check: PASSED
- `bunfig.toml` exists at repo root: FOUND
- Commit `b0d8f8b` exists: FOUND
- `bun test packages/core/` from repo root: 212 pass, 0 fail, 5 skip

---
*Phase: 04-verification*
*Completed: 2026-03-27*
