# Phase 5: Node.js Package - Research

**Researched:** 2026-03-27
**Domain:** Node.js package wiring — missing core exports, symlink environment issue, test baseline
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — pure infrastructure phase.

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key findings from codebase analysis:
- `packages/node/src/index.ts` and `dom-utils.ts` already exist and are correct
- Core (`packages/core/src/index.ts`) is missing exports needed by node tests:
  - `ZU` (alias for `ZoteroUtilities` from `translator-system-modern.ts`)
  - `Item` (alias for `ZoteroItem` from `translator-system-modern.ts`)
  - `parseTranslatorMetadata` (from `translator-loader.ts`)
  - `executeDetectWeb`, `executeDoWeb` (from `translator-system-modern.ts`)
- `Translator` type is already exported via registry types
- Package.json for node package looks correct

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NODE-01 | `ztractor-node` package exists with linkedom as the DOM implementation (pre-wired, no manual dependency injection needed) | `packages/node/src/index.ts` already wraps core with injected linkedom/SafeDOMParser — verified functional |
| NODE-02 | `ztractor-node` supports XPath queries (`document.evaluate()`) via xmldom or compatible implementation | `packages/node/src/dom-utils.ts` implements full XPath bridge (linkedom + xmldom + xpath library) — verified in code |
| NODE-03 | `ztractor-node` exports the same API surface as `ztractor` core | Requires adding missing exports to `packages/core/src/index.ts` — see Gap Analysis below |
</phase_requirements>

## Summary

Phase 5 is primarily an export wiring task. The `packages/node` source code (`index.ts`, `dom-utils.ts`) is complete and correct. The blocker is that `packages/core/src/index.ts` does not export several symbols that `packages/node` tests import from `ztractor`.

Two categories of work are needed. First, core needs new re-exports: `ZU` (alias for `ZoteroUtilities`), `Item` (the full `Item` class from `item.ts` — distinct from the `ZoteroItem` type interface), `parseTranslatorMetadata`, `executeDetectWeb`, and `executeDoWeb`. Second, there is a broken symlink issue in `packages/node/node_modules/linkedom` pointing to a non-existent `.bun/` path — this causes the `executor.test.ts` to fail with `ENOENT` when run from the repo root via `bun test packages/node/tests/...`.

`executeDetectWeb` and `executeDoWeb` do not currently exist as standalone exported functions — they are instance methods on `TranslatorExecutor`. The plan must create thin wrapper functions that instantiate `TranslatorExecutor` and delegate to those methods, matching the call signatures expected by tests.

**Primary recommendation:** Add five exports to `packages/core/src/index.ts`, create two thin wrapper functions for `executeDetectWeb`/`executeDoWeb`, and fix the broken linkedom symlink by running `bun install` from within `packages/node`.

## Gap Analysis

### What the tests import vs what core exports

| Import | Test file | Exists in core source | Exported from core `index.ts` |
|--------|-----------|----------------------|-------------------------------|
| `ZU` | `index.test.ts`, `edge-cases.test.ts` | Yes — `ZoteroUtilities as ZU` in `translator-system-modern.ts` line 998 | NO |
| `Item` | `index.test.ts`, `edge-cases.test.ts` | Yes — `Item` class in `packages/core/src/item.ts` | NO |
| `parseTranslatorMetadata` | `index.test.ts`, `edge-cases.test.ts` | Yes — `translator-loader.ts` line 6 | NO |
| `executeDetectWeb` | `executor.test.ts`, `xpath-advanced.test.ts` | NO — only `TranslatorExecutor.detectWeb()` instance method | NO |
| `executeDoWeb` | `executor.test.ts`, `xpath-advanced.test.ts` | NO — only `TranslatorExecutor.doWeb()` instance method | NO |
| `Translator` (type) | `executor.test.ts` | Yes — exported from `registry.ts` | YES (via `export type { TranslatorRegistry, TranslatorMetadata }` from registry) |

**Important distinction:** The `Item` class in `packages/core/src/item.ts` is different from the `ZoteroItem` interface in `types.ts`. Tests use `Item` as a constructable class with `setComplete()`, `toJSON()`, `addCreator()`, `addNote()`, `addTag()` methods. The `ZoteroItem` name in the codebase refers to the plain type interface, not the class. Core `index.ts` exports the type `ZoteroItem` but NOT the `Item` class.

