# Phase 2: Sandbox Core API - Research

**Researched:** 2026-03-26
**Domain:** Zotero sandbox API compatibility — ZoteroItem, ZU utilities, sandbox globals, calling conventions
**Confidence:** HIGH

## Summary

Phase 2 fixes three distinct categories of incompatibility between ztractor's current sandbox and what real Zotero translators expect. The Zotero translate submodule at `packages/core/translate/` is the authoritative source of truth — its `translate.js` and `utilities_translate.js` define exactly what the sandbox provides.

**Category 1 — Sandbox globals (SAND-05):** Zotero's sandbox injects `Z` (alias for `Zotero`), `ZU` (alias for `Zotero.Utilities`), `attr`, `text`, `innerText`, `request`, `requestText`, `requestJSON`, `requestDocument` as top-level variables inside the translator execution context. The current `TranslatorExecutor` uses `new Function(...)` with explicit named parameters, which means any variable the translator expects at the top scope that isn't in the parameter list causes a `ReferenceError`. The `Embedded Metadata` translator (the most common translator) immediately crashes with `ReferenceError: Z is not defined` because `Z` is not passed as a `new Function` parameter. Zotero's sandbox sets `this._sandboxManager.sandbox.Z = this._sandboxZotero` and prepends all sandbox properties as `var name = this.sandbox.name` at eval time. Ztractor must do the same.

**Category 2 — ZoteroItem API (SAND-01):** The current `ZoteroItem` class in `translator-system-modern.ts` is missing `setExtra(field, value)`, which is defined in Zotero's `_makeSandboxItem()`. More importantly, the class does NOT expose `addTag()`, `addCreator()`, `addNote()`, `addAttachment()` as Zotero API methods visible to translators. Translators set properties directly (`item.title = "..."`, `item.creators.push(...)`) — they do not call `addTag/addCreator` on items. The `complete()` method must trigger `_itemDone` in the sandbox's Zotero context, not just a stored callback. The `item.ts` class (`Item`) has a more complete API but is not used by the modern executor — only `ZoteroItem` from `translator-system-modern.ts` is used.

**Category 3 — ZU utility coverage (SAND-02):** The bundled `utilities-translate-bundle.ts` already provides the full Zotero utility set via `createZoteroUtilities()`. The main gap is that global-scope functions `request`, `requestText`, `requestJSON`, `requestDocument` must be injected as top-level sandbox variables (not just on `ZU`), because translators call them as bare function calls: `await requestDocument(url)` not `await ZU.requestDocument(url)`.

**Primary recommendation:** Fix `createSandbox()` in `TranslatorExecutor` to inject `Z` (alias for `Zotero`), and add `request`/`requestText`/`requestJSON`/`requestDocument`/`innerText` as top-level sandbox variables. Add `setExtra()` to `ZoteroItem`. The `new Function(...)` approach needs a pre-exec variable injection step that mirrors Zotero's `SandboxManager.eval()` pattern.

## Project Constraints (from CLAUDE.md)

