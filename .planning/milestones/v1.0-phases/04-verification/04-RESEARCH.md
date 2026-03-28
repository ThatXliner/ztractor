# Phase 4: Verification - Research

**Researched:** 2026-03-27
**Domain:** Zotero translator compatibility verification — sandbox bug fixes, live translator testing
**Confidence:** HIGH

## Summary

Phase 4 is a verification phase, not a feature-building phase. Its job is to confirm that the sandbox built in Phases 1–3 is compatible enough for real Zotero translators to pass their own test cases. Three pre-existing bugs are blocking full compatibility. Fixing them is required before live translator tests can pass.

The Phase 1 harness infrastructure is complete and functional: `runTranslatorWebTest()`, `compareItems()`, and the `TRANSLATOR_COMPAT`-gated `zotero-compat.test.ts`. The scaffolding exists to run any translator's test cases against `extractMetadata()`. What remains is (1) fixing the three sandbox bugs that cause `extractMetadata()` to fail or produce incorrect results for the target translators, and (2) expanding `zotero-compat.test.ts` with verified tests for the VERIFY-01 target translators.

The current baseline is 211 pass, 1 skip, 1 fail across the full core package test suite. The 1 failing test is a pre-existing unhandled promise rejection bug — not a wrong assertion, but a dangling async operation that Bun reports as an inter-test error. Fixing it is required for VERIFY-02 to be satisfied.

**Primary recommendation:** Fix the three identified bugs (unhandled rejection in `getTranslatorObject`, missing `DOMParser` in Function context, `dependencies` spread override), then add `TRANSLATOR_COMPAT`-gated tests for Wikipedia, arXiv, and reddit as the minimal passing set.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun:test | built-in | Test runner for live translator tests | Project-wide; already used for all tests |
| bun native fetch | native | HTTP requests in runTranslatorWebTest harness | Already used throughout executor |
| linkedom DOMParser | 0.18.5 | DOMParser available in Bun test environment | Already used in setup.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Phase 1 harness (run-test.ts, compare-items.ts) | local | Run translator test cases against extractMetadata() | All VERIFY-01 live tests use this |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TRANSLATOR_COMPAT-gated live tests | Saved HTML fixture files | Fixtures are faster and offline but require curation for each translator and become stale; live tests verify real compatibility |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
No new files needed. All changes are in:
```
packages/core/src/
├── translator-system-modern.ts   # Three bug fixes
packages/core/tests/
├── zotero-compat.test.ts         # New translator test cases added
```

### Pattern 1: TRANSLATOR_COMPAT-Gated Live Tests

**What:** Live tests that fetch real translator test URLs and verify extracted items match expected output. Gated by `TRANSLATOR_COMPAT=1` environment variable to keep `bun test` fast by default.

**When to use:** All VERIFY-01 verification tests that require actual HTTP requests.

**Example from existing code:**
```typescript
// packages/core/tests/zotero-compat.test.ts
test.skipIf(!process.env.TRANSLATOR_COMPAT)(
  'Wikipedia: single article test case passes',
  async () => {
    const registry = new BundledRegistry();
    const meta = (await registry.getAllTranslatorMetadata()).find(m => m.label === 'Wikipedia');
    const code = await registry.getTranslatorCode(meta!.translatorID);
    const testCases = parseTestCases(code!).filter(t => t.type === 'web' && !t.defer);
    const result = await runTranslatorWebTest(testCases[1], 30000); // oldid= URL
    expect(result.status).toBe('pass');
  },
  { timeout: 30000 }
);
```

### Pattern 2: Bug Fix — Unhandled Rejection in `getTranslatorObject`

**What:** When `getTranslatorObject` calls `callback({})` on line 815 (translator not found path) or line 851 (catch path), the user's callback may throw (e.g., `rdf.Zotero.RDF` on empty object). The current code catches the first throw but then calls `callback({})` again in the catch block, creating a second throw that is unhandled.

**Root cause (confirmed by code inspection):**
```typescript
// translator-system-modern.ts — current buggy code (simplified)
async getTranslatorObject(callback) {
  try {
    const t = await getTranslatorById(translatorId);
    if (!t) {
      callback({});   // <-- user callback may throw here
      return;         // this return is skipped if callback throws
    }
    // ...
    callback(transObj);
  } catch (e) {
    console.error('Error in getTranslatorObject:', e);
    callback({});     // <-- SECOND callback invocation, also throws -> unhandled
  }
}
```

