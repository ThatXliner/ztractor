# Phase 3: Sandbox Advanced Flows - Research

**Researched:** 2026-03-27
**Domain:** Zotero translator sandbox — async HTTP flows, item selection, translator delegation
**Confidence:** HIGH

## Summary

Phase 3 completes the sandbox's async API surface. The four requirements cover two categories of work: (1) HTTP sub-request APIs (`ZU.processDocuments`, `ZU.doGet`, `ZU.doPost`) and (2) control-flow APIs (`Zotero.selectItems`, `Zotero.loadTranslator`). Both categories have partial stubs already present in `translator-system-modern.ts` but with known bugs and missing async completion tracking.

The central problem for all four requirements is **async completion tracking**. The current `doWeb` executor resolves after a flat 100ms timeout, which cannot reliably capture items produced by callbacks that fire after HTTP responses. A proper solution must either (a) return a promise from `doWeb` that awaits the async work, or (b) implement the increment/decrement async process counter that Zotero's real runtime uses. Given that ztractor already uses `async/await` throughout, wrapping all async operations in tracked promises is the cleanest approach.

The `Zotero.loadTranslator` path has two confirmed bugs in the current `createTranslatorLoader` closure: `this.options` and `this.createSandbox` reference `this` as the returned object literal, not the outer `TranslatorExecutor` instance. These must be fixed by capturing the executor reference before returning the object.

**Primary recommendation:** Implement a pending-work counter (or promise array) on the sandbox context, replace the 100ms timeout with proper async resolution, then implement `processDocuments`/`doGet`/`doPost`/`selectItems`/`loadTranslator` against that mechanism.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun built-in fetch | native | HTTP requests for `processDocuments`, `doGet`, `doPost` | Already used by ZU.request/requestText; browser-compatible |
| DOMParser (injected) | native | Parse fetched HTML into Document for `processDocuments` | Dependency-injected; already present in executor options |
| bun:test | built-in | Unit and integration tests | Project-wide test runner |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `utilities-translate-bundle.ts` `Zotero.HTTP.request` | bundled | Low-level HTTP fetch with headers, timeout, successCodes | Used by `request`/`requestText`/`requestJSON`; reuse for all sub-request APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pending-work promise array | increment/decrement async counter (Zotero style) | Counter requires global state on translate object; promise array is simpler and sufficient |
| Awaiting `doWeb` return promise | 100ms timeout | Timeout is unreliable with multi-hop HTTP; awaiting promises is correct |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
No new files needed. All changes belong in:
```
packages/core/src/
├── translator-system-modern.ts   # All sandbox + executor changes
tests/
├── translator-system-modern.test.ts   # New tests for advanced flows
```

### Pattern 1: Pending-Work Promise Tracking

**What:** Track in-flight async operations started inside `doWeb` by accumulating them into an array, then awaiting `Promise.all` before resolving the executor's outer promise.

**When to use:** Every async operation that may produce items after `doWeb` returns (processDocuments callbacks, doGet callbacks, loadTranslator/translate calls).

**How it works in ztractor:**
The sandbox context object passed to `createSandbox` gets a `_pendingWork: Promise<any>[]` field. Every async boundary (processDocuments fetch, doGet fetch, loadTranslator.translate) pushes its own promise into that array. After `doWeb` completes (or its returned promise settles), the executor awaits `Promise.all(pendingWork)` before resolving with `items`.

```typescript
// Source: derived from translator-system-modern.ts doWeb
const pendingWork: Promise<any>[] = [];
const sandbox = this.createSandbox(doc, url, onItemComplete, pendingWork);

// Execute doWeb...
const result = fn(doc, url, sandbox.Zotero, sandbox.ZU, ...);

if (result && typeof result.then === 'function') {
  await result;
}
// Wait for all async sub-requests the translator started
await Promise.all(pendingWork);
resolve(items);
```

### Pattern 2: `ZU.processDocuments` Implementation

**What:** Fetch each URL using `Zotero.HTTP.request` (already in the bundle), parse the response body as HTML using the injected `DOMParser`, call the processor callback with the resulting Document.

