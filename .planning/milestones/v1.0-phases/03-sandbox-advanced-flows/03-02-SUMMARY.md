---
phase: 03-sandbox-advanced-flows
plan: 02
subsystem: sandbox
tags: [loadTranslator, translator-delegation, getTranslatorObject, translate, pendingWork]

# Dependency graph
requires:
  - phase: 03-sandbox-advanced-flows
    plan: 01
    provides: pendingWork drain loop, createSandbox with pendingWork param
provides:
  - Fixed createTranslatorLoader with const executor = this capture (no more this-context bugs)
  - translate() method on loader object executing embedded translator via executor.doWeb
  - getTranslatorObject passing full sandbox param list including innerText and request helpers
  - no-op complete() attached to itemDone items for handler compatibility
  - pendingWork threaded into createTranslatorLoader and loadTranslator call in createSandbox
affects: [04-translator-compat, integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "const executor = this before object literal return — captures TranslatorExecutor instance for use inside returned methods"
    - "no-op complete() attached to itemDone items — matches Zotero translate.js line 393-395 where complete is re-attached before handler fires"
    - "double-track async: translate() both pushes to pendingWork (fire-and-forget support) and awaits (await-chaining support)"

key-files:
  created: []
  modified:
    - packages/core/src/translator-system-modern.ts
    - packages/core/tests/translator-system-modern.test.ts

key-decisions:
  - "Attach no-op complete() to itemDone items rather than passing ZoteroItem instance — real translators call item.complete() in itemDone, clone needs this method"
  - "Safe return in getTranslatorObject new Function: typeof detectWeb !== 'undefined' ? detectWeb : undefined — handles translators with only doWeb defined"
  - "translate() both pushes to pendingWork AND awaits — supports fire-and-forget callers (outer drain loop waits) and await-chaining callers (correct sequencing)"

patterns-established:
  - "Capture executor reference with const executor = this before any object literal return to avoid unbound this"

requirements-completed: [SAND-07]

# Metrics
duration: ~3min
completed: 2026-03-27
---

# Phase 3 Plan 2: loadTranslator This-Context Fix and translate() Method Summary

**Fixed createTranslatorLoader this-context bugs and added translate() method, enabling translator-to-translator delegation via both getTranslatorObject and translate() patterns with proper pendingWork integration**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-27T07:50:25Z
- **Completed:** 2026-03-27T07:53:42Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Fixed `this.options.getTranslatorById` bug in `createTranslatorLoader` — captured executor with `const executor = this` before returning object literal
- Fixed `this.createSandbox` bug — now uses `executor.createSandbox`
- Added `translate()` method to loader object — executes embedded translator via `executor.doWeb`, routes items through `itemDone` handler and `onItemComplete`
- Added `pendingWork` parameter to `createTranslatorLoader` and threaded it through to embedded sandbox creation and `translate()` promise tracking
- Updated `loadTranslator` call in `createSandbox` to pass `pendingWork`
- Updated `getTranslatorObject`'s `new Function()` call to include full parameter list (innerText, request, requestText, requestJSON, requestDocument)
- Attached no-op `complete()` to items before passing to `itemDone` handler (matches Zotero's behavior, prevents TypeError in real translator patterns)
- All 47 translator-system-modern tests pass; full core suite 211 pass / 1 pre-existing fail

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `7489de1` (test)
2. **Task 1 GREEN: Implementation** - `8811dbe` (feat)

**Plan metadata:** (docs commit — this summary)

_Note: TDD task had two commits (RED failing tests, then GREEN implementation)_

## Files Created/Modified
- `packages/core/src/translator-system-modern.ts` - Fixed createTranslatorLoader with executor capture, pendingWork param, getTranslatorObject fix, translate() method, itemDone no-op complete
- `packages/core/tests/translator-system-modern.test.ts` - loadTranslator describe block with 7 new tests

## Decisions Made
- Attached no-op `complete()` to items before `itemDone` fires — real translators call `item.complete()` inside itemDone callbacks; the clone from `ZoteroItem.complete()` lacks this method, causing TypeErrors without the no-op
- Used safe `typeof detectWeb !== 'undefined'` guards in `getTranslatorObject`'s return statement — many translators only define `doWeb`, not `detectWeb`; without the guard the function throws ReferenceError
- `translate()` both pushes to `pendingWork` AND awaits the promise — outer drain loop handles fire-and-forget callers; await handles callers that chain on `translate()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added safe typeof guards for detectWeb in getTranslatorObject return**
- **Found during:** Task 1 GREEN (tests failing)
- **Issue:** Plan specified `return { detectWeb, doWeb }` — fails with ReferenceError if translator only defines doWeb (no detectWeb)
- **Fix:** Changed to `return { detectWeb: (typeof detectWeb !== "undefined" ? detectWeb : undefined), doWeb: (typeof doWeb !== "undefined" ? doWeb : undefined) }`
- **Files modified:** packages/core/src/translator-system-modern.ts
- **Verification:** getTranslatorObject test passes with embeddedCode that has only doWeb
- **Committed in:** 8811dbe (feat commit)

**2. [Rule 1 - Bug] Attached no-op complete() to items passed to itemDone handlers**
- **Found during:** Task 1 GREEN (tests failing with "item.complete is not a function")
- **Issue:** `ZoteroItem.complete()` delivers a cloned plain object to `onItemComplete`; the clone has no `complete` method. Real translator patterns call `item.complete()` inside itemDone.
- **Fix:** Added `if (typeof item.complete !== 'function') item.complete = () => {};` before each `handlers.itemDone(null, item)` call — both in getTranslatorObject and translate()
- **Files modified:** packages/core/src/translator-system-modern.ts
- **Verification:** itemDone handler test passes; translate() tests pass
- **Committed in:** 8811dbe (feat commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 - Bug, both in GREEN step)
**Impact on plan:** Both fixes necessary for correctness — the plan's code examples were slightly incomplete for edge cases that real translators hit. No scope creep.

## Issues Encountered
- Pre-existing integration test failure unchanged (doc.evaluate not available with linkedom — out of scope for this plan)

## Known Stubs
None — all implementations are wired to real executor.doWeb calls.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Translators calling `Zotero.loadTranslator().translate()` now work end-to-end
- Translators calling `getTranslatorObject(fn)` receive working {detectWeb, doWeb} objects with full sandbox globals
- Items from embedded translators flow through itemDone AND parent onItemComplete
- Ready for Phase 04 translator compatibility work

## Self-Check: PASSED
- SUMMARY.md: FOUND
- Commit 7489de1 (RED tests): FOUND
- Commit 8811dbe (GREEN implementation): FOUND

---
*Phase: 03-sandbox-advanced-flows*
*Completed: 2026-03-27*