- **Package manager:** `bun` — all install/run/test commands use `bun`
- **No Node-specific imports in `packages/core/src/`** — must work in browser
- **Test runner:** Bun's built-in (`bun test`) — no external frameworks
- **Bundler target:** `browser` — `bunup --exports -t browser`
- **Auto-generated files:** `src/utilities-translate-bundle.ts`, `src/translators-registry.ts` must never be manually edited
- **Tab indentation** — follow existing code style
- **Strict TypeScript** — `"strict": true` in tsconfig
- **Verb-first naming** — `createZoteroUtilities()`, `createSandbox()` pattern

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAND-01 | `Zotero.Item` implements the full field/method API that translators use (all item types, all fields, `complete()`, `addTag()`, `addCreator()`, etc.) | Research: `_makeSandboxItem()` in translate.js (lines 2240-2279) defines the authoritative item class. Missing `setExtra()` method; `complete()` must call `sandboxZotero._itemDone(this)`. Translators set fields directly as object properties — the class needs no type gating. |
| SAND-02 | `ZU` implements all methods translators call — text cleaning, ISBN/ISSN/DOI, HTTP helpers, DOM utilities | Research: `utilities.js` (2117 lines) defines all base utilities; `utilities_translate.js` adds `request`, `requestText`, `requestJSON`, `requestDocument`, `doGet`, `doPost`, `processDocuments`, `getItemArray`. Most are already in the bundle. Main gap: `request`/`requestText`/`requestJSON`/`requestDocument` must also be injected as bare sandbox globals (not only on ZU). |
| SAND-05 | Translator calling conventions match Zotero's runtime — `detectWeb()` and `doWeb()` receive correct arguments and `this` context | Research: Zotero injects `Z` (Zotero alias), `ZU` (Zotero.Utilities), `attr`, `text`, `innerText`, `request`, `requestText`, `requestJSON`, `requestDocument` as top-level sandbox variables. Current executor uses `new Function()` with explicit params, missing `Z`, `innerText`, and the bare `request*` globals. Fix: pre-inject all sandbox vars before the translator code runs, matching Zotero's `SandboxManager.eval()` prepend pattern. |
</phase_requirements>

## Standard Stack

### Core (already in project — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun test runner | 1.3.10 | Test execution | Already project-standard |
| `translator-system-modern.ts` | workspace | Sandbox + executor | Phase 2 target — the file being fixed |
| `utilities-translate-bundle.ts` | auto-generated | Zotero utility bundle | Source of ZU methods |
| `item.ts` | workspace | Item class with full API | Has `addTag`, `addCreator`, `addNote`, etc. — may be source of reference |
| `packages/core/translate/` submodule | source-of-truth | Zotero's actual sandbox implementation | Defines exactly what must be compatible |

### No New Dependencies

All fixes are internal to `translator-system-modern.ts`. No new packages required.

## Architecture Patterns

### Pattern 1: Zotero Sandbox Injection (the authoritative model)

Zotero's `_generateSandbox()` sets these top-level sandbox variables (source: `translate.js:2128-2178`):

```javascript
// Injected via importObject (adds all Sandbox methods to sandbox.Zotero):
this._sandboxManager.importObject(this.Sandbox, this);
// Utilities under Zotero.Utilities:
this._sandboxManager.importObject({ Utilities: new Zotero.Utilities.Translate(this) });
// Zotero.Item class:
this._sandboxZotero.Item = this._makeSandboxItem();
// Key aliases:
this._sandboxZotero.Utilities.HTTP = this._sandboxZotero.Utilities;
this._sandboxZotero.isBookmarklet = false;
this._sandboxZotero.isConnector = false;
this._sandboxZotero.isServer = false;
// Sandbox shortcuts (TOP-LEVEL — available without Zotero. prefix):
this._sandboxManager.sandbox.Z = this._sandboxZotero;           // alias for Zotero
this._sandboxManager.sandbox.ZU = this._sandboxZotero.Utilities; // alias for ZU
this._sandboxManager.sandbox.attr = this._attr.bind(this);
this._sandboxManager.sandbox.text = this._text.bind(this);
this._sandboxManager.sandbox.innerText = this._innerText.bind(this);
this._sandboxManager.sandbox.request = ZU.request.bind(ZU);
this._sandboxManager.sandbox.requestText = ZU.requestText.bind(ZU);
this._sandboxManager.sandbox.requestJSON = ZU.requestJSON.bind(ZU);
this._sandboxManager.sandbox.requestDocument = ZU.requestDocument.bind(ZU);
```

Then `SandboxManager.eval()` prepends ALL sandbox properties as local vars before the translator code:
```javascript
for (var prop in this.sandbox) {
    code = "var " + prop + " = this.sandbox." + prop + ";" + code;
}
```

