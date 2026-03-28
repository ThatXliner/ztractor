---
phase: 04-verification
plan: 01
subsystem: testing
tags: [sandbox, translator, executor, DOMParser, unhandled-rejection]

# Dependency graph
requires:
  - phase: 03-sandbox-advanced-flows
    provides: createTranslatorLoader, getTranslatorObject, loadTranslator implementation
provides:
  - Bug-fixed TranslatorExecutor with try-catch wrapped callbacks in getTranslatorObject
  - DOMParser injected into detectWeb, doWeb, and embedded translator Function contexts
  - Correct dependencies default via nullish coalescing in TranslatorExecutor constructor
affects: [04-02-live-translator-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Wrap every callback() call inside getTranslatorObject with try-catch to prevent unhandled rejections from user-provided callbacks that throw

key-files:
  created: []
  modified:
    - packages/core/src/translator-system-modern.ts

key-decisions:
  - "Wrap all callback() invocations in getTranslatorObject with individual try-catch blocks — user callbacks receiving empty objects from missing embedded translators may throw, which must be silently swallowed"
  - "Inject DOMParser as Function parameter rather than relying on global scope — ensures consistent availability across browser, Bun, and production Node.js contexts"
  - "Use nullish coalescing (options.dependencies ??) instead of spread-first default — prevents undefined from overriding the DOMParser default when extractMetadata passes dependencies: undefined"

patterns-established:
  - "Pattern: All callback invocations in async Zotero API methods wrapped in try { callback(); } catch (_e) {} to prevent unhandled rejections"
  - "Pattern: DOMParser injected as explicit Function parameter alongside XPathResult for all translator execution contexts"

requirements-completed: [VERIFY-02]

# Metrics
duration: 8min
completed: 2026-03-27
---

# Phase 4 Plan 1: Sandbox Bug Fixes Summary

**Three targeted fixes in translator-system-modern.ts eliminate pre-existing unhandled rejection, inject DOMParser into all translator Function contexts, and fix dependencies spread override — test suite goes from 211 pass/1 fail to 212 pass/0 fail**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-27T00:00:00Z
- **Completed:** 2026-03-27T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed unhandled rejection in `getTranslatorObject` by wrapping all 4 callback() invocations in individual try-catch blocks
- Added `DOMParser` as a named parameter to detectWeb, doWeb, and embedded translator `new Function()` constructors, with value resolved via `dependencies?.DOMParser ?? globalThis.DOMParser`
- Fixed `TranslatorExecutor` constructor to use nullish coalescing (`options.dependencies ??`) instead of spread-first, preventing `undefined` from overriding the default DOMParser
- Test suite now shows 212 pass, 1 skip, 0 fail (previous: 211 pass, 1 skip, 1 fail)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix three sandbox bugs in translator-system-modern.ts** - `6bb3248` (fix)

**Plan metadata:** pending (created after this commit)

## Files Created/Modified
- `packages/core/src/translator-system-modern.ts` - Three targeted bug fixes: callback wrapping, DOMParser injection, dependencies default

## Decisions Made
- Wrapped all 4 callback invocations in `getTranslatorObject` individually (not just the outer try-catch) — this is required because the "not found" early-return path and the success path each have their own throw risks
- Added both `XPathResult` and `DOMParser` to the embedded translator Function in `getTranslatorObject` — the embedded translator lacked both, matching the detectWeb/doWeb parameter set
- Used `dependencies` local variable inside detectWeb/doWeb methods to avoid repeated `this.options.dependencies` access; in `getTranslatorObject` used `executor.options.dependencies` to match the captured reference

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- When running `bun test packages/core/` from the repo root, the `bunfig.toml` preload in `packages/core/` is not picked up, causing DOMParser to be undefined in tests — this is a pre-existing environment quirk, not caused by this plan's changes. Tests pass correctly when run from `packages/core/` directory with `bun test`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three sandbox bugs blocking real translator compatibility are now fixed
- `bun test` from `packages/core/` directory passes with 212 pass, 1 skip, 0 fail
- Ready for Plan 04-02: live translator tests (Wikipedia, arXiv, reddit) with TRANSLATOR_COMPAT-gated tests

---
*Phase: 04-verification*
*Completed: 2026-03-27*