### `executeDetectWeb` / `executeDoWeb` wrapper contract

From `executor.test.ts`, the expected signatures are:

```typescript
executeDetectWeb(translator: Translator, doc: Document, url: string): Promise<string | false | null>
executeDoWeb(translator: Translator, doc: Document, url: string): Promise<ZoteroItem[]>
```

`TranslatorExecutor` constructor takes `TranslatorExecutorOptions` (which includes `dependencies` and `getTranslatorById`). For the standalone wrapper functions, no `getTranslatorById` is needed since the translator is passed directly. The wrappers should create a `TranslatorExecutor` with empty options and call `.detectWeb()` / `.doWeb()` on it.

Test expectations for error cases:
- `executeDetectWeb` returns `null` on error or when no `detectWeb` function found
- `executeDoWeb` returns `[]` on error — `TranslatorExecutor.doWeb()` already has this behavior

## Standard Stack

### Core (already present — no new dependencies needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| linkedom | 0.18.12 (installed) | Fast HTML DOM parser for Node.js | Already in `packages/node/package.json` as `^0.18.5` |
| @xmldom/xmldom | 0.8.x | XPath-capable XML parser for hybrid XPath bridge | Already in `packages/node/package.json` |
| xpath | 0.0.34 | XPath expression evaluator | Already in `packages/node/package.json` |
| ztractor (workspace:*) | local | Core package dependency | Already wired |

No new dependencies are needed for this phase.

### Build tool

| Tool | Command | Notes |
|------|---------|-------|
| bunup | `bunx bunup --exports` | Already configured in `packages/node/package.json` |
| bun | `bun test` | Test runner |

## Architecture Patterns

### Export pattern used in this codebase

Named re-exports from internal modules using `export { X } from "./module"` and `export type { X } from "./module"`. One-level barrel only — no nested barrels.

```typescript
// Source: packages/core/src/index.ts (existing pattern)
export { BundledRegistry, HTTPRegistry } from "./registry";
export type { TranslatorRegistry, TranslatorMetadata } from "./registry";
```

New exports to add follow the same pattern:

```typescript
// Re-export ZU and Item class from their source modules
export { ZoteroUtilities as ZU } from "./translator-system-modern";
export { Item } from "./item";
export { parseTranslatorMetadata } from "./translator-loader";

// Thin wrapper functions for executeDetectWeb and executeDoWeb
export async function executeDetectWeb(
  translator: Translator,
  doc: Document,
  url: string,
): Promise<string | false | null> {
  const executor = new TranslatorExecutor({});
  return executor.detectWeb(translator, doc, url);
}

export async function executeDoWeb(
  translator: Translator,
  doc: Document,
  url: string,
): Promise<ZoteroItem[]> {
  const executor = new TranslatorExecutor({});
  return executor.doWeb(translator, doc, url) as Promise<ZoteroItem[]>;
}
```

### `TranslatorExecutor.detectWeb` error return behavior

From source (`translator-system-modern.ts` line 595), `detectWeb` catches errors and returns `null`. The test expects `null` on error, which means no additional try-catch is needed in the wrapper.

### `Translator` type location

`Translator` is defined in `packages/core/src/registry.ts`. The test imports `type { Translator } from 'ztractor'`. Currently `index.ts` only exports `TranslatorRegistry` and `TranslatorMetadata` types from registry. The `Translator` type needs to be added to the registry type export.

Checking `registry.ts` exports to confirm:

```typescript
// packages/core/src/registry.ts
export type { TranslatorMetadata, Translator }
```

The `index.ts` line reads:
```typescript
export type { TranslatorRegistry, TranslatorMetadata } from "./registry";
```

`Translator` is NOT currently re-exported from `index.ts` — it needs to be added.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XPath in Node.js | Custom XPath evaluator | Already implemented in `dom-utils.ts` using `xpath` + `@xmldom/xmldom` | Full implementation already present |
| DOM parsing | Custom parser | linkedom's `parseHTML` + `SafeDOMParser` | Already implemented |
| Broken symlinks | Manual symlinking | `bun install` from within `packages/node` | Bun manages workspace symlinks |

## Common Pitfalls

### Pitfall 1: `Item` vs `ZoteroItem` naming confusion