This means `Z`, `ZU`, `attr`, `text`, `innerText`, `request`, `requestText`, `requestJSON`, `requestDocument` are all available as bare identifiers inside translator code.

### Pattern 2: How Translators Use the API

Representative usage patterns seen in real translators:

```javascript
// Embedded Metadata translator — uses Z.debug (Z = Zotero alias)
Z.debug("Embedded Metadata: found " + metaTags.length + " meta tags");

// Typical doWeb — creates items by setting properties directly
var newItem = new Zotero.Item('journalArticle');
newItem.title = text(doc, 'h1');
newItem.creators.push({ firstName: 'John', lastName: 'Doe', creatorType: 'author' });
newItem.complete();

// Modern translators use bare requestDocument()
var doc2 = await requestDocument(url);

// DOM helpers called as top-level
var title = attr(doc, 'meta[name="citation_title"]', 'content');
var body = text(doc, 'article.content');

// item.setExtra() used by some translators (from Zotero 6+)
item.setExtra('Supplemental Data', 'yes');
```

### Pattern 3: The `new Function()` vs. `eval()` Trade-off

The current executor uses `new Function('doc', 'url', 'Zotero', 'ZU', 'attr', 'text', 'XPathResult', ...)` which explicitly names parameters. The Zotero sandbox uses `eval()` inside a closure after prepending all vars.

**Recommended approach:** Keep `new Function()` for security/isolation benefits, but expand the parameter list to include all Zotero sandbox globals: `Z`, `ZU`, `Zotero`, `attr`, `text`, `innerText`, `request`, `requestText`, `requestJSON`, `requestDocument`, `XPathResult`.

Alternatively, switch `createSandbox()` to use the `SandboxManager.eval()` prepend pattern, which handles any future sandbox variables automatically. This is the approach that matches Zotero's own code and scales to new additions without touching the Function signature.

### Pattern 4: ZoteroItem.setExtra()

Zotero's `_makeSandboxItem()` defines `setExtra(field, value)` on the item class (source: `translate.js:2263-2274`):

```javascript
setExtra(field, value) {
    let lines = String(this.extra || "").split("\n");
    let existingIndex = lines.findIndex((line) => line.startsWith(field + ": "));
    if (existingIndex !== -1) {
        lines[existingIndex] = `${field}: ${value}`;
    } else {
        lines.push(`${field}: ${value}`);
    }
    this.extra = lines.join("\n");
}
```

This must be added to `ZoteroItem` in `translator-system-modern.ts`.

### Pattern 5: Zotero.isConnector / isServer / isBookmarklet

Several translators check `Zotero.isConnector`, `Zotero.isServer`, `Zotero.isBookmarklet` to decide behavior (e.g., attachment handling in `translate.js:186-193`). These must be set to `false` in the sandbox:

```javascript
Zotero.isBookmarklet = false;
Zotero.isConnector = false;
Zotero.isServer = false;
```

### Pattern 6: Zotero.Utilities.HTTP (alias)

Zotero sets `this._sandboxZotero.Utilities.HTTP = this._sandboxZotero.Utilities` (translate.js:2143). Some translators call `ZU.HTTP.doGet()` instead of `ZU.doGet()`. This alias must exist.

### Anti-Patterns to Avoid

