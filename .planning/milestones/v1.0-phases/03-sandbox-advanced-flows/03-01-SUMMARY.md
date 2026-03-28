---
phase: 03-sandbox-advanced-flows
plan: 01
subsystem: sandbox
tags: [async, processDocuments, doGet, doPost, pendingWork, fetch]

# Dependency graph
requires:
  - phase: 02-sandbox-core-api
    provides: ZU utilities, wrappedZU, sandbox infrastructure, request* methods
provides:
  - pendingWork drain loop replacing 100ms setTimeout in doWeb
  - ZU.processDocuments(urls, processor) fetching HTML and delivering parsed docs to callback
  - ZU.doGet(urls, processor, done) with fakeXhr callback delivery and URL array support
  - ZU.doPost(url, body, onDone) with fakeXhr callback delivery
  - Zotero.done() and Zotero.wait() as no-op compatibility stubs
affects: [04-translator-compat, 05-ztractor-node, integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pendingWork: Promise<any>[] array threaded through createSandbox to accumulate async sub-requests"
    - "Drain loop: while(pendingWork.length !== prev) { prev = pendingWork.length; await Promise.all(pendingWork) }"
    - "fakeXhr object pattern: { responseText, status, responseURL, getAllResponseHeaders } for callback compatibility"
    - "try/catch URL construction: new URL(rawUrl, base) with fallback to rawUrl for malformed translator URLs"

key-files:
  created: []
  modified:
    - packages/core/src/translator-system-modern.ts
    - packages/core/tests/translator-system-modern.test.ts

key-decisions:
  - "pendingWork array (not counter) allows drain loop to catch new promises added by nested callbacks (selectItems -> processDocuments)"
  - "doGet/doPost use callback pattern (not Promise return) to match Zotero's API surface for real translator compatibility"
  - "processDocuments uses dependencies.parseHTMLDocument when available (Node.js path) with DOMParser fallback (browser path)"
  - "Integration test failure (createTranslatorLoader this.options bug) is pre-existing; logged to deferred-items, not fixed here"

patterns-established:
  - "Async fence: doWeb drains pendingWork after result settles, enabling translators to add async work during sync execution"
  - "TDD workflow: RED commit with failing tests, GREEN commit with implementation"

requirements-completed: [SAND-03, SAND-04, SAND-06]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 3 Plan 1: Async Pending-Work Tracking and HTTP Sub-Request APIs Summary

**pendingWork drain replaces 100ms setTimeout; ZU.processDocuments/doGet/doPost deliver callbacks with fakeXhr, collecting items from async sub-requests without race conditions**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-27T07:44:47Z
- **Completed:** 2026-03-27T07:47:54Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Removed the 100ms `setTimeout` hack in `doWeb`; replaced with a proper `pendingWork` drain loop that waits for all async sub-requests to complete
- Implemented `ZU.processDocuments(urls, processor)` — fetches each URL, parses HTML with injected or global DOMParser, delivers `(doc, url)` to callback; registered in pendingWork
- Implemented `ZU.doGet(urls, processor, done)` — fetches each URL, delivers `(text, fakeXhr, url)` to callback, calls `done()` after all URLs; supports single URL or array
- Implemented `ZU.doPost(url, body, onDone)` — POSTs body, delivers `(text, fakeXhr)` to `onDone`; registered in pendingWork
- Added `Zotero.done()` and `Zotero.wait()` as no-ops (prevents TypeError in translators that call these)
- All 40 translator-system-modern tests pass; full core suite 204/206 (pre-existing integration failure unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `6ae0af4` (test)
2. **Task 1 GREEN: Implementation** - `4041e39` (feat)

**Plan metadata:** (docs commit — this summary)

_Note: TDD task had two commits (RED failing tests, then GREEN implementation)_

## Files Created/Modified
- `packages/core/src/translator-system-modern.ts` - pendingWork tracking, processDocuments, doGet, doPost, Zotero.done/wait
- `packages/core/tests/translator-system-modern.test.ts` - Advanced Flows describe block with 8 new tests

## Decisions Made
- Used a `pendingWork: Promise<any>[]` array (not a counter) so the drain loop can detect when nested callbacks (e.g. selectItems → processDocuments) add more promises after the initial async call resolves
- `doGet`/`doPost` use the callback pattern rather than returning a Promise — matches Zotero's actual API where translators pass callbacks, not await the return value
- `processDocuments` uses `dependencies.parseHTMLDocument` when available for Node.js linkedom support, falls back to `DOMParser` for browser
- URL construction wrapped in try/catch in all three methods per RESEARCH.md anti-patterns for malformed translator-provided URLs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed doGet array-URL test mock returning stale Response body**
- **Found during:** Task 1 GREEN (running tests)
- **Issue:** `mockResolvedValue(new Response(...))` returns the same Response instance for every fetch call; the body is consumed on the first `.text()` call causing "ERR_BODY_ALREADY_USED" on the second URL
- **Fix:** Changed mock to `mockImplementation(async () => new Response(...))` so a fresh Response is created per call
- **Files modified:** packages/core/tests/translator-system-modern.test.ts
- **Verification:** doGet array test passes
- **Committed in:** 4041e39 (feat commit, included in the fix)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in test mock)
**Impact on plan:** Minimal — test mock fix, not production code. No scope creep.

## Issues Encountered
- Pre-existing integration test failure: `createTranslatorLoader` references `this.options` inside a returned object literal where `this` is unbound. This was present before this plan (confirmed by git stash verification). Logged to deferred-items for Phase 4.

## Known Stubs
None — all implementations are wired to real fetch/DOMParser.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Translators calling `ZU.processDocuments`, `ZU.doGet`, `ZU.doPost` can now run without race conditions
- Items created inside any async callback are collected by `doWeb`
- `selectItems` + `processDocuments` combo works end-to-end (SAND-06)
- Ready for Phase 03-02 (next plan in sandbox-advanced-flows)

---
*Phase: 03-sandbox-advanced-flows*
*Completed: 2026-03-27*
