# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

### Auto-Generated Bundle Files Must Not Be Manually Edited

**Issue:** `packages/core/src/utilities-translate-bundle.ts` (21KB) and `packages/core/src/translators-registry.ts` (236KB) are auto-generated files with strict warnings against manual editing.

**Files:**
- `packages/core/src/utilities-translate-bundle.ts`
- `packages/core/src/translators-registry.ts`
- `packages/core/bundle-translate.ts` (generator)

**Impact:** Any manual changes to these files will be overwritten on next build. Developers may waste time editing the wrong files. The generator must be understood for proper maintenance.

**Fix approach:**
1. Document the build pipeline clearly in CLAUDE.md (already done)
2. Add strong comments at the top of generated files
3. Consider linting rules to prevent accidental manual edits
4. The patch file `translation-bundle-patch.js` is the proper place for post-processing fixes

---

### `eval()` Usage for Dynamic `require()` Patching

**Issue:** `bundle-translate.ts` replaces certain `require()` calls with `eval('require')(...)` to prevent bundlers from attempting static resolution of Node.js-only imports.

**Pattern observed (line 104-106):**
```typescript
output = output.replace(
  /\brequire\(("(?:\.\/[^"]+|jsdom)")\)/g,
  `(eval('require'))($1)`,
);
```

**Files:**
- `packages/core/bundle-translate.ts` (lines 100-107)
- `packages/core/src/utilities-translate-bundle.ts` (many instances: XRegExp, jsdom, RDF modules)

**Impact:**
- This is intentional and necessary: the code paths are guarded by runtime checks (`Zotero.isNode`, `typeof process !== 'undefined'`) and never execute in browser/ESM builds
- However, `eval()` is flagged by security tools and static analyzers as high-risk
- Code is difficult to debug because dynamic `require()` calls are obscured

**Fix approach:**
- Document this pattern explicitly in code comments
- Keep runtime guards robust and testable
- Monitor that these code paths are only hit in Node.js environments
- Consider alternative: conditional exports or module federation (lower priority)

---

### Unresolved TODOs in Source Code

**Issue:** Several TODO/FIXME items exist in the codebase:

**File: `packages/core/src/registry.ts`:**
- Line 28: `// TODO: tree-shakable` - BundledRegistry should be tree-shakable but isn't documented how
- Line 58: `// TODO: cache` - HTTPRegistry doesn't cache translator code fetched from remote
- Line 94: `// XXX: use Zod to verify?` - Metadata validation from Zotero API uses no schema validation

**File: `packages/core/bundle-translate.ts`:**
- Line 14: `// TODO: concat in order` - Suggests the file concatenation order may not be fully resolved
- Line 15: `// TODO: modules folder too` - Some module files may not be included in bundling

**Files:**
- `packages/core/src/registry.ts` (lines 28, 58, 94)
- `packages/core/bundle-translate.ts` (lines 14-15)
- `packages/core/translation-bundle-patch.js` (line 15-16): TODO comment about init code needing adaptation

**Impact:**
- Tree-shaking could reduce bundle size for browser builds
- HTTPRegistry could improve performance with caching strategy
- Validation gaps for remote metadata could allow malformed translators

**Fix approach:**
1. **Tree-shaking**: Implement conditional exports or document why it's infeasible
2. **HTTP caching**: Add LRU cache to HTTPRegistry with configurable TTL
3. **Metadata validation**: Introduce Zod schema for TranslatorMetadata validation, especially for remote sources
4. **Bundling order**: Verify and document the correct concatenation order in CONCAT_ORDER array

---

### Function Constructor Used for Translator Code Execution

**Issue:** `translator-system-modern.ts` uses `new Function()` constructor (lines 450, 502, 668) to dynamically execute translator code in a sandboxed context.

**Pattern observed (lines 450-476, 502-531):**
```typescript
const fn = new Function(
  'doc',
  'url',
  'Zotero',
  'ZU',
  'attr',
  'text',
  'XPathResult',
  `
    ${translator.code}

    if (typeof detectWeb === 'function') {
      return detectWeb(doc, url);
    }
    return null;
  `
);

const result = fn(
  doc,
  url,
  sandbox.Zotero,
  sandbox.ZU,
  attr,
  text,
  XPathResult
);
```