**Signature (from source):**
```javascript
// ZU.processDocuments(urls, processor, noCompleteOnError?)
// urls: string | string[]
// processor: (doc: Document, url: string) => void | Promise<void>
```

**Key detail:** The processor callback receives `(doc, doc.location.href)` — the document needs a `location.href` property set to the fetched URL. This requires wrapping the parsed Document in a proxy or using the existing `dependencies.parseHTMLDocument` if available.

**Implementation approach for ztractor:**
```typescript
wrappedZU.processDocuments = async function(
  urls: string | string[],
  processor: (doc: Document, url: string) => void | Promise<void>
): Promise<void> {
  const urlList = typeof urls === 'string' ? [urls] : [...urls];
  const resolved = urlList.map(u => new URL(u, pageUrl).href);
  const work = resolved.map(async (fetchUrl) => {
    const response = await fetch(fetchUrl);
    const html = await response.text();
    const doc = parseDocumentWithLocation(html, fetchUrl, dependencies);
    await processor(doc, fetchUrl);
  });
  const p = Promise.all(work);
  pendingWork.push(p);
  await p;
};
```

### Pattern 3: `ZU.doGet` / `ZU.doPost` Implementation

**What:** Legacy callback-based HTTP helpers. Both take a URL (or array of URLs for `doGet`), make an HTTP request, and call a processor callback with `(responseText, xmlhttp, url)`.

**doGet signature (from translate source):**
```javascript
// ZU.doGet(urls, processor, done?, responseCharset?, requestHeaders?, successCodes?)
// processor: (text: string, xmlhttp: any, url: string) => void
// done: () => void  — called after all URLs processed
```

**doPost signature (from translate source):**
```javascript
// ZU.doPost(url, body, onDone, headers?, responseCharset?, successCodes?)
// onDone: (text: string, xmlhttp: any) => void
```

**Key details:**
- `doGet` accepts an array of URLs and iterates through them recursively
- Both must resolve URLs relative to the page URL
- The `xmlhttp` arg passed to the callback is a fake object with at minimum `responseText`, `status`, and `responseURL` — translators read `responseText` off it
- These are **deprecated** in Zotero 6 (prefer `request*` methods) but are heavily used by existing translators

**Implementation approach:**
```typescript
wrappedZU.doGet = function(
  urls: string | string[],
  processor?: (text: string, xmlhttp: any, url: string) => void,
  done?: () => void
): void {
  const urlList = typeof urls === 'string' ? [urls] : [...urls];
  const p = (async () => {
    for (const rawUrl of urlList) {
      const fetchUrl = new URL(rawUrl, pageUrl).href;
      const resp = await fetch(fetchUrl);
      const text = await resp.text();
      const fakeXhr = { responseText: text, status: resp.status, responseURL: fetchUrl };
      if (processor) processor(text, fakeXhr, fetchUrl);
    }
    if (done) done();
  })();
  pendingWork.push(p);
};
```

### Pattern 4: `Zotero.selectItems` — Already Correct

**What:** The existing implementation at `translator-system-modern.ts:669` auto-selects all items by calling `callback(itemList)`. This is the correct behavior for a headless extractor.

**When to verify:** The `selectItems` implementation is synchronous and immediately invokes the callback. This is correct as long as the callback's subsequent work (usually calling `ZU.processDocuments`) is tracked via `pendingWork`. No code change needed for `selectItems` itself; the fix is ensuring the async work that follows it is tracked.

### Pattern 5: `Zotero.loadTranslator` — Fix Bug + Add `translate()` Method

**What:** The `createTranslatorLoader` object returned by `createTranslatorLoader()` currently has two `this`-context bugs and is missing the `translate()` method that most real translators call.

**Bugs to fix:**
1. Line 729: `!this.options.getTranslatorById` — `this` is the object literal, not the executor. Fix: capture `const executor = this` before `return {`.
2. Line 743: `this.createSandbox(...)` — same `this` capture issue.
3. Missing: `translate()` method — called by translators like `translator.setTranslator(...); translator.translate()` to run the embedded translator's `doWeb` without needing `getTranslatorObject`.