- **Only fixing the parameter list:** Adding `Z` as a param to `new Function()` fixes the immediate crash but doesn't scale. Future translators may use other sandbox vars. Use the prepend pattern or expand systematically.
- **Duplicating item classes:** There are two item classes: `ZoteroItem` (in `translator-system-modern.ts`) and `Item` (in `item.ts`). Phase 2 should work only on `ZoteroItem` — don't merge them (that's a refactor for later if needed).
- **Adding `addTag()`/`addCreator()` as required methods:** Translators push to `item.creators` and `item.tags` directly. The `addTag()`/`addCreator()` methods on `Item` (from `item.ts`) are the ztractor API — translators don't call them. Don't confuse the two.
- **Touching the auto-generated bundle:** `utilities-translate-bundle.ts` must never be manually edited. The `createZoteroUtilities()` function in `translator-system-modern.ts` is the right place to add any ZU extensions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zotero utilities (text cleaning, ISBN, DOI) | Custom implementations | `utilities-translate-bundle.ts` already bundles the full Zotero utilities | 2117-line file with all methods; already integrated |
| HTTP request methods (request, requestText, etc.) | Custom fetch wrappers | `_translateUtils` from the bundle already has them | They're bound to the mock translate object and handle URL resolution |
| `setExtra()` on item | Complex logic | Verbatim copy from `translate.js:2263-2274` | Exact Zotero implementation — 10 lines |
| XPathResult constants | Custom object | Already defined as a constant object in `translator-system-modern.ts` | It exists, just needs to be in scope |

## Common Pitfalls

### Pitfall 1: `Z is not defined` — the Most Common Crash

**What goes wrong:** Translators like `Embedded Metadata` use `Z.debug(...)` instead of `Zotero.debug(...)`. The current `new Function(...)` call does not pass `Z` as a parameter, so every call to `Z.*` throws `ReferenceError: Z is not defined`.

**Why it happens:** Zotero sets `sandbox.Z = sandboxZotero` and then prepends `var Z = this.sandbox.Z` before the translator code. Ztractor's `new Function()` approach only passes explicitly named params.

**How to avoid:** Add `Z` as a parameter to `new Function()` and pass `sandbox.Zotero` as its value. Or switch to the prepend pattern. Either fix works; the prepend pattern is more future-proof.

**Warning signs:** `ReferenceError: Z is not defined` in any translator test.

### Pitfall 2: Bare `request*` Calls Fail

**What goes wrong:** Modern translators (Zotero 6+) call `await requestDocument(url)`, `await requestJSON(url)` etc. as bare global functions. The current sandbox doesn't inject these globals.

**Why it happens:** The current `createSandbox()` puts these on `ZU` but doesn't inject them as top-level sandbox variables.

**How to avoid:** In `createSandbox()`, add `request`, `requestText`, `requestJSON`, `requestDocument` as explicit sandbox globals (parallel to how `attr` and `text` are already added). They should be bound versions of the ZU methods with URL resolution.

**Warning signs:** `ReferenceError: requestDocument is not defined` or similar in translator execution.

### Pitfall 3: `innerText` Not in Scope

**What goes wrong:** Zotero injects `innerText` as a sandbox global (translate.js:2161). Some translators call `innerText(doc, selector)` as a top-level function. Current sandbox doesn't inject it.

**Why it happens:** Only `attr` and `text` are injected; `innerText` was overlooked.

**How to avoid:** Add `innerText` to the sandbox globals. It should return the inner text of the matching element with whitespace normalization.

**Warning signs:** `ReferenceError: innerText is not defined`.

### Pitfall 4: DOMParser Not Available in Bun Test Environment

**What goes wrong:** The baseline report shows 22 of 24 failures have reason `"undefined is not a constructor (evaluating 'new (dependencies?.DOMParser ?? globalThis.DOMParser)()')"`. This is a test environment issue — `DOMParser` is not a native global in Bun but is provided via the `tests/setup.ts` preload.

**Why it happens:** The baseline script runs `extractMetadata()` which calls `parseHTMLDocument()` which falls back to `globalThis.DOMParser`. In the script context (not `bun test` with preload), `globalThis.DOMParser` is `undefined`.

**How to avoid:** This is a test infrastructure concern, not a Phase 2 sandbox issue. The `baseline.ts` script needs to import `DOMParser` from linkedom or the tests need to be run via `bun test` with the preload. Phase 2 sandbox work should be tested via `bun test` (which has the preload), not via `bun run baseline`.

**Warning signs:** All tests in the baseline script failing with DOMParser constructor error.

### Pitfall 5: `Zotero.Utilities.HTTP` Alias Missing