**Files:** `packages/core/src/translator-system-modern.ts` (lines 450, 502, 668)

**Impact:**
- This is the **intentional core security model**: translators are untrusted Zotero code that must execute in a controlled context
- Function constructor is the only way to execute arbitrary translator code safely without polluting the global namespace
- Translators are from the official Zotero repository (~600+ translators), trusted source
- Sandboxing is incomplete: translators have access to network (`ZU.request`, `doGet`, `doPost`) and can make cross-origin requests

**Fix approach:**
- This is acceptable for the current threat model (official Zotero translators)
- Add explicit documentation of the security model and assumptions
- Consider adding CSP-like restrictions for future (e.g., URL whitelist for HTTP requests)
- Test that sensitive globals (crypto, localStorage) are not accessible from translator context

---

## Security Considerations

### Incomplete Sandbox Isolation

**Risk:** While translators execute in `new Function()` context, they have access to:
- Full network capabilities via `ZU.doGet()`, `ZU.doPost()`, `ZU.request()`
- DOM parsing and XPath evaluation (intentional)
- Promise API
- No restrictions on outbound HTTP destinations

**Files:**
- `packages/core/src/translator-system-modern.ts` (sandbox creation, lines 553-616)
- `packages/core/src/utilities-translate-bundle.ts` (HTTP module)

**Current mitigation:**
- Translators come from official Zotero repository, considered trusted sources
- No sensitive operations (passwords, keys) are passed to translators
- HTTP requests use explicit callbacks, not ambient access

**Recommendations:**
1. Document the trust boundary: "Translators are trusted Zotero code"
2. Add URL validation/whitelist if translators need to be verified
3. Consider implementing request logging for audit trail
4. For Node.js usage, ensure no sensitive environment variables leak to translator context

---

### Environment Variable Leakage

**Risk:** Translators can access `process.env` in Node.js (via `Zotero.isNode` checks or direct access), potentially exposing:
- API keys (Crossref email via `Zotero.Prefs` in bundled config)
- Database credentials
- Auth tokens

**Files:**
- `packages/core/src/utilities-translate-bundle.ts` (Zotero.isNode checks)
- `packages/core/translation-bundle-patch.js` (HTTP implementation references `process`)
- `packages/core/src/translator-system-modern.ts` (DEBUG_TRANSLATORS env var access, lines 214, 606)

**Current mitigation:**
- DEBUG_TRANSLATORS is a development-only flag
- Translators don't explicitly access `process.env` in current Zotero code
- Process/require are initially undefined in bundle (line 9-10)

**Recommendations:**
1. Document that DEBUG_TRANSLATORS should never be enabled in production
2. If passing credentials to translators (e.g., API keys), sanitize the object passed
3. Consider sandboxing process object from translator context in Node.js

---

## Performance Bottlenecks

### Large Auto-Generated Bundle (21KB Utilities, 236KB Registry)

**Problem:**
- `utilities-translate-bundle.ts` is 21,450 lines (21KB)
- `translators-registry.ts` is 236,880 lines (237KB) - this is the major bottleneck
- Both are loaded for every metadata extraction operation

**Files:**
- `packages/core/src/utilities-translate-bundle.ts`
- `packages/core/src/translators-registry.ts` (auto-generated by `bundle-translators.ts`)

**Cause:**
- Translator registry embeds ALL translator code (~600 translators) as JavaScript strings
- Zotero Utilities Translate module is monolithic with 100+ helper functions

**Impact:**
- Large initial module load time
- High memory footprint (247KB before gzip)
- Slows down `import` statements even if only a few translators are needed
- Registry must be lazy-loaded, but first access has latency

