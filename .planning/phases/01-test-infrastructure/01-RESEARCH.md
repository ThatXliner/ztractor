# Phase 1: Test Infrastructure - Research

**Researched:** 2026-03-26
**Domain:** Zotero translator test format, Bun test runner, test harness design
**Confidence:** HIGH

## Summary

Zotero translators embed their test cases inline at the bottom of each `.js` file between `/** BEGIN TEST CASES **/` and `/** END TEST CASES **/` markers. The test data is a JSON array assigned to `var testCases`. Each test case is an object with `type` (web/import/export/search), `url` (for web tests), `items` (expected output array or `"multiple"`), and an optional `defer` flag. There are no embedded HTML snapshots — every web test requires a live HTTP fetch to the target URL.

Of the 742 translator files in the bundled submodule, 714 have test cases and 658 have at least one web-type test. The total web test count is 3,428. All web tests require live HTTP; none have offline HTML snapshots embedded. This means the harness must perform real HTTP fetches or be designed with a clear skip/deferred path for CI environments without network access.

The project already uses Bun's built-in test runner (`bun test`) with a `bunfig.toml` preload for DOM setup. The test harness must fit this existing infrastructure — it should be a new test file (or set of files) under `packages/core/tests/` that reads translator test cases, calls `extractMetadata()` with live fetches, and compares results against expected items. Zotero's own `testTranslators/translatorTester.mjs` is Firefox/Chrome-specific (uses `ChromeUtils.importESModule`) and cannot run directly in Bun — we must write our own harness from scratch using our existing `extractMetadata()` API.