**What goes wrong:** Some translators call `ZU.HTTP.doGet()` or `Zotero.Utilities.HTTP.request()`. These crash because `Zotero.Utilities.HTTP` is not set.

**Why it happens:** Zotero sets `this._sandboxZotero.Utilities.HTTP = this._sandboxZotero.Utilities` as a self-alias. Ztractor doesn't set this.

**How to avoid:** In `createSandbox()`, after building the Zotero object, set `Zotero.Utilities.HTTP = Zotero.Utilities` (or `ZU.HTTP = ZU`).

**Warning signs:** `TypeError: ZU.HTTP is not an object` or `Cannot read properties of undefined (reading 'doGet')`.

### Pitfall 6: `item.complete()` Called After Translation is "Done"

**What goes wrong:** Zotero's `_itemDone` logs a warning if `complete()` is called after `translate._complete` is true. Ztractor's current `ZoteroItem.complete()` has no such guard and just calls the callback.

**Why it happens:** Translators with async flows may call `complete()` after the `doWeb` promise resolves.

**How to avoid:** The current 100ms setTimeout approach means any `complete()` after 100ms is lost. For Phase 2, keep the existing timeout behavior but document it. Phase 3 (async flows) will address this properly.

**Warning signs:** Items extracted in slow async translators not appearing in results.

### Pitfall 7: `ZoteroItem` vs `Item` Confusion

**What goes wrong:** The project has two item classes:
- `src/translator-system-modern.ts` exports `ZoteroItem` — used by the translator sandbox
- `src/item.ts` exports `Item` — public API item class with `addTag()`, `addCreator()` etc.

Phase 2 work is on `ZoteroItem` only. The `Item` class in `item.ts` has comprehensive methods but they are NOT what Zotero translators call.

**How to avoid:** Do not merge the two classes or import `Item` into the sandbox. `ZoteroItem` just needs `setExtra()` added and the `complete()` method kept as-is.

