---
phase: 01-test-infrastructure
plan: 02
subsystem: testing
tags: [zotero, translator, test-harness, baseline, bun-test]

# Dependency graph
requires:
  - 01-01 (parseTestCases, compareItems, normalizeItem, types)
provides:
  - runTranslatorWebTest() in tests/harness/run-test.ts — runs a single web test case against extractMetadata()
  - runTranslatorTests() in tests/harness/run-test.ts — runs all web tests for a translator and aggregates results
  - generateBaselineReport/printSummary/writeReportToFile in tests/harness/report.ts
  - zotero-compat.test.ts — bun test entry point for translator compatibility smoke tests
  - scripts/baseline.ts — standalone script for generating the full baseline report via `bun run baseline`
affects:
  - Phase 02+ (sandbox compatibility work uses baseline as the measurement tool)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Baseline script uses TRANSLATOR_FILTER, FULL_HARNESS, TIMEOUT env vars for flexible execution
    - Live network tests guarded by TRANSLATOR_COMPAT env var so `bun test` is fast by default
    - report.ts uses node:fs writeFileSync — acceptable since scripts/ only run in Node.js/Bun context

key-files:
  created:
    - packages/core/tests/harness/run-test.ts
    - packages/core/tests/harness/report.ts
    - packages/core/tests/zotero-compat.test.ts
    - packages/core/scripts/baseline.ts
  modified:
    - packages/core/package.json
    - .gitignore

key-decisions:
  - "Smoke test guards live network test behind TRANSLATOR_COMPAT env var — keeps bun test fast with no network calls by default"
  - "report.ts imports node:fs directly since it is only used from scripts/ and tests/, never from browser-targeted src/"

patterns-established:
  - "Baseline generation pattern: run translators from SAMPLE_TRANSLATORS list, aggregate pass/fail/skip/partial, write JSON report"
  - "Env var feature flags for script behavior: TRANSLATOR_FILTER, FULL_HARNESS, TIMEOUT"

requirements-completed:
  - TEST-02
  - TEST-03

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 01 Plan 02: Harness Runner and Baseline Report Summary

**Harness runner and baseline report generator — runTranslatorWebTest/runTranslatorTests execute Zotero web tests against extractMetadata(), baseline script aggregates pass/fail/skip/partial per translator and writes baseline-report.json**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T06:14:02Z
- **Completed:** 2026-03-27T06:17:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- runTranslatorWebTest() handles all test case shapes: defer flag skipped with reason, `items:'multiple'` treated as partial pass if any items returned, normal cases use compareItems() for relaxed field comparison
- runTranslatorTests() aggregates results from all web tests in a translator's code into a TranslatorResult
- generateBaselineReport() iterates a list of translator labels, finds them in BundledRegistry, runs all web tests, and accumulates pass/fail/skip/partial counts
- zotero-compat.test.ts smoke test confirms harness can extract test cases from real BundledRegistry translator (Wikipedia); passes in 92ms
- scripts/baseline.ts runs with TRANSLATOR_FILTER="Embedded Metadata" and produces output without errors; writes baseline-report.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Create run-test/report modules and zotero-compat.test.ts** - `726afa3` (feat)
2. **Task 2: Create baseline script, update package.json, update .gitignore** - `304a7d5` (feat)

## Files Created/Modified

- `packages/core/tests/harness/run-test.ts` - runTranslatorWebTest(), runTranslatorTests()
- `packages/core/tests/harness/report.ts` - generateBaselineReport(), printSummary(), writeReportToFile(), SAMPLE_TRANSLATORS
- `packages/core/tests/zotero-compat.test.ts` - Zotero translator compatibility smoke tests
- `packages/core/scripts/baseline.ts` - standalone baseline generation script
- `packages/core/package.json` - added "baseline" script entry
- `.gitignore` - added packages/core/tests/baseline-report.json

## Decisions Made

- **TRANSLATOR_COMPAT guard on live test:** The network-dependent test in zotero-compat.test.ts is skipped by default via `test.skipIf(!process.env.TRANSLATOR_COMPAT)`. This keeps `bun test` fast (92ms) and avoids flaky CI failures from network conditions.
- **node:fs in report.ts:** report.ts imports `writeFileSync` from `node:fs`. This is acceptable because report.ts is only used from scripts/ and tests/ — never imported into the browser-targeted src/ package. The core build constraint applies only to files under src/.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all functionality is fully wired. The baseline report generation works end-to-end (confirmed with TRANSLATOR_FILTER="Embedded Metadata").

## Self-Check: PASSED

- FOUND: packages/core/tests/harness/run-test.ts
- FOUND: packages/core/tests/harness/report.ts
- FOUND: packages/core/tests/zotero-compat.test.ts
- FOUND: packages/core/scripts/baseline.ts
- FOUND commit: 726afa3
- FOUND commit: 304a7d5

---
*Phase: 01-test-infrastructure*
*Completed: 2026-03-27*