**Improvement path:**
1. **Lazy loading** (already attempted with dynamic `import()` in `registry.ts` line 34): Document why full registry load is necessary
2. **Code splitting**: Separate translator code into chunks by type or category (medium effort)
3. **Tree-shaking**: Remove unused translator code if targeting specific sites (high effort)
4. **Compression**: Registry is highly compressible (test with gzip/brotli)
5. **Streaming**: For large payloads, consider streaming translator code on-demand

---

### Translator Execution Has Arbitrary Latency

**Problem:** `translator-system-modern.ts` doWeb method (lines 488-548) uses `setTimeout(..., 100)` for synchronous translators to allow async operations.

**Pattern (lines 540-542):**
```typescript
} else {
  // Give synchronous translators a moment for async operations
  setTimeout(() => resolve(items), 100);
}
```

**Files:** `packages/core/src/translator-system-modern.ts` (line 541)

**Impact:**
- Every synchronous translator gets an artificial 100ms delay
- Total latency for metadata extraction depends on translator count and timeout
- No way to know if translator has actually completed or just consumed timeout

**Fix approach:**
1. Detect if translator returns a Promise and only wait for that
2. Add optional timeout parameter to `doWeb()`
3. Use MutationObserver or similar to detect async completions within timeout
4. Document expected latency in API documentation

---

## Fragile Areas

### Metadata JSON Parsing in Translators

**Files:**
- `packages/core/src/translator-loader.ts` (lines 6-31)
- `packages/core/bundle-translators.ts` (metadata extraction from translator files)

**Why fragile:**
- Translator metadata is extracted from first JSON block in file comment (line 12):
  ```typescript
  const match = code.match(/^\s*({[\s\S]*?})(?:\s*\n|$)/);
  ```
- This regex is fragile to whitespace and comment formatting variations
- No schema validation - any JSON that parses is accepted

**Safe modification:**
1. Add comprehensive tests for edge cases:
   - Comments with embedded braces
   - Multiple JSON objects in header
   - Malformed JSON
2. Introduce Zod schema validation immediately after parsing
3. Add detailed error messages for parsing failures

**Test coverage:** `packages/core/tests/translator-loader.test.ts` exists, verify it covers edge cases

---

### URL Pattern Matching with Loose Regex Construction

**Files:**
- `packages/core/src/translator-loader.ts` (lines 56-65)
- `packages/core/src/index.ts` (line 115)

**Why fragile:**
- `matchesTarget()` uses `Function()` constructor to compile translator target patterns:
  ```typescript
  const regex = Function('return new RegExp(arguments[0])')(targetPattern) as RegExp;
  ```
- Translator patterns are provided by Zotero, but malformed patterns could cause:
  - ReDoS (catastrophic backtracking) on certain URLs
  - Unexpected regex compilation errors
  - Silent failures that hide broken translators

**Safe modification:**
1. Add timeout to regex matching (currently none)
2. Test translator patterns against known ReDoS attack vectors
3. Log pattern compilation failures with translator ID for debugging

**Test coverage:** Check `packages/core/tests/translator-loader.test.ts` for pattern matching edge cases

---

### HTTPRegistry Metadata Validation Gap

**Files:** `packages/core/src/registry.ts` (lines 89-95)

**Why fragile:**
- Remote metadata from Zotero API is parsed directly as JSON without schema validation:
  ```typescript
  // XXX: use Zod to verify?
  return (await this.fetchFunction(url)).json();
  ```
- Malformed metadata could cause:
  - Type errors downstream in `extractMetadata()`
  - Crashes in translator matching logic
  - Silent failures if required fields are missing

**Safe modification:**
1. Create Zod schema for TranslatorMetadata
2. Validate HTTP response before returning
3. Log validation errors with translator details
4. Fallback gracefully if metadata is invalid

**Priority:** Medium - only affects users using HTTPRegistry (not default BundledRegistry)

---

## Test Coverage Gaps

### Missing Integration Tests for Modern Executor

**What's not tested:**
- Full extraction flow with real translator code
- Error recovery when translators throw
- Async translator behavior beyond 100ms timeout
- Embedded translator loading and execution
- Network-based requests through ZU helpers