**Two invocation patterns used by real translators:**

Pattern A (via `getTranslatorObject`):
```javascript
var translator = Zotero.loadTranslator('web');
translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
translator.setDocument(doc);
translator.setHandler('itemDone', function(obj, item) { item.complete(); });
translator.getTranslatorObject(function(trans) {
  trans.doWeb(doc, url);
});
```

Pattern B (via `translate()`):
```javascript
var translator = Zotero.loadTranslator('web');
translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
translator.setDocument(doc);
translator.setHandler('itemDone', function(obj, item) { item.complete(); });
translator.translate();
```

**`translate()` implementation approach:**
```typescript
async translate() {
  if (!translatorId || !executor.options.getTranslatorById) return;
  const embeddedTranslator = await executor.options.getTranslatorById(translatorId);
  if (!embeddedTranslator) return;
  const p = executor.doWeb(embeddedTranslator, translatorDoc, url)
    .then(items => {
      for (const item of items) {
        if (handlers.itemDone) handlers.itemDone(null, item);
        if (onItemComplete) onItemComplete(item);
      }
    });
  pendingWork.push(p);
  await p;
}
```

### Anti-Patterns to Avoid

- **100ms timeout as sole async fence:** Translators that chain `selectItems` → `processDocuments` → `loadTranslator` can take hundreds of milliseconds. The 100ms timeout will race and return empty items. Remove it in favor of `Promise.all(pendingWork)`.
- **Calling `new URL(url, base)` without try/catch:** Some translator-provided URLs may be malformed. Wrap in try/catch and fall back to the raw string.
- **Passing `this` into nested object methods:** JavaScript object literals do not inherit the outer class's `this`. Always capture `const executor = this` before returning the loader object.
- **Forgetting to push promises into `pendingWork` from inside callbacks:** If `processDocuments` is called inside a `selectItems` callback, the async work still needs to be tracked. Push to the `pendingWork` array that was captured in the original `createSandbox` closure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP fetch with headers | custom fetch wrapper | `Zotero.HTTP.request` already in bundle | Handles `successCodes`, headers, response charset |
| HTML parsing with URL | custom parser wrapper | `dependencies.parseHTMLDocument(html, url)` (injected) | Already handles linkedom/browser differences |
| Async coordination | manual event emitters | `Promise` + `Promise.all` | Native, already used throughout executor |

**Key insight:** The bundled `utilities-translate-bundle.ts` already exports `Zotero.HTTP.request` which handles low-level HTTP. The wrappedZU methods for `processDocuments`, `doGet`, `doPost` should use `fetch` directly (or `Zotero.HTTP.request` for header forwarding) — not re-implement HTTP from scratch.

## Common Pitfalls

### Pitfall 1: The 100ms Timeout Race
**What goes wrong:** `doWeb` resolves after 100ms. A translator calls `ZU.processDocuments`, which starts an HTTP fetch that takes 200ms. The `items` array is empty when returned.
**Why it happens:** The current async fence (`setTimeout(() => resolve(items), 100)`) predates the pending-work tracking design.
**How to avoid:** Replace the timeout with `await Promise.all(pendingWork)` after the `doWeb` call resolves.
**Warning signs:** Tests that mock `fetch` and verify items return empty even when the mock is synchronous.

### Pitfall 2: `this` Context in `createTranslatorLoader`
**What goes wrong:** `this.options.getTranslatorById` throws `Cannot read properties of undefined` because `this` in the object literal is the loader object, not the `TranslatorExecutor`.
**Why it happens:** Arrow functions or explicit capture (`const executor = this`) must be used when a method on a returned object literal needs to access the outer class.
**How to avoid:** Add `const executor = this;` at the top of `createTranslatorLoader` and replace all `this.options` and `this.createSandbox` references with `executor.options` and `executor.createSandbox`.
**Warning signs:** `Zotero.loadTranslator` path silently calls `callback({})` even when `getTranslatorById` is registered.