**Primary recommendation:** Build a standalone `packages/core/tests/zotero-compat.test.ts` (or a `tests/harness/` directory) that: (1) reads test cases from the bundled translator code strings, (2) fetches pages via the existing `extractMetadata()` with live HTTP, (3) compares output using relaxed field-equality matching (ignoring `accessDate` and attachment URLs, matching Zotero's own normalization logic), and (4) produces a pass/fail/skip report per translator.

## Project Constraints (from CLAUDE.md)

- **Package manager:** `bun` — all install/run/test commands use `bun`, `bunup`, `bun test`
- **No Node-specific imports in `packages/core`** — must work in browser environment too (though test files run in Bun, they're in `tests/` not `src/`)
- **Test runner:** Bun's built-in (`bun test`) — no external test framework (jest, vitest, mocha)
- **Bundler target:** `browser` — `packages/core/src/` must not import Node-only APIs
- **Test files location:** `packages/core/tests/` — tests import from `../src/index`
- **Test preload:** `packages/core/bunfig.toml` sets `preload = ["./tests/setup.ts"]` which injects `DOMParser` and `document` globals via linkedom
- **Auto-generated files:** `src/translators-registry.ts` must never be manually edited — test harness reads from this via the `BundledRegistry` API
- **Translator submodule:** `packages/core/translators/` — contains 742 `.js` files, each with embedded test cases

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Understand Zotero's translator test format — identify how translator tests are structured, what inputs/outputs they expect, and whether they can run outside Zotero | Fully documented in this research. Test cases are inline JSON arrays in translator `.js` files. Web tests contain `url` + expected `items` array. All web tests require live HTTP. Zotero's own `translatorTester.mjs` is Firefox-only and cannot run in Bun. |
| TEST-02 | Implement a test harness that runs Zotero translator tests against ztractor's sandbox | Design documented below. Reads test cases from `BundledRegistry.getTranslatorCode()`, calls `extractMetadata()` with live fetch, compares output using normalized field equality. New file: `packages/core/tests/zotero-compat.test.ts` |
| TEST-03 | Baseline measurement — run existing translator tests and document which pass/fail before sandbox improvements | Harness from TEST-02 produces this automatically. First run output = baseline. Suggested: write results to `packages/core/tests/baseline-report.json` or log to stdout with summary counts. |
</phase_requirements>

## Translator Test Format (Zotero Standard)

### How Test Cases Are Embedded

Every Zotero translator `.js` file ends with a section delimited by:

```
/** BEGIN TEST CASES **/
var testCases = [ ... ];
/** END TEST CASES **/
```

The content between the markers is a JSON array. To parse it:

```typescript
const testStart = code.indexOf('/** BEGIN TEST CASES **/');
const testEnd = code.indexOf('/** END TEST CASES **/');
const testsJSON = code
    .substring(testStart + 24, testEnd)
    .replace(/^[\s\r\n]*var testCases = /, '')
    .replace(/;[\s\r\n]*$/, '');
const testCases = JSON.parse(testsJSON);
```

(Source: directly from `packages/core/translate/testTranslators/translatorTester.mjs:83-106` — HIGH confidence)

### Test Case Object Structure

```typescript
interface ZoteroTestCase {
    type: 'web' | 'import' | 'export' | 'search';
    url?: string;          // present for web tests (also as `input` field)
    input?: string;        // alternative to `url`
    defer?: boolean | number; // true = wait for dynamic content, N = seconds to wait
    detectedItemType?: string | boolean; // expected return from detectWeb()
    items: ZoteroExpectedItem[] | 'multiple'; // expected output items, or "multiple" if selectItems expected
}
```

For **web tests** (the ones ztractor handles — `type: "web"`):
- `url`: the page URL to fetch
- `items`: array of expected item objects, or the string `"multiple"` (translator calls `selectItems`)
- `defer`: optional — some pages require waiting for JS-rendered content to load (ztractor has no JS rendering; these will always fail)
- `detectedItemType`: optional override for the expected type from `detectWeb()`. If absent, inferred from `items[0].itemType`

### Expected Item Fields

Expected items follow the Zotero item schema. Key normalization rules Zotero applies before comparison:
- `accessDate` is removed (always ignored)
- Attachment `url` and `document` fields are removed
- Attachment `mimeType` is set to `"text/html"` if `document` was present
- Fields not valid for the item's `itemType` are removed
- Base fields are mapped to type-specific subfields (e.g., `publicationTitle` → `websiteTitle` for `webpage`)
- Tags are sorted alphabetically

(Source: `packages/core/translate/testTranslators/test.mjs:149-236` — HIGH confidence)

### Scale

| Metric | Count |
|--------|-------|
| Total translator files | 742 |
| Translators with test cases | 714 |
| Translators with at least one web test | 658 |
| Total web test cases | 3,428 |
| Tests with `defer` flag | 233 |
| Tests expecting `"multiple"` items | 926 |
| Translators without any test cases | 28 |
| Tests with embedded HTML snapshots | 0 |

All web test cases require live HTTP — there are zero offline/embedded HTML snapshots in the translator corpus.

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun test runner | 1.3.10 | Test execution and assertions | Already project-standard; `bun test` is the mandated command |
| `ztractor` (packages/core) | workspace | `extractMetadata()` API | The system under test |
| `BundledRegistry` | workspace | Access translator code strings | Reads test cases from same bundled code |
| linkedom | 0.18.5 | DOM in Bun test environment | Already in `tests/setup.ts` |

### No New Dependencies Needed

The test harness is pure TypeScript using:
- `bun:test` — `describe`, `test`, `expect`
- Existing `extractMetadata()` and `BundledRegistry` from `../src/index`
- Node built-ins available in Bun: `fetch` (for HTTP), no special imports needed

The harness does NOT need:
- A new HTTP client library (Bun has `fetch` natively)
- A new assertion library (Bun's `expect` is sufficient)
- A diffing library (optional, but Zotero's `diff.mjs` pattern can be reimplemented inline)

## Architecture Patterns

### Recommended Structure

```
packages/core/
  tests/
    setup.ts                   (existing — DOM globals)
    utilities.test.ts          (existing)
    integration.test.ts        (existing)
    translator-system-modern.test.ts  (existing)
    item.test.ts               (existing)
    translator-loader.test.ts  (existing)
    utilities-translate.test.ts (existing)
    zotero-compat.test.ts      (NEW — harness entry point)
    harness/
      parse-test-cases.ts      (NEW — extract test cases from translator code)
      normalize-item.ts        (NEW — match Zotero's sanitizeItem normalization)
      compare-items.ts         (NEW — deep equality matching, ignoring ignored fields)
      run-test.ts              (NEW — run one test case through extractMetadata())
      report.ts                (NEW — collect and display pass/fail baseline report)
```

Alternatively (simpler): all harness code in `zotero-compat.test.ts` as a single file if the logic stays under ~300 lines. Split into `harness/` only if complexity warrants it.

### Pattern 1: Test Case Extraction

Extract test cases from code strings returned by `BundledRegistry`:

```typescript
// Source: packages/core/translate/testTranslators/translatorTester.mjs:83-106
function parseTestCases(code: string): ZoteroTestCase[] {
    const testStart = code.indexOf('/** BEGIN TEST CASES **/');
    const testEnd = code.indexOf('/** END TEST CASES **/');
    if (testStart === -1 || testEnd === -1) return [];

    const testsJSON = code
        .substring(testStart + 24, testEnd)
        .replace(/^[\s\r\n]*var testCases = /, '')
        .replace(/;[\s\r\n]*$/, '');

    try {
        const tests = JSON.parse(testsJSON);
        return Array.isArray(tests) ? tests : [];
    } catch {
        return [];
    }
}
```

### Pattern 2: Item Normalization

Before comparing, normalize items to match Zotero's `sanitizeItem()` behavior:

```typescript
// Derived from packages/core/translate/testTranslators/test.mjs:149-236
function normalizeItem(item: Record<string, unknown>): Record<string, unknown> {
    const normalized = JSON.parse(JSON.stringify(item)); // deep clone + remove undefined

    // Remove fields always ignored by Zotero
    delete normalized.accessDate;

    // Normalize attachments
    if (Array.isArray(normalized.attachments)) {
        for (const att of normalized.attachments as any[]) {
            if (att.document) {
                delete att.document;
                att.mimeType = 'text/html';
            }
            delete att.url;
            delete att.complete;
        }
    }

    // Sort tags alphabetically
    if (Array.isArray(normalized.tags)) {
        normalized.tags = normalized.tags
            .map((t: any) => typeof t === 'string' ? { tag: t } : t)
            .sort((a: any, b: any) => a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0);
    }

    return normalized;
}
```

Note: Zotero's full `sanitizeItem()` also removes fields not valid for the item type using `Zotero.ItemFields.isValidForType()`. We cannot replicate this without the full Zotero field registry. For the baseline, use field-presence comparison only — if ztractor produces an extra field, treat it as a warning, not a failure.

### Pattern 3: Test Runner Design

```typescript
// zotero-compat.test.ts
import { describe, test, expect } from 'bun:test';
import { BundledRegistry, extractMetadata } from '../src/index';

const registry = new BundledRegistry();

async function runTranslatorWebTest(translatorId: string, testCase: ZoteroTestCase): Promise<TestResult> {
    const url = testCase.url ?? testCase.input as string;

    const result = await extractMetadata({ url, timeout: 15000 });

    if (!result.success) {
        return { status: 'failure', reason: result.error ?? 'extractMetadata failed' };
    }

    if (testCase.items === 'multiple') {
        // Can't compare individual items — just verify something was extracted
        return result.items && result.items.length > 0
            ? { status: 'success' }
            : { status: 'failure', reason: 'Expected multiple items, got none' };
    }

    // Compare items
    const expected = testCase.items.map(normalizeItem);
    const actual = result.items!.map(item => normalizeItem(item as any));

    // ... comparison logic
    return compareItems(expected, actual);
}
```

### Pattern 4: Baseline Report

The report must be generated on first run and stored. Options:

1. **Log to stdout only** — simplest, captured by `bun test` output. Satisfies "runnable with `bun test`".
2. **Write to JSON file** — `packages/core/tests/baseline-report.json`. Enables comparison across runs. Should be gitignored (it's generated output).
3. **Both** — print summary to stdout, write detail to file.

Recommended: write detailed JSON to `tests/baseline-report.json` (gitignored) and print summary to stdout. The test file itself uses `test.skip()` or just `expect` loosely so the test suite itself does not fail when a translator fails — failures are expected at baseline.

### Anti-Patterns to Avoid

- **Using Zotero's `translatorTester.mjs` directly**: It imports `ChromeUtils` (Firefox-only) and requires a full Zotero runtime. Cannot run in Bun. Must reimplement the relevant subset.
- **Running all 3,428 tests in `bun test`**: This would make the test suite take hours (each test fetches a live URL). The harness should either: (a) accept a `TRANSLATOR_FILTER` env var to run specific translators, or (b) be a separate script invoked by `bun run` rather than `bun test`.
- **Failing the test suite on translator failures**: The baseline run EXPECTS failures — that's the whole point of TEST-03. Use soft assertions (console.warn) rather than hard `expect()` failures so `bun test` exits 0.
- **Field-exact comparison**: Zotero's comparison removes fields not valid for an item type (requiring the full item type/field registry). For Phase 1, use a relaxed comparison: expected fields must be present and match in value; extra fields in actual output are allowed.
- **Not handling `defer` tests**: Tests with `defer: true` require the page to render JavaScript before extraction. ztractor uses static HTML; these will always fail. Skip them in the harness with a clear label.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP fetching | Custom fetch wrapper | Bun native `fetch` (via `extractMetadata()`) | Already integrated into ztractor's `extractMetadata()` with proper User-Agent and error handling |
| JSON deep equality | Custom recursive equals | Bun's `expect().toEqual()` for unit tests; `JSON.stringify` comparison for harness | Correct handling of all edge cases |
| Test output formatting | Custom reporter | Bun's built-in test output + console.table/console.log | No additional setup needed |
| Translator code access | File-system reads | `BundledRegistry.getTranslatorCode(id)` | Already the project's abstraction; avoids coupling harness to file paths |

**Key insight:** The test harness does not need external libraries. All needed capabilities exist in Bun's runtime + the existing `ztractor` API surface.

## Common Pitfalls

### Pitfall 1: All Web Tests Require Live HTTP

**What goes wrong:** Translator test cases only contain a `url` — there are zero offline/embedded HTML snapshots. Running the full harness hits 3,428 live URLs.

**Why it happens:** Zotero's own test runner always fetches live pages. Tests were written this way because translators need current HTML.

**How to avoid:** Design the harness to be selective by default. For the baseline run, pick a small representative set (10-20 translators). Provide a way to run the full set (e.g., `FULL_HARNESS=1 bun run harness`). Consider making the harness a `bun run` script rather than a `bun test` file.

**Warning signs:** Test run taking more than a few minutes; network timeouts in CI.

### Pitfall 2: Translator Code Strings Include Test Cases

**What goes wrong:** When extracting test cases from a translator code string retrieved via `BundledRegistry.getTranslatorCode()`, the `/** BEGIN TEST CASES **/` section is present because the bundler includes the full file content. This is expected behavior.

**Why it happens:** `bundle-translators.ts` stores the full translator file content as a string.

**How to avoid:** This is a feature, not a bug — use it. `BundledRegistry.getTranslatorCode(id)` is the correct source for test case extraction.

**Warning signs:** None, as long as you parse correctly.

### Pitfall 3: `items: "multiple"` Tests Cannot Be Deep-Compared

**What goes wrong:** 926 of 3,428 web tests have `items: "multiple"` — they only verify that a selection dialog was triggered, not the actual item content.

**Why it happens:** Translators that call `Zotero.selectItems()` don't expose which items were ultimately chosen to the test.

**How to avoid:** For `"multiple"` tests, the harness can only verify: (a) `extractMetadata()` succeeded, and (b) at least one item was returned. Mark these as "partial pass" in the report.

**Warning signs:** Trying to `expect(items).toEqual(testCase.items)` when `testCase.items === "multiple"`.

### Pitfall 4: `detectedItemType` Mismatch

**What goes wrong:** The test case's `detectedItemType` field may differ from what `extractMetadata()` returns as item type.

**Why it happens:** Zotero's `detectWeb()` returns the item type as a string. The test compares this against the expected `detectedItemType`. ztractor doesn't currently surface the detected item type separately.

**How to avoid:** For Phase 1, skip `detectedItemType` comparison. Only compare the extracted items. Phase 2 sandbox work will address the `detectWeb()` API.

### Pitfall 5: DOM Setup in Test Files vs. `src/`

**What goes wrong:** Tests that use `DOMParser` directly fail with `ReferenceError: DOMParser is not defined` because `bunfig.toml` preload only works when running via `bun test` from the `packages/core/` directory.

**Why it happens:** The `preload` in `bunfig.toml` is relative to that package. When running `bun test` from the project root, Bun uses the root-level config (no preload).

**How to avoid:** Run harness tests from `packages/core/`: `cd packages/core && bun test`. Or import setup.ts explicitly in the harness. The harness itself doesn't need `DOMParser` directly — it uses `extractMetadata()` which handles DOM internally.

**Warning signs:** `ReferenceError: DOMParser is not defined` or `document is not defined` errors.

### Pitfall 6: Current Test Suite Has Existing Failures

**What goes wrong:** Running `bun test packages/core/tests/translator-system-modern.test.ts` currently shows 12 failures (all `DOMParser is not defined`). The utilities test also has 3 failures.

**Why it happens:** The `bunfig.toml` preload for `setup.ts` only runs when `bun test` is run from within `packages/core/`. These tests pass from there.

**How to avoid:** Always run tests from `packages/core/`: `cd packages/core && bun test`. The new harness should document this requirement.

**Warning signs:** Failures on setup-dependent tests when running from project root.

## Code Examples

### Extracting and Running a Single Translator's Tests

```typescript
// Source: pattern derived from packages/core/translate/testTranslators/translatorTester.mjs
import { BundledRegistry, extractMetadata } from '../src/index';

const registry = new BundledRegistry();
const allMetadata = await registry.getAllTranslatorMetadata();

// Get Wikipedia translator
const wikiMeta = allMetadata.find(m => m.label === 'Wikipedia');
const code = await registry.getTranslatorCode(wikiMeta!.translatorID);

// Parse test cases from code
const testStart = code!.indexOf('/** BEGIN TEST CASES **/');
const testEnd = code!.indexOf('/** END TEST CASES **/');
const testsJSON = code!
    .substring(testStart + 24, testEnd)
    .replace(/^[\s\r\n]*var testCases = /, '')
    .replace(/;[\s\r\n]*$/, '');
const testCases = JSON.parse(testsJSON);

// Run one web test
const webTest = testCases.find((t: any) => t.type === 'web');
const result = await extractMetadata({ url: webTest.url, timeout: 15000 });
console.log(result.success, result.items?.length);
```

### Baseline Report Structure

```typescript
interface BaselineReport {
    generatedAt: string;
    totalTranslators: number;
    translatorsTested: number;
    totalWebTests: number;
    results: TranslatorResult[];
    summary: {
        pass: number;
        fail: number;
        skip: number;   // deferred, network-error, etc.
        partial: number; // "multiple" items tests with at least one item
    };
}

interface TranslatorResult {
    id: string;
    label: string;
    testCount: number;
    pass: number;
    fail: number;
    skip: number;
    failures: Array<{ url: string; reason: string }>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ZU.doGet()`, `ZU.doPost()` for HTTP | `request()`, `requestText()`, `requestJSON()`, `requestDocument()` in global scope | Zotero 6+ | New translators use global `request()` functions; old ones still use `ZU.doGet()`. Both must be supported. |
| `executor.ts` | `translator-system-modern.ts` | Current rewrite | Old file is being phased out; new harness must use the modern system. |
| Bundled translators from file paths | Bundled as code strings in `translators-registry.ts` | This rewrite | No file I/O needed; `BundledRegistry.getTranslatorCode()` is the API. |

**Deprecated/outdated:**
- `executor.ts`: Phasing out in favor of `translator-system-modern.ts`. The test harness must not import from `executor.ts`.
- Zotero's `ZU.doGet()`, `ZU.doPost()`, `ZU.processDocuments()`: Deprecated in Zotero's own CLAUDE.md for the translators submodule. Still used by ~half the translators; must be supported by the sandbox.

## Open Questions

1. **Harness as `bun test` file vs. standalone script**
   - What we know: `bun test` auto-discovers `*.test.ts` files; the harness needs network access
   - What's unclear: Should the baseline run be part of the normal test suite or a separate `bun run baseline` command? Making it `bun test` means developers accidentally run it. Making it a script means it's harder to integrate with CI.
   - Recommendation: Make it a `bun run` script by default (`bun run harness` in package.json), but also provide a single-translator smoke test in `zotero-compat.test.ts` that runs offline (using a pre-fetched HTML snapshot of a simple translator) to keep `bun test` fast.

2. **Field validation without Zotero's ItemFields registry**
   - What we know: Zotero's `sanitizeItem()` removes fields not valid for a given item type using `Zotero.ItemFields.isValidForType()`. We don't have this registry.
   - What's unclear: How strict should Phase 1 comparison be? Requiring exact field matching may produce false negatives.
   - Recommendation: Phase 1 uses relaxed comparison — only check that expected fields are present and match, ignore extra fields in actual output. Note this in the baseline report. Strict validation is a Phase 4 concern.

3. **Timeout strategy for the full harness run**
   - What we know: 15s timeout per test, 658 translators with web tests = potentially many hours for a full run
   - What's unclear: What's acceptable for the baseline generation time?
   - Recommendation: Test a sample of translators (e.g., 20 well-known ones: Wikipedia, DOI, arXiv.org, Google Scholar, etc.) for the initial baseline. Document which translators were sampled.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Test runner | Yes | 1.3.10 | — |
| `fetch` API | HTTP requests in harness | Yes | native in Bun 1.3.10 | — |
| `packages/core/translators/` submodule | Test case source | Yes | 3.0b1-5428 (ee1746de) | Cannot test without submodule |
| `packages/core/translate/` submodule | Reference for test format | Yes | heads/master (1c5385fb) | Format already documented; not needed at runtime |
| Network access | Live URL fetching | Yes (dev machine) | — | Skip tests; mark as `skip` in report |

**Missing dependencies with no fallback:**
- None blocking initial harness implementation.

**Missing dependencies with fallback:**
- Network access: If unavailable (CI), translator web tests cannot run. Fallback: mark all web tests as `skip` with reason `"network unavailable"`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun built-in test runner (bun 1.3.10) |
| Config file | `packages/core/bunfig.toml` — `preload = ["./tests/setup.ts"]` |
| Quick run command | `cd packages/core && bun test tests/zotero-compat.test.ts` |
| Full suite command | `cd packages/core && bun test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | `parseTestCases(code)` correctly extracts test cases from translator code string | unit | `cd packages/core && bun test tests/harness/parse-test-cases.test.ts` | No — Wave 0 |
| TEST-01 | `normalizeItem(item)` removes `accessDate`, normalizes attachments, sorts tags | unit | `cd packages/core && bun test tests/harness/normalize-item.test.ts` | No — Wave 0 |
| TEST-02 | Harness runs a single known-good translator test end-to-end and produces a result | integration (live) | `cd packages/core && bun test tests/zotero-compat.test.ts` | No — Wave 0 |
| TEST-03 | Baseline report file is generated with pass/fail counts after harness run | smoke | `bun run baseline 2>&1 | grep "Baseline report"` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/core && bun test tests/harness/` (unit tests only, no network)
- **Per wave merge:** `cd packages/core && bun test` (full suite)
- **Phase gate:** Full suite green + baseline report generated before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/harness/parse-test-cases.ts` — core extraction logic (REQ TEST-01)
- [ ] `tests/harness/normalize-item.ts` — item normalization (REQ TEST-01)
- [ ] `tests/harness/parse-test-cases.test.ts` — unit tests for parse logic
- [ ] `tests/harness/normalize-item.test.ts` — unit tests for normalization
- [ ] `tests/zotero-compat.test.ts` — harness entry point (REQ TEST-02)
- [ ] Baseline report generation script in `package.json` scripts (REQ TEST-03)

## Sources

### Primary (HIGH confidence)
- `packages/core/translate/testTranslators/translatorTester.mjs` — Zotero's official test runner; defines `getTestsInTranslator()` extraction pattern (lines 83-106) and `_translateWeb()` execution flow (lines 213-289)
- `packages/core/translate/testTranslators/test.mjs` — Zotero's `Test` class; defines `sanitizeItem()` normalization (lines 149-236) and comparison semantics
- `packages/core/translators/` (submodule) — 742 translator files; test case format verified in Wikipedia.js, DOI.js, arXiv.org.js
- `packages/core/tests/setup.ts` — Existing DOM setup for Bun test environment
- `packages/core/bunfig.toml` — Bun test configuration with preload

### Secondary (MEDIUM confidence)
- Python analysis of 742 translator files — counts: 714 with tests, 658 with web tests, 3,428 total web tests, 0 with embedded HTML, 233 deferred, 926 "multiple" items
- `bun test` direct execution — confirmed existing test counts: utilities (67/70 pass), integration (8/8), item (32/32), translator-loader (29/29), utilities-translate (10/10)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Translator test format (TEST-01): HIGH — read directly from Zotero's source in the submodule
- Harness design (TEST-02): HIGH — design follows directly from the source format and existing ztractor API
- Baseline counts (TEST-03): HIGH — derived from direct file analysis
- Pitfalls: HIGH — discovered by running existing tests and inspecting failures

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (translator submodule format is stable; Bun test API is stable)