**Warning signs:** Trying to use `item.addTag()` inside translator code (translators don't do this — they push to `item.tags` directly).

## Code Examples

### What Zotero's Sandbox Injects (source: translate.js:2154-2178)

```javascript
// Source: packages/core/translate/src/translation/translate.js:2154-2178
// All these must exist as top-level sandbox variables when translator code runs:
sandbox.Z = Zotero;                           // MISSING in current ztractor
sandbox.ZU = Zotero.Utilities;                // present
sandbox.attr = attr.bind(this);               // present
sandbox.text = text.bind(this);               // present
sandbox.innerText = innerText.bind(this);     // MISSING
sandbox.request = ZU.request.bind(ZU);        // MISSING as bare global
sandbox.requestText = ZU.requestText.bind(ZU); // MISSING as bare global
sandbox.requestJSON = ZU.requestJSON.bind(ZU); // MISSING as bare global
sandbox.requestDocument = ZU.requestDocument.bind(ZU); // MISSING as bare global
```

### Fixed `createSandbox()` — What Needs to Change

```typescript
// In TranslatorExecutor.createSandbox(), the returned object currently is:
// { Zotero, ZU: wrappedZU }
// And passed to new Function('doc','url','Zotero','ZU','attr','text','XPathResult', ...)

// NEEDS TO BE:
// The new Function() call (or eval prepend) must also include:
// Z (= Zotero), innerText, request, requestText, requestJSON, requestDocument

// Plus Zotero object needs:
Zotero.isConnector = false;
Zotero.isServer = false;
Zotero.isBookmarklet = false;
Zotero.Utilities = wrappedZU;
Zotero.Utilities.HTTP = Zotero.Utilities;  // alias
```

### ZoteroItem.setExtra() (source: translate.js:2263-2274)

```typescript
// Source: packages/core/translate/src/translation/translate.js:2263-2274
setExtra(field: string, value: string): void {
    const lines = String(this.extra || "").split("\n");
    const existingIndex = lines.findIndex((line) => line.startsWith(field + ": "));
    if (existingIndex !== -1) {
        lines[existingIndex] = `${field}: ${value}`;
    } else {
        lines.push(`${field}: ${value}`);
    }
    this.extra = lines.join("\n");
}
```

### innerText helper (derived from translate.js:2199 `_innerText`)

```typescript
// Zotero's _innerText returns the innerText of the matching element
function innerText(
    node: Element | Document | null,
    selector?: string,
    index?: number
): string | null {
    if (!node) return null;
    let elem: Element | null;
    if (selector) {
        if (typeof index === 'number') {
            elem = (node as Element).querySelectorAll(selector).item(index) as Element | null;
        } else {
            elem = (node as Element).querySelector(selector);
        }
    } else {
        elem = node as Element;
    }
    if (!elem) return null;
    // innerText is whitespace-collapsed text (same as text() in practice)
    const content = (elem as any).innerText ?? elem.textContent ?? '';
    return content.replace(/\s+/g, ' ').trim() || null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ZU.doGet()`, `ZU.doPost()` for HTTP | `request()`, `requestText()`, `requestJSON()`, `requestDocument()` as bare globals | Zotero 6.0 | New translators call these as globals; old ones still use `ZU.doGet()`. Both must work. |
| `Z.debug()` for logging | Same (still used in Embedded Metadata, many others) | Never changed | `Z` as Zotero alias is permanent |
| `executor.ts` | `translator-system-modern.ts` | This rewrite | Don't touch `executor.ts`; all sandbox work in `translator-system-modern.ts` |
| `Zotero.Utilities.HTTP.doGet()` | `ZU.doGet()` or `ZU.HTTP.doGet()` | Historical | `HTTP` must remain as alias |

**Deprecated but still widely used:**
- `ZU.doGet()` and `ZU.doPost()`: Deprecated in Zotero 6.0 but ~half the translators still call them. Already handled by `wrappedZU`.
- `ZU.processDocuments()`: Deprecated but still used. Phase 3 scope.

## Open Questions

1. **`new Function()` params vs. eval prepend**
   - What we know: Both approaches work. `new Function()` with explicit params is already in use. Prepend pattern matches Zotero's own code and scales to future additions.
   - What's unclear: Is there a security/isolation reason to keep `new Function()`?
   - Recommendation: Extend the `new Function()` param list for Phase 2 (minimal change, lower risk). Document that switching to prepend pattern is a future refactor option.

2. **`seeAlso` array on items**
   - What we know: `ZoteroItem` in `translator-system-modern.ts` initializes `this.seeAlso = []`. Zotero's `_makeSandboxItem()` also initializes `seeAlso = []`. The `translate.js` `_itemDone` includes `seeAlso` in `allowedObjects`.
   - What's unclear: Whether any current translator in scope sets `item.seeAlso`.
   - Recommendation: Keep `seeAlso` as-is; it's already present.

3. **`Zotero.parentTranslator` property**
   - What we know: Zotero sets `this._sandboxZotero.parentTranslator = ...` on the sandbox. Some translators may check this.
   - What's unclear: Whether any translator in the Phase 2 test set checks it.
   - Recommendation: Set `Zotero.parentTranslator = null` on the sandbox Zotero object. Low-risk one-liner.

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is purely code changes to `translator-system-modern.ts`. No external tools, services, or CLIs needed beyond what's already in the project.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun built-in test runner (1.3.10) |
| Config file | `packages/core/bunfig.toml` — `preload = ["./tests/setup.ts"]` |
| Quick run command | `cd packages/core && bun test tests/translator-system-modern.test.ts` |
| Full suite command | `cd packages/core && bun test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAND-01 | `new Zotero.Item('journalArticle')` creates item; setting `title`, `creators`, `tags`, `extra` works without error | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | Yes (existing ZoteroItem tests) |
| SAND-01 | `item.complete()` triggers callback with correct item data | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | Yes (existing complete() test) |
| SAND-01 | `item.setExtra('DOI', '10.1/abc')` stores correct format in `item.extra` | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | No — Wave 0 |
| SAND-02 | `ZU.cleanAuthor()`, `ZU.cleanISBN()`, `ZU.cleanDOI()`, `ZU.strToISO()` return correct values | unit | `cd packages/core && bun test tests/utilities-translate.test.ts` | Partial (some methods tested) |
| SAND-02 | `request`, `requestText`, `requestJSON`, `requestDocument` are callable as bare globals inside translator code | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | No — Wave 0 |
| SAND-05 | `Z` is available as alias for `Zotero` inside translator code | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | No — Wave 0 |
| SAND-05 | `innerText(doc, selector)` works inside translator code | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | No — Wave 0 |
| SAND-05 | `Embedded Metadata` translator no longer crashes with `Z is not defined` | integration | `cd packages/core && bun test tests/integration.test.ts` | Existing (currently fails) |

### Sampling Rate

- **Per task commit:** `cd packages/core && bun test tests/translator-system-modern.test.ts tests/utilities-translate.test.ts`
- **Per wave merge:** `cd packages/core && bun test`
- **Phase gate:** Full suite green (`189 pass, 1 skip, 0 fail`) + `Embedded Metadata` translator no longer crashes with `Z is not defined`

### Wave 0 Gaps

- [ ] `tests/translator-system-modern.test.ts` — add tests for: `setExtra()`, `Z` alias in sandbox, `innerText` global, bare `request*` globals — covers SAND-01, SAND-02, SAND-05

*(Existing test infrastructure covers the full suite; only new test cases needed, not new files)*

## Sources

### Primary (HIGH confidence)

- `packages/core/translate/src/translation/translate.js:2116-2178` — `_generateSandbox()` — defines the authoritative sandbox setup including `Z`, `ZU`, `attr`, `text`, `innerText`, `request*` globals
- `packages/core/translate/src/translation/translate.js:2240-2279` — `_makeSandboxItem()` — defines `setExtra()`, `complete()`, and all item class properties
- `packages/core/translate/src/translation/sandboxManager.js:36-73` — `SandboxManager.eval()` — defines the prepend pattern
- `packages/core/translate/src/utilities_translate.js:44-441` — `Zotero.Utilities.Translate` — defines all utility methods including `request`, `requestText`, `requestJSON`, `requestDocument`, `doGet`, `doPost`, `processDocuments`
- `packages/core/translate/modules/utilities/utilities.js` — 2117 lines — all base ZU methods (`cleanAuthor`, `cleanISBN`, `cleanDOI`, `capitalizeTitle`, `xpath`, etc.)
- `packages/core/src/translator-system-modern.ts` — current executor — identifies gaps vs. Zotero reference

### Secondary (MEDIUM confidence)

- `packages/core/tests/baseline-report.json` — shows 22/24 Embedded Metadata failures caused by DOMParser env issue, confirms `Z is not defined` is the primary sandbox crash
- `bun test packages/core` output — confirms 189 pass/1 skip/0 fail after Phase 1, pre-existing errors include `Z is not defined` and `doc.evaluate is not a function`

### Tertiary (LOW confidence)

- None — all findings are from direct source reading

## Metadata

**Confidence breakdown:**
- Sandbox globals gap (SAND-05): HIGH — confirmed by reading both Zotero source and ztractor source; `Z` and `request*` globals are provably absent
- ZoteroItem gaps (SAND-01): HIGH — `setExtra()` absence confirmed by direct comparison of `_makeSandboxItem()` vs `ZoteroItem`
- ZU coverage (SAND-02): HIGH — bundle exports verified; gap is injection as globals, not missing methods
- Pitfalls: HIGH — DOMParser/Z/innerText issues confirmed by running `bun test` and reading baseline report

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (Zotero translate API is stable; translate submodule format won't change in 30 days)