### Pitfall 3: Missing `translate()` Method
**What goes wrong:** Translator calls `translator.translate()` — method does not exist — TypeError thrown silently, no items collected.
**Why it happens:** `getTranslatorObject(callback)` was implemented but `translate()` was not — real translators use both patterns.
**How to avoid:** Implement `translate()` as the more direct path: load translator by ID, run `doWeb` on it, pipe `itemDone` handler output.
**Warning signs:** Translators that use `setTranslator` + `translate()` (like AIP, Polygon, Figshare, Primo, many others) produce zero items.

### Pitfall 4: `doc.location.href` Missing on Fetched Documents
**What goes wrong:** `processDocuments` calls `processor(doc, doc.location.href)` — `doc.location` is undefined on a plain `DOMParser`-parsed document.
**Why it happens:** `DOMParser` does not set `location` on the resulting document.
**How to avoid:** When calling `processor`, pass the fetched URL explicitly as the second argument (already the correct Zotero signature: `processor(doc, url)`). The processor itself accesses it via the second parameter. However, some translators also read `doc.location.href` directly inside the processor — wrap the document or attach a mock `location` property.
**Warning signs:** Translators reading `doc.location.href` inside their `scrape(doc, url)` callback get `undefined`.

### Pitfall 5: `pendingWork` Not Threaded Through Nested Calls
**What goes wrong:** `selectItems` callback calls `processDocuments`, which is an async operation. But the `pendingWork` array from the outer `doWeb` call is out of scope inside the callback closure.
**Why it happens:** The `pendingWork` array must be passed into (or shared via closure with) every place that creates async work — including callbacks registered from inside translator code.
**How to avoid:** Create `pendingWork` once per `doWeb` invocation and pass it into `createSandbox`. Both `createSandbox` and the ZU wrapper methods close over the same `pendingWork` array.

## Code Examples

### Pending-Work Integration in `doWeb`
```typescript
// Source: translator-system-modern.ts (proposed pattern)
async doWeb(translator: Translator, doc: Document, url: string): Promise<ZoteroItem[]> {
  return new Promise((resolve) => {
    const items: ZoteroItem[] = [];
    const pendingWork: Promise<any>[] = [];

    try {
      const sandbox = this.createSandbox(doc, url, (item) => items.push(item), pendingWork);

      const fn = new Function('doc', 'url', 'Zotero', 'ZU', /* ... */, translatorBodyCode);
      const result = fn(doc, url, sandbox.Zotero, sandbox.ZU, /* ... */);

      const settle = async () => {
        if (result && typeof result.then === 'function') await result;
        // Drain all async work the translator started
        let prev = -1;
        while (pendingWork.length !== prev) {
          prev = pendingWork.length;
          await Promise.all(pendingWork);
        }
        resolve(items);
      };

      settle().catch((e) => {
        console.error(`Error in doWeb for ${translator.metadata.label}:`, e);
        resolve(items);
      });
    } catch (e) {
      console.error(`Error in doWeb for ${translator.metadata.label}:`, e);
      resolve([]);
    }
  });
}
```

Note: The `while (pendingWork.length !== prev)` loop handles the case where a `processDocuments` callback itself calls `processDocuments` again (chained fetches). Each iteration drains any new work added during the previous round.

### `createSandbox` Signature Extension
```typescript
// Source: translator-system-modern.ts (proposed pattern)
private createSandbox(
  doc: Document,
  url: string,
  onItemComplete?: (item: ZoteroItem) => void,
  pendingWork?: Promise<any>[]   // <-- new param
) {
  // ...
  wrappedZU.processDocuments = async (urls, processor) => { /* push to pendingWork */ };
  wrappedZU.doGet = (urls, processor, done) => { /* push to pendingWork */ };
  wrappedZU.doPost = (url, body, onDone) => { /* push to pendingWork */ };
  // ...
}
```