**Files:**
- `packages/core/tests/translator-system-modern.test.ts` (469 lines) - Good unit test coverage
- `packages/core/tests/integration.test.ts` (new file in git status, WIP)

**Risk:** Medium - features appear to work but integration edge cases untested

**Priority:** Complete `integration.test.ts` with real translator samples and edge cases

---

### No Tests for Translator Error Handling

**What's not tested:**
- What happens when `detectWeb()` throws an error
- What happens when `doWeb()` throws mid-execution
- Translators that create items but then throw
- Translators with memory leaks or infinite loops

**Impact:** Error handling behavior is documented in code but untested in practice

**Fix approach:** Add error case tests to `translator-system-modern.test.ts`:
```typescript
test('handles detectWeb errors gracefully', async () => {
  // Create translator with throwing detectWeb
  // Verify error is caught and logged
  // Verify next translator is tried
});
```

---

### Bundle Correctness Not Validated

**What's not tested:**
- Generated `utilities-translate-bundle.ts` can actually be imported
- All translator registry entries have valid code
- CONCAT_ORDER produces correct concatenation sequence
- Post-processing patches work correctly

**Files:**
- `packages/core/bundle-translate.ts`
- `packages/core/bundle-translators.ts`

**Current validation:** Build succeeds if no errors thrown, but no semantic validation

**Fix approach:**
1. Add smoke test after build: import bundle and verify exports exist
2. Validate translator registry: sample 10% of translators and run detectWeb
3. Compare bundle size before/after to catch accidental removals

---

## Known Limitations

### Synchronous Translator Behavior With Async Operations

**Issue:** Translators can use async patterns (Promise, setTimeout) but the execution model doesn't properly await them in all cases.

**Example:** If a translator creates an item and calls `item.complete()` asynchronously:
```javascript
function doWeb(doc, url) {
  const item = new Zotero.Item('article');
  fetch('/api/data').then(response => {
    item.title = response.data.title;
    item.complete();  // async completion
  });
  // Function returns immediately, callback fires later
}
```

**Files:**
- `packages/core/src/translator-system-modern.ts` (lines 540-542)

**Current behavior:** 100ms timeout allows some async completion, but not all

**Limitation:** No way to know if translator has truly completed

**Workaround:** Translators must follow patterns used by Zotero (return Promise from doWeb if using async)

---

### Limited XPath Support in Browser Environment

**Issue:** XPath queries depend on `doc.evaluate()` which may not work with all DOM parsers.

**Files:**
- `packages/core/src/translator-system-modern.ts` (XPathResult constants, lines 332-343)
- Browser-based deployments use native DOM

**Current mitigation:** Node.js version uses hybrid linkedom+xmldom (documented in CLAUDE.md)

**Limitation:** Browser builds have limited XPath support compared to Firefox (original Zotero environment)

---

## Missing Critical Features

### No HTTP Request Timeout Configuration

**Issue:** `doGet()`, `doPost()`, and HTTP requests use hardcoded 15s timeout (from HTTP.request options), but translators cannot override this.

**Files:** `packages/core/src/utilities-translate-bundle.ts` (HTTP module)

**Impact:** Slow networks may hit timeout even if valid translation is possible

**Blocks:** Users with slow connections; international deployments

**Migration path:** Expose timeout as parameter to TranslatorExecutor options

---

### No Translator Cancellation/Abort

**Issue:** Once a translator starts executing, there's no way to cancel it. A hung translator blocks other translators from being tried.

**Files:**
- `packages/core/src/translator-system-modern.ts` (detectWeb/doWeb methods)
- `packages/core/src/index.ts` (extractMetadata tries translators in sequence)

**Impact:** Single broken translator can make extraction fail

**Blocks:** Timeout-sensitive applications; batch processing

**Migration path:**
1. Add AbortSignal parameter to detectWeb/doWeb
2. Implement AbortController wrapper in Function constructor execution

---

### No Translator Execution Profiling/Instrumentation

