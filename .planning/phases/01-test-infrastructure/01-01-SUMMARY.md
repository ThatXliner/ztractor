---
phase: 01-test-infrastructure
plan: 01
subsystem: testing
tags: [zotero, translator, test-harness, normalization, bun-test]

# Dependency graph
requires: []
provides:
  - ZoteroTestCase, TestResult, TranslatorResult, BaselineReport type definitions in tests/harness/types.ts
  - parseTestCases() extracts test cases from bundled translator code strings
  - normalizeItem() applies Zotero-compatible item normalization before comparison
  - compareItems() uses relaxed field equality (expected fields must match, extra actual fields allowed)
affects:
  - 01-02 (harness runner uses all four utilities)
  - any future plan that compares Zotero translator output

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Test utilities live in packages/core/tests/harness/ as pure TypeScript modules
    - Relaxed comparison: expected fields required, extra actual fields permitted (no Zotero ItemFields registry needed)
    - BEGIN/END TEST CASES markers parsed with substring + regex strip to isolate JSON array

key-files:
  created:
    - packages/core/tests/harness/types.ts
    - packages/core/tests/harness/parse-test-cases.ts
    - packages/core/tests/harness/parse-test-cases.test.ts
    - packages/core/tests/harness/normalize-item.ts
    - packages/core/tests/harness/compare-items.ts
    - packages/core/tests/harness/normalize-item.test.ts
  modified: []

key-decisions:
  - "Relaxed item comparison: expected fields must match in actual, extra fields in actual are silently allowed — avoids false negatives from Zotero's ItemFields registry which we do not have"
  - "normalizeItem removes empty arrays in addition to Zotero's documented sanitizeItem rules — prevents false mismatches on fields like tags:[] vs field absent"

patterns-established:
  - "Harness utilities pattern: pure functions, no side effects, import types from ./types"
  - "Test extraction pattern: indexOf markers + substring + regex strip + JSON.parse with try/catch fallback"

requirements-completed:
  - TEST-01

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 01 Plan 01: Harness Utilities Summary

**parseTestCases/normalizeItem/compareItems harness utilities parsing Zotero's embedded test format and comparing items with relaxed field equality**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T06:10:13Z
- **Completed:** 2026-03-27T06:17:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- parseTestCases() correctly extracts ZoteroTestCase arrays from translator code strings using Zotero's own BEGIN/END TEST CASES marker format; verified against real BundledRegistry translator code
- normalizeItem() matches Zotero's sanitizeItem behavior: removes accessDate, normalizes attachment document/url fields, converts string tags to objects, sorts tags alphabetically, removes empty arrays
- compareItems() implements relaxed field equality: all expected fields must match, extra fields in actual output are silently allowed (necessary since we lack the Zotero ItemFields registry)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create harness types and parseTestCases utility** - `02442c3` (feat)
2. **Task 2: Create normalizeItem and compareItems utilities with tests** - `3e67fde` (feat)

## Files Created/Modified

- `packages/core/tests/harness/types.ts` - ZoteroTestCase, TestResult, TranslatorResult, BaselineReport interfaces
- `packages/core/tests/harness/parse-test-cases.ts` - parseTestCases() function
- `packages/core/tests/harness/parse-test-cases.test.ts` - 6 unit tests including real BundledRegistry integration
- `packages/core/tests/harness/normalize-item.ts` - normalizeItem() function
- `packages/core/tests/harness/compare-items.ts` - compareItems() function
- `packages/core/tests/harness/normalize-item.test.ts` - 9 unit tests covering normalization and comparison

## Decisions Made

- **Relaxed item comparison:** Expected fields must match in actual, extra fields in actual are silently allowed. This avoids false negatives from Zotero's `ItemFields.isValidForType()` registry which we cannot replicate. Strict validation deferred to Phase 4.
- **Empty array removal in normalizeItem:** Added removal of empty arrays (e.g., `tags: []`) beyond what Zotero's documented `sanitizeItem` specifies. This prevents false mismatches when ztractor returns `tags: []` but expected item has no `tags` field at all.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four harness utility modules are ready for Plan 02 (harness runner)
- parseTestCases, normalizeItem, compareItems are importable from `tests/harness/`
- 15 new tests pass alongside all 173 existing tests (188 total, 0 failures)
- Plan 02 can build the run-test.ts and report.ts modules on top of this foundation

---
*Phase: 01-test-infrastructure*
*Completed: 2026-03-27*