### Fake XHR Object for `doGet`/`doPost` Callbacks
```typescript
// Source: derived from utilities_translate.js doGet callback signature
const fakeXhr = {
  responseText: text,
  status: resp.status,
  responseURL: fetchUrl,
  getAllResponseHeaders: () => '',
};
// doGet processor: (responseText, xmlhttp, url)
if (processor) processor(text, fakeXhr, fetchUrl);
// doPost onDone: (responseText, xmlhttp)
if (onDone) onDone(text, fakeXhr);
```

### `createTranslatorLoader` `this` Fix
```typescript
// Source: translator-system-modern.ts (bug at lines 729, 743)
private createTranslatorLoader(doc, url, onItemComplete, pendingWork) {
  const executor = this;  // <-- capture before returning object
  let translatorId: string | null = null;
  // ...
  return {
    async getTranslatorObject(callback: Function) {
      if (!translatorId || !executor.options.getTranslatorById) { // <-- use executor
        callback({});
        return;
      }
      const embeddedTranslator = await executor.options.getTranslatorById(translatorId);
      const embeddedSandbox = executor.createSandbox(translatorDoc, url, ...); // <-- use executor
      // ...
    },
    async translate() {
      if (!translatorId || !executor.options.getTranslatorById) return;
      const embeddedTranslator = await executor.options.getTranslatorById(translatorId);
      if (!embeddedTranslator) return;
      const p = executor.doWeb(embeddedTranslator, translatorDoc, url)
        .then(subItems => {
          for (const item of subItems) {
            if (handlers.itemDone) handlers.itemDone(null, item);
            if (onItemComplete) onItemComplete(item);
          }
        });
      if (pendingWork) pendingWork.push(p);
      await p;
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ZU.doGet`/`doPost`/`processDocuments` callback-style | `ZU.request`/`requestText`/`requestJSON`/`requestDocument` promise-style | Zotero 6.0 | Old callbacks still used in hundreds of translators; both must work |
| `Zotero.done()` + `Zotero.wait()` (seen in older FW framework translators) | Not supported in ztractor | Zotero connector era | Some very old translators call these; they should be no-ops to avoid crashes |

**Deprecated/outdated:**
- `Zotero.done()` / `Zotero.wait()`: Old synchronization primitives from Zotero's connector. Add as no-ops to `Zotero` sandbox object to prevent `TypeError: Zotero.done is not a function` in legacy translators.
- `ZU.loadDocument(url, succeeded, failed)`: Deprecated wrapper around `processDocuments`. The bundle already implements it by calling `processDocuments` — this just needs to work once `processDocuments` is implemented.
- `Zotero.Utilities.processDocuments(...)`: Old spelling (without `ZU.`). Seen in `BioOne.js`. Should be aliased: `wrappedZU = sandbox.Zotero.Utilities = sandbox.ZU`.

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|------------------|
| SAND-03 | `ZU.processDocuments()` works correctly | Pattern 2 above: fetch URL, parse as HTML, call processor with `(doc, url)`. Requires `pendingWork` tracking. |
| SAND-04 | `ZU.doGet()` / `ZU.doPost()` work correctly | Pattern 3 above: callback-style wrappers over `fetch`. Requires fake XHR object and `pendingWork` tracking. |
| SAND-06 | Multi-item selection flow works | Pattern 4 above: existing `selectItems` is correct; async work after it must use `pendingWork`. |
| SAND-07 | Translator-to-translator calls work | Pattern 5 above: fix `this` bugs in `createTranslatorLoader`, add `translate()` method. |

</phase_requirements>

## Open Questions

1. **`Zotero.HTTP.wrapDocument` in the bundle**
   - What we know: `utilities-translate-bundle.ts` line 21265 has a `wrapDocument` that uses Node.js `require('url')` — incompatible with browser target.
   - What's unclear: Is `wrapDocument` called by the `request` method when `responseType === 'document'`? If so, `requestDocument` is broken in browser context.
   - Recommendation: In `wrappedZU.processDocuments`, bypass `wrapDocument` entirely — call `fetch` directly and attach a mock `location` object to the parsed document manually.