**Fix:**
```typescript
async getTranslatorObject(callback: Function) {
  if (!translatorId || !executor.options.getTranslatorById) {
    try { callback({}); } catch (_e) {}
    return;
  }
  try {
    const embeddedTranslator = await executor.options.getTranslatorById(translatorId);
    if (!embeddedTranslator) {
      console.warn(`Embedded translator ${translatorId} not found`);
      try { callback({}); } catch (_e) {}
      return;
    }
    // ... build transObj ...
    try { callback(transObj); } catch (_e) {}
  } catch (e) {
    console.error('Error in getTranslatorObject:', e);
    try { callback({}); } catch (_e) {}
  }
},
```

**Why this approach:** Translator callbacks that receive an empty object when the embedded translator isn't found will throw — this is expected and should be silently swallowed, not propagate as an unhandled rejection.

### Pattern 3: Bug Fix — Missing `DOMParser` in Translator Function Context

**What:** The `new Function(...)` constructor that executes translator code does NOT include `DOMParser` as a parameter. Several translators (Wikipedia's `filterTagsInHTML`, arXiv's XML parser) call `new DOMParser()` inside their code, expecting it to be available as a global.

**How it manifests:** `new DOMParser()` works in browser environments (native global) and in Bun tests with `setup.ts` preload (which sets `globalThis.DOMParser`). But it fails in `bun run` production contexts where `globalThis.DOMParser` is undefined, or when the Function scope shadows globals.

**Fix:** Add `DOMParser` to both the `detectWeb` and `doWeb` Function parameter lists:
```typescript
const fn = new Function(
  'doc', 'url', 'Zotero', 'ZU', 'Z', 'attr', 'text', 'innerText',
  'request', 'requestText', 'requestJSON', 'requestDocument', 'XPathResult',
  'DOMParser',   // <-- add this
  `
    ${translator.code}
    if (typeof doWeb === 'function') { ... }
  `
);
const result = fn(
  doc, url, sandbox.Zotero, sandbox.ZU, sandbox.Zotero,
  attr, text, innerText,
  sandbox.ZU.request?.bind(sandbox.ZU),
  sandbox.ZU.requestText?.bind(sandbox.ZU),
  sandbox.ZU.requestJSON?.bind(sandbox.ZU),
  sandbox.ZU.requestDocument?.bind(sandbox.ZU),
  XPathResult,
  dependencies?.DOMParser ?? (globalThis as any).DOMParser,   // <-- add this
);
```

Apply to both `detectWeb` and `doWeb` Function constructors, AND to the embedded translator Function in `getTranslatorObject`.

### Pattern 4: Bug Fix — `dependencies` Spread Override

**What:** In `extractMetadata()` (index.ts line 125), the executor is created as:
```typescript
const executor = new TranslatorExecutor({
  dependencies,          // may be undefined
  getTranslatorById: ...
});
```

In `TranslatorExecutor`'s constructor, the default is:
```typescript
this.options = {
  dependencies: { DOMParser: (globalThis as any).DOMParser },
  ...options,  // { dependencies: undefined } overrides the default!
};
```

JavaScript spread of `{ dependencies: undefined }` replaces the default `{ DOMParser: ... }` with `undefined`.

**Fix (in TranslatorExecutor constructor):**
```typescript
constructor(options: TranslatorExecutorOptions = {}) {
  this.options = {
    ...options,
    dependencies: options.dependencies ?? {
      DOMParser: (globalThis as any).DOMParser,
    },
  };
}
```

Note: The spread order matters — put `...options` first so user-provided values win, then apply the `dependencies` override only when it's nullish.

### Anti-Patterns to Avoid

- **Calling callback() in the catch block of getTranslatorObject after already calling it:** Creates double invocations that produce unhandled rejections. Always wrap callback invocations in their own try-catch.
- **Assuming DOMParser is globally available in Bun:** It is in test context (setup.ts), but not in production Bun. Always inject it as a Function parameter using the dependencies chain.
- **Testing translators with `defer: true` test cases:** These require JS rendering which `extractMetadata()` cannot do — skip them. The harness already handles this with the `defer` flag check.
- **Running TRANSLATOR_COMPAT tests without the env var:** These make real HTTP requests and should be opt-in only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translator test case parsing | Custom parser | `parseTestCases()` from Phase 1 harness | Already handles `/** BEGIN TEST CASES **/` delimiters |
| Item comparison | Custom diff | `compareItems()` from Phase 1 harness | Handles relaxed field matching, normalizeItem |
| Live test running | Custom fetch harness | `runTranslatorWebTest()` from Phase 1 | Already integrates with extractMetadata + compareItems |
| Translator registry lookup | Direct file reads | `BundledRegistry.getTranslatorCode()` | Already lazily loads the generated registry |