**What goes wrong:** Exporting the `ZoteroItem` class from `translator-system-modern.ts` as `Item` instead of the `Item` class from `item.ts`. The `ZoteroItem` class in `translator-system-modern.ts` does NOT have `setComplete()`, `toJSON()`, `addCreator()`, `addNote()`, `addTag()` — those methods only exist on `packages/core/src/item.ts`'s `Item` class.

**Why it happens:** Both files export a class that creates Zotero items. The naming is confusing: `item.ts` exports `class Item implements ZoteroItem`, while `translator-system-modern.ts` exports `class ZoteroItem`.

**How to avoid:** Export `Item` from `./item`, not from `./translator-system-modern`. The tests call `item.setComplete()`, `item.toJSON()`, `item.addTag()`, `item.addNote()`, `item.addCreator()` — all of which exist only in `item.ts`.

**Warning signs:** TypeScript errors about missing `setComplete` or `toJSON` methods.

### Pitfall 2: Broken linkedom symlink when running tests from repo root

**What goes wrong:** `bun test packages/node/tests/executor.test.ts` from repo root fails with `ENOENT reading .../packages/node/node_modules/linkedom` because the symlink points to `.bun/linkedom@0.18.12/node_modules/linkedom` which does not exist at that path.

**Why it happens:** The current linked path is `../../../node_modules/.bun/linkedom@0.18.12/node_modules/linkedom` but bun actually stores it at `node_modules/linkedom` (not under `.bun/`). This may be a stale lockfile or workspace symlinking issue.

**How to avoid:** Run `bun install` from within `packages/node` directory to regenerate the node_modules symlinks for that workspace. After doing this, tests should resolve `linkedom` correctly.

**Warning signs:** `ENOENT reading .../packages/node/node_modules/linkedom` error.

### Pitfall 3: `executeDetectWeb` wrapper forgetting options signature

**What goes wrong:** `TranslatorExecutor` constructor requires at least an empty object `{}`. Calling `new TranslatorExecutor()` without arguments may throw because the default parameter is `options: TranslatorExecutorOptions = {}` — this should be fine, but verify against actual interface definition before assuming.

**How to avoid:** Pass `new TranslatorExecutor({})` explicitly.

### Pitfall 4: `Translator` type not exported

**What goes wrong:** `executor.test.ts` line 4 imports `type { Translator } from 'ztractor'`. This will fail at runtime if `Translator` is not exported from core's `index.ts`. Since it's a type-only import it may pass TypeScript but still need to be in the exports for runtime module resolution (Bun checks named exports).

**How to avoid:** Add `Translator` to the type re-exports from `./registry` in `index.ts`.

## Code Examples

### Adding exports to `packages/core/src/index.ts`

```typescript
// Source: packages/core/src/translator-system-modern.ts (line 998)
export { ZoteroUtilities as ZU, ZoteroItem } from "./translator-system-modern";

// Source: packages/core/src/item.ts
export { Item } from "./item";

// Source: packages/core/src/translator-loader.ts (line 6)
export { parseTranslatorMetadata } from "./translator-loader";

// Add Translator to existing registry type export:
export type { TranslatorRegistry, TranslatorMetadata, Translator } from "./registry";

// New standalone functions wrapping TranslatorExecutor methods:
export async function executeDetectWeb(
  translator: Translator,
  doc: Document,
  url: string,
): Promise<string | false | null> {
  const executor = new TranslatorExecutor({});
  return executor.detectWeb(translator, doc, url);
}

export async function executeDoWeb(
  translator: Translator,
  doc: Document,
  url: string,
): Promise<ZoteroItem[]> {
  const executor = new TranslatorExecutor({});
  return executor.doWeb(translator, doc, url) as Promise<ZoteroItem[]>;
}
```

### Fixing the linkedom symlink

```bash
cd packages/node && bun install
```

## Environment Availability

Step 2.6: Verified — all dependencies are already installed. The linkedom package is present at `node_modules/linkedom` (v0.18.12). The `packages/node/node_modules/linkedom` symlink is broken (points to a non-existent `.bun/` path) and needs to be regenerated.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | Test runner, build | Yes | 1.3.10 | — |
| linkedom | DOM parsing in packages/node | Yes (root node_modules) | 0.18.12 | — |
| @xmldom/xmldom | XPath support | Yes | 0.8.x | — |
| xpath | XPath evaluation | Yes | 0.0.34 | — |
| bunup | Build bundler | Yes | 0.15.14 | — |