2. **`Zotero.Utilities.processDocuments` alias**
   - What we know: `BioOne.js` calls `Zotero.Utilities.processDocuments(url, fn)` (older style). The sandbox currently sets `Zotero.Utilities = wrappedZU`.
   - What's unclear: Does `Zotero.Utilities` already alias to `wrappedZU` in createSandbox?
   - Recommendation: Confirm the alias is set in `createSandbox`; if not, add it. This is a one-liner.

3. **`Zotero.done()` / `Zotero.wait()` no-ops**
   - What we know: Some translators (American Prospect FW framework) call `Zotero.done()` and `Zotero.wait()`.
   - What's unclear: How common are these calls? Do any translators in the test suite use them?
   - Recommendation: Add `Zotero.done = () => {}` and `Zotero.wait = () => {}` as no-ops in `createSandbox`. Zero cost, prevents crashes.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is pure TypeScript code changes to an existing module, using native fetch which is already present in Bun and browsers).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built-in) |
| Config file | `packages/core/bunfig.toml` (preload: `tests/setup.ts`) |
| Quick run command | `bun test packages/core/tests/translator-system-modern.test.ts` |
| Full suite command | `bun test packages/core/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAND-03 | `ZU.processDocuments(urls, processor)` fetches URL and delivers Document to processor | unit (fetch mock) | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-03 | Items produced inside `processDocuments` processor callback are collected | unit (fetch mock) | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-04 | `ZU.doGet(url, processor)` delivers responseText to callback | unit (fetch mock) | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-04 | `ZU.doGet(urls, processor, done)` iterates multiple URLs and calls done | unit (fetch mock) | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-04 | `ZU.doPost(url, body, onDone)` delivers responseText to callback | unit (fetch mock) | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-06 | `Zotero.selectItems(items, callback)` calls callback with all items | unit | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-06 | Translator that calls `selectItems` then `processDocuments` collects all items | integration (fetch mock) | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-07 | `Zotero.loadTranslator('web').setTranslator(id).translate()` executes embedded translator | unit | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-07 | `getTranslatorObject(cb)` passes doWeb/detectWeb functions to callback | unit | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |
| SAND-07 | Items from embedded translator collected via `itemDone` handler | unit | `bun test packages/core/tests/translator-system-modern.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test packages/core/tests/translator-system-modern.test.ts`
- **Per wave merge:** `bun test packages/core/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/core/tests/translator-system-modern.test.ts` — add describe blocks for SAND-03, SAND-04, SAND-06, SAND-07 with fetch mocking using `bun:test` `mock.module` or `spyOn(globalThis, 'fetch')`

*(Existing file has 32 tests. New tests are additions to the same file.)*

## Sources

### Primary (HIGH confidence)
- `packages/core/translate/src/utilities_translate.js` — Authoritative Zotero source for `processDocuments` (line 239), `doGet` (line 457), `doPost` (line 526) signatures and callback contracts
- `packages/core/translate/src/translation/translate.js` — Authoritative source for `loadTranslator` safeTranslator object (line 318), `selectItems` (line 561), `translate()` method (line 441)
- `packages/core/src/translator-system-modern.ts` — Current ztractor implementation; bugs identified at lines 729, 735, 743

### Secondary (MEDIUM confidence)
- Real translators in `packages/core/translators/` — Polygon.js, AIP.js, Primo.js, Figshare.js confirmed usage of all four API patterns
- `packages/core/translate/src/http.js` — `Zotero.HTTP.processDocuments` is a stub (throws "not implemented"); confirms ztractor must implement it directly

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, only native fetch and existing bundled utilities
- Architecture: HIGH — all four API signatures verified directly from Zotero source code
- Pitfalls: HIGH — bugs confirmed by code inspection; async timing pitfall confirmed by existing 100ms timeout logic

**Research date:** 2026-03-27
**Valid until:** 2026-05-27 (stable Zotero API surface, no external dependencies)