**Key insight:** All the test infrastructure exists. Phase 4 is primarily bug fixes + wiring tests.

## Common Pitfalls

### Pitfall 1: Unhandled Rejection Appearing as Test Failure
**What goes wrong:** A test passes its assertions but Bun reports it as `(fail)` due to an unhandled promise rejection from a subsequent async operation that started during the test.
**Why it happens:** `getTranslatorObject` is an `async` function. When translator code calls `translator.getTranslatorObject(callback)`, the returned promise is not pushed to `pendingWork`. After `doWeb` drains pendingWork and resolves, the `getTranslatorObject` async continuation runs independently. If it throws, the rejection is unhandled.
**How to avoid:** (1) Wrap all callback invocations in try-catch inside `getTranslatorObject`. (2) Confirm by running the suspect test in isolation with `bun test -t "test name"` — "1 pass, 0 fail, 1 error" indicates the unhandled rejection pattern.
**Warning signs:** A test shows `(fail)` but when run in isolation shows `1 pass, 0 fail, 1 error`.

### Pitfall 2: Live Tests Failing Due to Rate Limiting
**What goes wrong:** `TRANSLATOR_COMPAT=1 bun test` runs many translator web tests in sequence. Sites like Wikipedia, arXiv, or news sites may return 403/429 for rapid sequential requests.
**Why it happens:** The harness uses a 15-second timeout but doesn't throttle requests.
**How to avoid:** Test against a small curated set of stable URLs. Wikipedia `?oldid=` URLs are pinned and return consistent content. arXiv `abs/` pages are stable. Limit to 1-2 test cases per translator, not the full test suite.
**Warning signs:** Tests pass locally but fail in CI due to rate limiting.

### Pitfall 3: Embedded Metadata's `exports` Variable
**What goes wrong:** Embedded Metadata uses `exports.itemType` (line 232) to check for a user-provided override. In the sandbox Function context, `exports` is not defined, which would throw `ReferenceError: exports is not defined`.
**Why it happens:** Embedded Metadata assumes a CommonJS-like environment where `exports` is available.
**How to avoid:** Add `exports = {}` as a sandbox global or inject it as a Function parameter. This ensures `exports.itemType` evaluates to `undefined` rather than throwing. Check if this is already handled.
**Warning signs:** `Error in detectWeb for Embedded Metadata: ReferenceError: exports is not defined`.

### Pitfall 4: Wikipedia's `doc.location.search` Accessing in `detectWeb`
**What goes wrong:** Wikipedia's `detectWeb` calls `new URLSearchParams(doc.location.search)` before checking `action-view`. If `doc.location` is undefined (DOMParser doesn't set it), this throws.
**Why it happens:** `linkedom`'s DOMParser doesn't attach a `location` property to parsed documents.
**How to avoid:** The executor already catches `detectWeb` errors and returns `null` (try-catch at line 531). The translator is skipped. This is acceptable behavior — not a blocking bug.
**Warning signs:** `Error in detectWeb for Wikipedia: TypeError: Cannot read properties of undefined (reading 'search')` in console output — this is expected and handled.

### Pitfall 5: arXiv Test Case URL Changes
**What goes wrong:** arXiv test case for `https://arxiv.org/abs/...` returns a page that no longer matches the expected item fields (titles change, abstracts update, authors get fixed).
**Why it happens:** arXiv allows paper updates; the test was written against a specific version's content.
**How to avoid:** Use `abs/...v1` URLs (specific version) rather than `abs/...` (latest version) in test cases. The existing arXiv test cases already do this for most entries.

## Runtime State Inventory

