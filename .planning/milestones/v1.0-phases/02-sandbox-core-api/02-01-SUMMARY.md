---
phase: 02-sandbox-core-api
plan: 01
subsystem: packages/core/src/translator-system-modern.ts
tags: [sandbox, zotero-api, compatibility, tdd]
dependency_graph:
  requires: []
  provides: [SAND-01, SAND-02, SAND-05]
  affects: [translator execution, sandbox globals, ZoteroItem API]
tech_stack:
  added: []
  patterns: [TDD red-green, sandbox injection via new Function() parameter list]
key_files:
  created: []
  modified:
    - packages/core/src/translator-system-modern.ts
    - packages/core/tests/translator-system-modern.test.ts
decisions:
  - Copy prototype methods to wrappedZU (not just own properties via spread) to expose request/requestText/requestJSON/requestDocument
  - ZU.HTTP alias set directly on wrappedZU object after creation
metrics:
  duration: "184 seconds (~3 minutes)"
  completed_date: "2026-03-27"
  tasks_completed: 2
  files_modified: 2
---

# Phase 02 Plan 01: Sandbox Globals and ZoteroItem API Summary

Expanded the sandbox in `translator-system-modern.ts` to inject all missing Zotero globals (`Z`, `innerText`, `request*` functions), added `ZoteroItem.setExtra()`, set `Zotero.isConnector/isServer/isBookmarklet` flags, and wired `ZU.HTTP` as an alias — closing the API gap that caused real translators to crash.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add failing tests (TDD RED) | 8a95fa8 | packages/core/tests/translator-system-modern.test.ts |
| 2 | Implement sandbox globals, setExtra, innerText, flags, HTTP alias (TDD GREEN) | ba6e057 | packages/core/src/translator-system-modern.ts |

## What Was Built

### ZoteroItem.setExtra()

New method on `ZoteroItem` that manages the `extra` field using Zotero's `field: value` line format:
- Stores new fields as `field: value`
- Overwrites existing fields (finds by prefix match)
- Appends new fields on separate lines
- Handles empty/undefined initial state (filter empty strings to avoid leading newlines)

### innerText() helper function

Module-level function matching Zotero's `_innerText` (translate.js:2199):
- Falls back to `textContent` when `innerText` isn't available (browser compat)
- Normalizes whitespace with `replace(/\s+/g, ' ').trim()`
- Exported from module alongside `attr`, `text`

### Expanded new Function() parameter lists

Both `detectWeb()` and `doWeb()` now inject:
- `Z` — alias for `Zotero` object
- `innerText` — DOM helper
- `request`, `requestText`, `requestJSON`, `requestDocument` — HTTP utilities

### Zotero object flags

`createSandbox()` Zotero object now includes:
- `isConnector: false`, `isServer: false`, `isBookmarklet: false`
- `parentTranslator: null`
- `Utilities: wrappedZU` (alias)

### ZU.HTTP alias

`(wrappedZU as any).HTTP = wrappedZU` — allows translator code like `ZU.HTTP.doGet(...)`.

### wrappedZU prototype method copy

Fixed: `{...ZoteroUtilities}` spread only copies own enumerable properties, missing prototype methods like `request`, `requestText`, `requestJSON`, `requestDocument`. Now walks the prototype chain to copy all methods.

## Test Results

- Before: 24 pass, 8 fail (all 8 were pre-existing failures)
- After: 32 pass, 0 fail for translator-system-modern.test.ts
- Full suite: 196 pass, 1 fail (Wikipedia integration test — pre-existing, unrelated to this plan)
- Net: improved from 8 pre-existing failures to 1 (fixed 7 out of 8 pre-existing failures as a side effect)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prototype methods not copied to wrappedZU**
- **Found during:** Task 2 — GREEN phase test run
- **Issue:** `{...ZoteroUtilities}` spread only copies own enumerable properties. `request`, `requestText`, `requestJSON`, `requestDocument` live on the prototype and were `undefined` on `wrappedZU`, causing the test to fail.
- **Fix:** Added prototype chain walk after spread to copy all prototype methods as bound functions on `wrappedZU`.
- **Files modified:** `packages/core/src/translator-system-modern.ts`
- **Commit:** ba6e057

## Known Stubs

None — all implemented behaviors are fully wired.

## Self-Check: PASSED