**Issue:** No visibility into which translators are tried, how long they take, or why they fail.

**Files:** `packages/core/src/index.ts` (lines 139-161)

**Current approach:** Errors are swallowed silently, only final result is returned

**Impact:** Debugging failed extraction attempts is difficult

**Recommendation:** Add optional instrumentation callback to extractMetadata:
```typescript
onTranslatorAttempt?: (info: {
  label: string;
  detected: boolean;
  success: boolean;
  duration: number;
  error?: string;
}) => void
```

---

## Dependencies at Risk

### Zotero Translator Repository Hard-Coded URL

**Risk:** HTTPRegistry hardcodes `https://www.zotero.org/repo/` (ZOTERO_CONFIG in utilities-translate-bundle.ts)

**Files:** `packages/core/src/utilities-translate-bundle.ts` (lines 47-52)

**Impact:** If Zotero's repository moves or becomes unavailable, HTTPRegistry breaks silently

**Current mitigation:** Default uses BundledRegistry (not HTTPRegistry)

**Recommendation:** Make ZOTERO_CONFIG configurable via environment or parameter

---

### Zotero Version Hard-Coded to 5.0.78

**Issue:** Bundle declares version 5.0.78 (utilities-translate-bundle.ts line 59) but may not match actual Zotero translator expectations.

**Files:** `packages/core/src/utilities-translate-bundle.ts` (line 59)

**Impact:** Some translators may check version and skip execution if mismatch

**Fix approach:** Document which Zotero version this was built from; consider version as build parameter

---

## Architecture Concerns

### Disconnect Between BundledRegistry and HTTPRegistry

**Issue:** Two completely different registry implementations with different behavior:
- **BundledRegistry**: Lazy-loads all translators on first use, 100% available
- **HTTPRegistry**: Fetches from Zotero API, may fail, no caching

**Files:**
- `packages/core/src/registry.ts` (lines 22-97)
- `packages/core/src/index.ts` (line 84)

**Impact:**
- Users must choose at init time which strategy to use
- No fallback from HTTPRegistry to bundled if network fails
- Feature parity issues (HTTPRegistry lacks caching that BundledRegistry might have)

**Recommendation:**
1. Implement fallback: try HTTPRegistry, fall back to BundledRegistry
2. Add cache to HTTPRegistry
3. Consider unified interface that abstracts the difference

---

### Modern Executor Incompleteness vs. Original System

**Issue:** `translator-system-modern.ts` is a clean rewrite of the old executor, but may have behavioral differences.

**Files:**
- `packages/core/src/translator-system-modern.ts` (new, modern)
- `packages/core/src/executor.ts` (old, in git status as deleted - M)

**Status:** According to git, executor.ts is modified/deleted, suggesting transition is in progress

**Risk:** If old executor is still referenced somewhere, there are two conflicting implementations

**Fix approach:**
1. Verify executor.ts is fully replaced by translator-system-modern.ts
2. Update all imports to use modern version
3. Run integration tests to verify behavioral equivalence with old system

---

## Recommendations by Priority

### HIGH

1. **Complete missing validation**: Add Zod schemas for TranslatorMetadata (HTTPRegistry especially)
2. **Finish integration test suite**: Real translator execution, error cases, async handling
3. **Document security model explicitly**: What translators can/cannot do, threat model assumptions
4. **Resolve executor.ts transition**: Ensure old system is fully replaced

### MEDIUM

1. **Add HTTP caching to HTTPRegistry**: Improve performance for remote registries
2. **Implement translator timeout/abort**: Allow killing hung translators
3. **Resolve build TODOs**: Tree-shaking, module concatenation order verification
4. **Add profiling instrumentation**: Debug visibility into translator execution

### LOW

1. **Optimize bundle size**: Code splitting, tree-shaking, consider streaming
2. **Make Zotero config configurable**: Version, repository URL
3. **Improve ReDoS protection**: Add timeout to regex matching
4. **Add request logging**: Audit trail for translator HTTP requests

---

*Concerns audit: 2026-03-26*