**Broken symlink (must fix):**
- `packages/node/node_modules/linkedom` symlink target does not exist — fix with `bun install` from `packages/node`

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun built-in test runner |
| Config file | `packages/node/package.json` (`"test": "bun test"`) |
| Quick run command | `bun test packages/node/tests/index.test.ts` |
| Full suite command | `bun test packages/node/tests/` or `bun test` from `packages/node/` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NODE-01 | `extractMetadata()` works without manual dep injection | integration | `bun test packages/node/tests/integration.test.ts` | Yes |
| NODE-01 | `extractMetadata()` available as named export from ztractor-node | unit | `bun test packages/node/tests/index.test.ts` | Yes |
| NODE-02 | `document.evaluate()` XPath queries return correct results | unit | `bun test packages/node/tests/xpath-advanced.test.ts` | Yes |
| NODE-02 | XPath support works in translator execution context | unit | `bun test packages/node/tests/executor.test.ts` | Yes |
| NODE-03 | `ZU`, `Item`, `parseTranslatorMetadata`, `executeDetectWeb`, `executeDoWeb`, `Translator` all importable from ztractor | unit | `bun test packages/node/tests/index.test.ts packages/node/tests/executor.test.ts` | Yes |

### Sampling Rate

- **Per task commit:** `bun test packages/node/tests/index.test.ts packages/node/tests/executor.test.ts`
- **Per wave merge:** Full node test suite from `packages/node`: `bun test`
- **Phase gate:** All node tests green before `/gsd:verify-work`

### Wave 0 Gaps

None — all test files already exist. No new test infrastructure is needed.

## State of the Art

This phase has no external API or library evolution concerns. All code is local. No "old vs new approach" applies.

## Open Questions

1. **`TranslatorExecutor` constructor default**
   - What we know: Signature is `constructor(options: TranslatorExecutorOptions = {})` based on export at line 508
   - What's unclear: Whether calling `new TranslatorExecutor({})` without `getTranslatorById` is truly safe when `detectWeb`/`doWeb` are called (they may internally call `getTranslatorById` for translator-to-translator delegation)
   - Recommendation: Pass `new TranslatorExecutor({})` with empty object. The tests only exercise simple non-delegating translators, so missing `getTranslatorById` is acceptable for the wrapper function use case.

2. **`ZoteroItem` type re-export naming conflict**
   - What we know: `index.ts` currently exports `type { ZoteroItem }` from `./types`, and `translator-system-modern.ts` also exports `class ZoteroItem`. Adding `export { ZoteroItem } from "./translator-system-modern"` would conflict.
   - Recommendation: Do NOT add the `ZoteroItem` class from `translator-system-modern.ts` — tests only need the `Item` class from `item.ts`. The type `ZoteroItem` from `types.ts` stays as-is.

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `packages/core/src/index.ts` — current exports verified
- Direct code inspection: `packages/core/src/translator-system-modern.ts` — `ZU` and `ZoteroItem` class exports confirmed at line 998
- Direct code inspection: `packages/core/src/item.ts` — `Item` class with `setComplete()`, `toJSON()`, `addCreator()`, `addNote()`, `addTag()` confirmed
- Direct code inspection: `packages/core/src/translator-loader.ts` — `parseTranslatorMetadata` export confirmed at line 6
- Live test run: `bun test packages/node/tests/index.test.ts` — confirmed `SyntaxError: Export named 'parseTranslatorMetadata' not found`
- Live test run: `bun test packages/node/tests/executor.test.ts` — confirmed `ENOENT reading .../packages/node/node_modules/linkedom`

### Secondary (MEDIUM confidence)

- CONTEXT.md: Pre-analysis listing missing exports — corroborated by code inspection

## Metadata

**Confidence breakdown:**
- Gap analysis: HIGH — confirmed via live test failures and direct source inspection
- Standard stack: HIGH — no new libraries needed, all already installed
- Architecture: HIGH — follows established patterns already in the codebase
- Pitfalls: HIGH — pitfalls are based on observed test failures and direct code reading

**Research date:** 2026-03-27
**Valid until:** Indefinitely (no external dependencies, all local code)
