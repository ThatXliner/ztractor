---
phase: 02-sandbox-core-api
verified: 2026-03-26T12:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 02: Sandbox Core API Verification Report

**Phase Goal:** Translators that use Zotero.Item and ZU base utilities can detect and extract metadata without crashing on missing API
**Verified:** 2026-03-26
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Translator code can reference `Z` as an alias for `Zotero` without ReferenceError | VERIFIED | `detectWeb` and `doWeb` both pass `sandbox.Zotero` as the `Z` parameter (lines 495, 519, 559, 586). Test `sandbox provides Z as alias for Zotero` passes. |
| 2 | Translator code can call `innerText(doc, selector)` as a bare global function | VERIFIED | `function innerText(` defined at line 423. Both `new Function()` calls include `'innerText'` as parameter (lines 498, 562). Test `sandbox provides innerText as global function` passes. |
| 3 | Translator code can call `requestDocument(url)`, `requestText(url)`, `requestJSON(url)`, `request(url)` as bare global functions | VERIFIED | `'request'`, `'requestText'`, `'requestJSON'`, `'requestDocument'` appear in both `detectWeb` and `doWeb` `new Function()` parameter lists (lines 499-502, 563-566). Invocations bind from `sandbox.ZU` (lines 523-526, 590-593). Test `sandbox provides bare request* globals as functions` passes. |
| 4 | `item.setExtra('DOI', '10.1/abc')` stores `DOI: 10.1/abc` in `item.extra` | VERIFIED | `setExtra` method on `ZoteroItem` at line 206 with filter-empty-strings guard. Three tests pass: stores, overwrites, appends. |
| 5 | `Zotero.isConnector`, `Zotero.isServer`, `Zotero.isBookmarklet` are `false` inside translator code | VERIFIED | `isConnector: false`, `isServer: false`, `isBookmarklet: false`, `parentTranslator: null` set in `createSandbox()` Zotero object (lines 661-664). Test `sandbox sets Zotero.isConnector/isServer/isBookmarklet to false` passes. |
| 6 | `ZU.HTTP` is an alias for `ZU` — `ZU.HTTP.doGet` is the same as `ZU.doGet` | VERIFIED | `(wrappedZU as any).HTTP = wrappedZU` at line 695. Test `sandbox provides ZU.HTTP as alias for ZU` passes. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/translator-system-modern.ts` | Fixed sandbox with all Zotero globals, setExtra, flags, HTTP alias | VERIFIED | Contains `setExtra`, `innerText`, `isConnector: false`, `wrappedZU.HTTP = wrappedZU`, expanded `new Function()` params in both `detectWeb` and `doWeb` |
| `packages/core/tests/translator-system-modern.test.ts` | Tests for all new sandbox behaviors | VERIFIED | Contains all 8 required test cases (3 setExtra + 5 sandbox globals); 32 tests total, 0 fail |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `TranslatorExecutor.detectWeb()` | `new Function()` call | expanded parameter list includes `Z`, `innerText`, `request`, `requestText`, `requestJSON`, `requestDocument` | WIRED | Lines 491-513 confirm all parameters present; invocation at lines 514-528 passes values |
| `TranslatorExecutor.doWeb()` | `new Function()` call | same expanded parameter list | WIRED | Lines 554-579 confirm all parameters present; invocation at lines 581-595 passes values |
| `createSandbox()` | Zotero object | sets `isConnector`, `isServer`, `isBookmarklet`, `parentTranslator`, `Utilities.HTTP` | WIRED | Lines 658-695; `Utilities: wrappedZU` at line 660, flags at 661-664, `HTTP` alias at 695 |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces sandbox/executor infrastructure (not a rendering component or data pipeline). The behaviors are logic-only: function injection into `new Function()` context and method implementations on `ZoteroItem`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 8 new tests pass | `bun test tests/translator-system-modern.test.ts` | 32 pass, 0 fail | PASS |
| Full suite no new regressions | `bun test` (from repo root) | 196 pass, 1 fail (pre-existing Wikipedia integration test) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SAND-01 | 02-01-PLAN.md | `Zotero.Item` implements the full field/method API that translators use (all item types, all fields, `complete()`, `addTag()`, `addCreator()`, etc.) | SATISFIED | `ZoteroItem.setExtra()` added; existing `complete()`, `_setComplete()`, dynamic field assignment all present. Tests confirm. |
| SAND-02 | 02-01-PLAN.md | `ZU` implements all methods translators call — text cleaning, ISBN/ISSN/DOI, HTTP helpers, DOM utilities | SATISFIED | `createZoteroUtilities()` wraps `ZoteroUtilities.Translate` and copies prototype methods (request, requestText, requestJSON, requestDocument via prototype chain walk). `ZU.HTTP` alias set. Existing ZU tests continue to pass. |
| SAND-05 | 02-01-PLAN.md | Translator calling conventions match what Zotero's runtime provides — `detectWeb()` and `doWeb()` receive the correct arguments and `this` context | SATISFIED | Both functions now inject `Z`, `innerText`, `request*` as top-level parameters. `Zotero.isConnector/isServer/isBookmarklet` are false. `Zotero.parentTranslator` is null. All calling convention tests pass. |

No orphaned requirements — REQUIREMENTS.md traceability table maps SAND-01, SAND-02, SAND-05 to Phase 2, all claimed by plan 02-01.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/translator-system-modern.ts` | 729 | `createTranslatorLoader` uses `this.options` inside an object literal method (will be `undefined` at runtime for `getTranslatorById`) | Warning | Only affects embedded translator loading (SAND-07, Phase 3 scope). Does not affect Phase 2 goals. |

**Detail on warning:** In `createTranslatorLoader()` (line 729), the returned object method `getTranslatorObject` references `this.options` — but `this` inside an object literal method refers to the returned object, not `TranslatorExecutor`. This would cause `this.options.getTranslatorById` to be `undefined`. However, this code path (embedded translators via `Zotero.loadTranslator`) is explicitly out of scope for Phase 2 (noted in plan as SAND-07, Phase 3). The bug pre-dates this phase and does not affect any Phase 2 behaviors.

### Human Verification Required

None. All Phase 2 observable truths are verifiable programmatically via the test suite.

### Gaps Summary

No gaps. All 6 must-have truths are verified. Both artifacts exist, are substantive, and are wired. All three requirements (SAND-01, SAND-02, SAND-05) are satisfied. The test suite confirms 32 passing tests with 0 failures in the target file, and no new failures in the full suite (196 pass, 1 pre-existing fail).

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