Step 2.5: SKIPPED (this is not a rename/refactor/migration phase — no runtime state to inventory).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Test runner | ✓ | 1.3.10 | — |
| Network (internet) | TRANSLATOR_COMPAT live tests | ✓ (dev machine) | — | Run with `TRANSLATOR_COMPAT=` unset to skip |
| linkedom | setup.ts DOMParser in tests | ✓ | 0.18.5 (node package dep) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- Network access: if unavailable, omit `TRANSLATOR_COMPAT=1` and all live tests are skipped automatically.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built-in) |
| Config file | `packages/core/bunfig.toml` (preload: `tests/setup.ts`) |
| Quick run command | `bun test packages/core/tests/zotero-compat.test.ts` |
| Full suite command | `bun test packages/core/` |
| Live translator test command | `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERIFY-01 | Wikipedia single article passes Zotero test case | live (TRANSLATOR_COMPAT) | `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` | ❌ Wave 0 |
| VERIFY-01 | arXiv abs/ single paper passes Zotero test case | live (TRANSLATOR_COMPAT) | `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` | ❌ Wave 0 |
| VERIFY-01 | reddit forumPost single post passes Zotero test case | live (TRANSLATOR_COMPAT) | `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` | ❌ Wave 0 |
| VERIFY-01 | At least one news site translator passes (The Guardian or NYTimes) | live (TRANSLATOR_COMPAT) | `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` | ❌ Wave 0 |
| VERIFY-02 | All 211+ existing tests continue to pass (no regressions from bug fixes) | unit/integration | `bun test packages/core/` | ✅ existing |
| VERIFY-02 | Pre-existing integration test failure resolved (unhandled rejection fixed) | integration | `bun test packages/core/tests/integration.test.ts` | ✅ existing |

### Sampling Rate
- **Per task commit:** `bun test packages/core/` (offline only — 211+ tests, fast)
- **Per wave merge:** `bun test packages/core/`
- **Phase gate:** `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` (live) AND `bun test packages/core/` (offline) both green

### Wave 0 Gaps
- [ ] `packages/core/tests/zotero-compat.test.ts` — add TRANSLATOR_COMPAT-gated test cases for Wikipedia, arXiv, reddit, and one news site
- [ ] Confirm `exports` variable handling in Embedded Metadata (may already work or may need no-op injection)

*(Note: `zotero-compat.test.ts` exists with 1 always-on test and 1 TRANSLATOR_COMPAT-gated test. New tests are ADDITIONS to this file.)*

## Code Examples

### Existing Harness Entry Point
```typescript
// Source: packages/core/tests/harness/run-test.ts
export async function runTranslatorWebTest(
  testCase: ZoteroTestCase,
  timeoutMs: number = 15000,
): Promise<TestResult> {
  const url = testCase.url ?? testCase.input;
  if (!url) return { status: 'skip', reason: 'No URL in test case' };
  if (testCase.defer) return { status: 'skip', reason: 'Requires JS rendering' };
  const result = await extractMetadata({ url, timeout: timeoutMs });
  if (!result.success) return { status: 'fail', reason: result.error ?? 'extractMetadata failed' };
  if (testCase.items === 'multiple') {
    return result.items?.length ? { status: 'partial', reason: 'multiple items — not compared' }
      : { status: 'fail', reason: 'Expected multiple items, got none' };
  }
  return compareItems(testCase.items, result.items as Record<string, unknown>[]);
}
```

### Adding VERIFY-01 Tests to zotero-compat.test.ts
```typescript
// Pattern for each VERIFY-01 translator
test.skipIf(!process.env.TRANSLATOR_COMPAT)(
  'Wikipedia: oldid-pinned article passes',
  async () => {
    const registry = new BundledRegistry();
    const meta = (await registry.getAllTranslatorMetadata()).find(m => m.label === 'Wikipedia');
    expect(meta).toBeDefined();
    const code = await registry.getTranslatorCode(meta!.translatorID);
    const cases = parseTestCases(code!).filter(t => t.type === 'web' && !t.defer);
    // Use the Zotero article (oldid=485342619) — stable, pinned revision
    const zoteroCase = cases.find(c => c.url?.includes('Zotero'));
    expect(zoteroCase).toBeDefined();
    const result = await runTranslatorWebTest(zoteroCase!, 30000);
    expect(result.status).toBe('pass');
  },
  { timeout: 30000 }
);
```

### getTranslatorObject Fix Pattern
```typescript
// All callback invocations wrapped in try-catch to prevent unhandled rejections
async getTranslatorObject(callback: Function) {
  if (!translatorId || !executor.options.getTranslatorById) {
    try { callback({}); } catch (_e) {}
    return;
  }
  try {
    const embeddedTranslator = await executor.options.getTranslatorById(translatorId);
    if (!embeddedTranslator) {
      console.warn(`Embedded translator ${translatorId} not found`);
      try { callback({}); } catch (_e) {}
      return;
    }
    // ... build sandbox and transObj ...
    try { callback(transObj); } catch (_e) {}
  } catch (e) {
    console.error('Error in getTranslatorObject:', e);
    try { callback({}); } catch (_e) {}
  }
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ZU.doGet()`/`doPost()`/`processDocuments()` | `request*()`/`requestDocument()` (promise-based) | Zotero 6.0 | Both must work; old API still used by ~200+ translators |
| `Zotero.done()` / `Zotero.wait()` | No-op stubs (already added Phase 3) | Zotero 3.x | No-ops prevent crashes |

**Deprecated/outdated:**
- Import/export/search translator types (type != 4): ztractor only bundles web translators (type 4). When Embedded Metadata calls `Zotero.loadTranslator("import")` for the RDF translator (type 1), it will not be found. The sandbox handles this gracefully (warns + calls callback({})).

## Open Questions

1. **`exports` variable in Embedded Metadata**
   - What we know: Embedded Metadata references `exports.itemType` (line 232 of translator). In a strict `new Function()` context, `exports` is not defined.
   - What's unclear: Is this already handled somewhere? Does the failure mode cause a caught error or an unhandled rejection?
   - Recommendation: Check if `exports` throws on access in the current sandbox. If it does, add `exports = {}` as either a Function parameter or a prepended `var exports = {};` line before translator code. Investigation required at plan-writing time.

2. **Reddit API reliability**
   - What we know: Reddit's comment JSON API (e.g., `/r/zotero/comments/.../.json`) is public but may have rate limits.
   - What's unclear: Will the test cases reliably pass in CI without auth?
   - Recommendation: Use reddit as the "social/general" translator since it uses `requestJSON` only (simpler than Embedded Metadata path). If reddit proves unreliable, substitute with a simpler translator.

3. **arXiv `requestText` + XML parsing**
   - What we know: arXiv uses `await requestText(url)` + `new DOMParser().parseFromString(text, 'application/xml')`. Both the `requestText` global and `DOMParser` injection are needed.
   - What's unclear: Does linkedom's DOMParser handle `application/xml` correctly for arXiv's Atom feed?
   - Recommendation: After DOMParser injection fix, test arXiv's XML parsing path. If linkedom doesn't handle XML MIME type, a fallback to `text/html` may be needed.

## Sources

### Primary (HIGH confidence)
- `packages/core/src/translator-system-modern.ts` — All three bugs confirmed by code inspection and test isolation
- `packages/core/tests/integration.test.ts` — Pre-existing failure confirmed: `bun test -t "Wikipedia"` shows "1 pass, 0 fail, 1 error" (unhandled rejection between tests)
- `packages/core/tests/zotero-compat.test.ts` — Existing TRANSLATOR_COMPAT pattern confirmed working
- `packages/core/tests/harness/run-test.ts` — Harness API confirmed: `runTranslatorWebTest()`, `runTranslatorTests()`
- `packages/core/translators/Wikipedia.js` — Wikipedia pattern confirmed: uses `ZU.doGet()` + `new DOMParser()` in `filterTagsInHTML()`
- `packages/core/translators/arXiv.org.js` — arXiv pattern confirmed: uses `await requestText()` + `new DOMParser().parseFromString(text, 'application/xml')`
- `packages/core/translators/reddit.js` — Reddit pattern confirmed: only uses `await requestJSON(jsonUrl)` — simplest live test candidate

### Secondary (MEDIUM confidence)
- Bun test runner behavior: `1 pass, 0 fail, 1 error` pattern confirms unhandled rejection attribution — verified by `bun test -t "Wikipedia"`
- JavaScript spread semantics: `{ a: 'default', ...{ a: undefined } }` results in `{ a: undefined }` — confirmed by Node.js eval

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all three bugs confirmed by code inspection and test execution
- Fix approach: HIGH — standard patterns; fixes are small and targeted
- Translator test targets: MEDIUM — Wikipedia and reddit are strong candidates; arXiv's XML DOMParser path needs validation

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable Zotero API, no external dependencies beyond live translator URLs)

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VERIFY-01 | Academic publishers (arXiv, Wikipedia), news site, and social translator pass Zotero test cases via Phase 1 harness | Bug fixes (Patterns 2–4) unlock these translators; harness infrastructure already exists; TRANSLATOR_COMPAT-gated tests added to zotero-compat.test.ts |
| VERIFY-02 | All 173+ ztractor unit/integration tests continue to pass after sandbox changes | Current baseline: 211 pass, 1 skip, 1 fail; fix the pre-existing unhandled rejection (Pattern 2) to get to 212 pass, 1 skip, 0 fail |

</phase_requirements>
