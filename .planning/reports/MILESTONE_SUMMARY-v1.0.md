# Milestone v1.0 — Project Summary

**Generated:** 2026-03-28
**Purpose:** Team onboarding and project review

---

## 1. Project Overview

**Ztractor** is a programmatic API for Zotero's 600+ web translators — JavaScript libraries that extract structured bibliographic metadata (title, authors, DOI, publication info, etc.) from websites.

A version already existed on npm, but its sandbox wasn't compatible with what real translators expect — many Zotero translators crashed or returned nothing due to missing API surface. This v1.0 rewrite re-implements the execution sandbox in modern TypeScript to match Zotero's actual API, so the full Zotero translator library works correctly.

**Core Value:** The sandbox is compatible enough that real Zotero translators pass Zotero's own test suite — meaning any translator that works in Zotero works in ztractor.

**Two packages shipped:**
- `ztractor` — Universal library (browser + Node.js via dependency injection)
- `ztractor-node` — Node.js wrapper with linkedom + XPath pre-wired (no setup required)

**Status:** All 7 phases complete. Both packages are publish-ready (v1.0.0). `npm publish` is the one remaining human action.

---

## 2. Architecture & Technical Decisions

### Core Design

- **Decision:** Rewrite the executor from scratch (`translator-system-modern.ts`)
  - **Why:** Zotero's original `translate.js` is a Firefox extension CJS bundle full of dead XUL/nsIFile code — codemoding it was infeasible
  - **Phase:** Pre-existing (entered this milestone already done)

- **Decision:** Dependency injection for DOM (`dependencies` parameter)
  - **Why:** Keeps `packages/core` browser-compatible (no Node.js imports); Node.js users get linkedom injected via `ztractor-node` without any manual setup
  - **Phase:** Pre-existing

- **Decision:** Two packages (`ztractor` + `ztractor-node`)
  - **Why:** Universal core stays clean; Node.js users get a pre-wired package without manual setup
  - **Phase:** Pre-existing

- **Decision:** Bundled translators (not runtime fetch)
  - **Why:** Zero external dependencies at runtime; reproducible builds; 685 translators bundled at build time
  - **Phase:** Pre-existing

### Built During v1.0

- **Decision:** Relaxed item comparison in test harness (expected fields must match; extra actual fields allowed)
  - **Why:** Zotero's `ItemFields` registry isn't available outside Zotero — strict comparison would generate false negatives
  - **Phase:** 1 (Test Infrastructure)

- **Decision:** Copy prototype methods to `wrappedZU` (not just own properties via spread)
  - **Why:** `request`, `requestText`, `requestJSON`, `requestDocument` live on the prototype chain; spreading only copies own properties, silently dropping them
  - **Phase:** 2 (Sandbox Core API)

- **Decision:** `pendingWork` array (not counter) for async drain loop
  - **Why:** Nested callbacks (e.g., `selectItems` → `processDocuments`) add new promises mid-drain; an array lets the drain loop detect new additions and continue waiting
  - **Phase:** 3 (Sandbox Advanced Flows)

- **Decision:** `fakeXhr` object pattern for `doGet`/`doPost`/`ZU.request` callbacks
  - **Why:** Translators expect an XHR-like object (`responseText`, `status`, `getAllResponseHeaders`) passed to their callbacks — not a raw string
  - **Phase:** 3 + 7

- **Decision:** XPath bridge: linkedom (fast parse) + xmldom (XPath evaluation)
  - **Why:** linkedom parses HTML fast but has limited XPath support; xmldom handles XPath queries correctly. The bridge maps xmldom results back to linkedom nodes via DOM path traversal.
  - **Phase:** 5 (Node.js Package)

- **Decision:** Apply bundle patches to `translation-bundle-patch.js` (source), not just the generated file
  - **Why:** `utilities-translate-bundle.ts` is gitignored (auto-generated); patching it directly would be lost on rebuild
  - **Phase:** 7 (Fix Translator Compat Bugs)

---

## 3. Phases Delivered

| Phase | Name | Duration | One-Liner |
|-------|------|----------|-----------|
| 1 | Test Infrastructure | 7 min | parseTestCases/normalizeItem/compareItems utilities parsing Zotero's embedded test format with relaxed field equality |
| 2 | Sandbox Core API | 3 min | Sandbox globals (Z, innerText, request*), ZoteroItem.setExtra(), Zotero flags, ZU.HTTP alias — closing the API gap that crashed real translators |
| 3 | Sandbox Advanced Flows | 3 min | pendingWork drain replaces 100ms setTimeout; ZU.processDocuments/doGet/doPost deliver fakeXhr callbacks, collecting items from async sub-requests |
| 4 | Verification | 8 min | Three targeted fixes (unhandled rejection, DOMParser injection, nullish coalescing) take test suite from 211 pass/1 fail to 212 pass/0 fail |
| 5 | Node.js Package | 20 min | Wired core barrel exports (ZU, Item, executeDetectWeb/DoWeb) and fixed broken linkedom/xpath symlinks — all 113 node tests pass |
| 6 | Publish | 68 sec | Updated both READMEs with stable arXiv quick-start, bumped ztractor-node to 1.0.0, replaced workspace:* with ^1.0.0 for npm compatibility |
| 7 | Fix Translator Compat Bugs | 16 min | getAllResponseHeaders on xmlhttp + typeof XPath guard + attribute bridge fix — all 5 TRANSLATOR_COMPAT live tests (Wikipedia, arXiv, reddit, DOI, NPR) pass |

**Total: 7 phases, 13 plans, ~1 hour of execution time over 2 days (2026-03-26 → 2026-03-28)**

---

## 4. Requirements Coverage

### Translator Test Infrastructure
- ✅ **TEST-01**: Zotero's translator test format documented (BEGIN/END TEST CASES inline JSON markers, live HTTP required, 233 use `defer` for JS-rendered pages)
- ✅ **TEST-02**: Test harness implemented — `parseTestCases()`, `runTranslatorWebTest()`, `generateBaselineReport()`
- ✅ **TEST-03**: Baseline report script exists (`bun run baseline` in packages/core)

### Sandbox Compatibility
- ✅ **SAND-01**: `Zotero.Item` implements full field/method API (all item types, all fields, `complete()`, `setExtra()`, tag/creator array push)
- ✅ **SAND-02**: `ZU` implements all translator-called methods (text cleaning, ISBN/ISSN/DOI, HTTP helpers, DOM utilities)
- ✅ **SAND-03**: `ZU.processDocuments()` fetches additional pages and delivers parsed documents to callbacks
- ✅ **SAND-04**: `ZU.doGet()` / `ZU.doPost()` make HTTP sub-requests with fakeXhr callback delivery
- ✅ **SAND-05**: `detectWeb(doc, url)` / `doWeb(doc, url)` receive correct arguments and `this` context
- ✅ **SAND-06**: `Zotero.selectItems()` works — auto-selects all items via callback
- ✅ **SAND-07**: `Zotero.loadTranslator()` / `translate()` delegate to other translators correctly

### Verification
- ✅ **VERIFY-01**: Wikipedia, arXiv, reddit, DOI, NPR all pass TRANSLATOR_COMPAT live tests (fixed in Phase 7)
- ✅ **VERIFY-02**: All 212 existing ztractor unit/integration tests continue to pass

### Node.js Package
- ✅ **NODE-01**: `ztractor-node` exists with linkedom as DOM implementation (pre-wired)
- ✅ **NODE-02**: XPath support via xmldom bridge — `document.evaluate()` works in Node.js
- ✅ **NODE-03**: `ztractor-node` exports same API surface as `ztractor` core

### Publishing
- ⏳ **PUB-01**: `ztractor` publish-ready (v1.0.0, `npm pack --dry-run` passes) — **awaiting `npm publish`**
- ⏳ **PUB-02**: `ztractor-node` publish-ready (v1.0.0, `npm pack --dry-run` passes) — **awaiting `npm publish`**
- ✅ **PUB-03**: Both READMEs have install instructions + working arXiv quick-start example

**Audit verdict (2026-03-28):** `tech_debt` — all requirements structurally satisfied; 2 publications pending human action (npm credentials required)

---

## 5. Key Decisions Log

| ID | Decision | Phase | Rationale |
|----|----------|-------|-----------|
| D1 | Rewrite executor from scratch | Pre-existing | Zotero's translate.js is a Firefox CJS bundle with dead XUL code — codemoding was infeasible |
| D2 | Dependency injection for DOM | Pre-existing | Keeps core browser-compatible; Node.js gets linkedom via wrapper |
| D3 | eval('require') patches in CJS bundle | Pre-existing | Prevents ESM bundler from statically analyzing dead-code require() calls |
| D4 | Two packages (ztractor + ztractor-node) | Pre-existing | Universal core stays clean; Node.js users get pre-wired package |
| D5 | Bundled translators (not runtime fetch) | Pre-existing | Zero runtime deps; reproducible builds |
| D6 | Relaxed item comparison (expected ⊆ actual) | Phase 1 | No ItemFields registry available; strict comparison creates false negatives |
| D7 | Prototype chain copy for wrappedZU | Phase 2 | Spread only copies own properties — prototype methods silently dropped |
| D8 | pendingWork array drain loop | Phase 3 | Nested callbacks add promises mid-drain; array detects growth to keep waiting |
| D9 | fakeXhr callback pattern | Phase 3+7 | Translators expect XHR-like object, not raw string |
| D10 | Nullish coalescing for dependencies default | Phase 4 | Spread override was clobbering DOMParser default with `undefined` |
| D11 | linkedom + xmldom XPath bridge | Phase 5 | linkedom: fast HTML parse; xmldom: correct XPath; bridge maps results via DOM path |
| D12 | Patch translation-bundle-patch.js, not generated file | Phase 7 | Generated file is gitignored — patches lost on rebuild |
| D13 | typeof guard for XPath availability | Phase 7 | `!Zotero.isIE` is always `true` in modern JS; actual capability check needed |

---

## 6. Tech Debt & Deferred Items

### Remaining Before Ship

- **npm publish not yet run** — requires authenticated npm credentials. Run:
  ```bash
  npm login  # verify with: npm whoami
  cd packages/core && npm publish
  cd packages/node && npm publish
  ```
  Then verify: `npm view ztractor version` → should show `1.0.0`

### Accumulated Tech Debt

| Phase | Item | Severity |
|-------|------|----------|
| 1 | Nyquist VALIDATION.md is `status:draft`, wave_0 incomplete | Low |
| 1 | baseline-report.json covers only 1 translator (Embedded Metadata) — full 685-translator baseline not generated | Low |
| 2 | Nyquist VALIDATION.md is `status:draft`, wave_0 incomplete | Low |
| 5 | Nyquist VALIDATION.md: nyquist_compliant:false, wave_0_complete:false | Low |
| 5 | TS9010 build warning: `ZoteroUtilities` export missing explicit type annotation (non-blocking) | Low |
| 6 | No VALIDATION.md — Nyquist compliance missing for publish phase | Low |

### Deferred to v2

- `executeTranslator(id, html, url)` — low-level API to run a specific translator directly (API-01)
- `HTTPRegistry` — runtime fetching of latest translators from Zotero's repo (API-02)
- CLI tool — `ztractor <url>` for quick metadata lookups (API-03)
- Full TypeDoc API reference docs (DX-01)
- Detailed error messages for unsupported Zotero API calls (DX-02)

---

## 7. Getting Started

### Install
```bash
# Browser / universal
bun add ztractor

# Node.js (recommended — XPath + linkedom pre-wired)
bun add ztractor-node
```

### Quick Start (Node.js)
```typescript
import { extractMetadata } from 'ztractor-node'

const result = await extractMetadata('https://arxiv.org/abs/2303.08774')
if (result.success) {
  console.log(result.items[0].title)  // "GPT-4 Technical Report"
  console.log(result.items[0].DOI)    // "10.48550/arXiv.2303.08774"
}
```

### Key Directories
```
packages/core/src/
  index.ts                    ← Main entry point (extractMetadata, findTranslators)
  translator-system-modern.ts ← Sandbox, ZoteroItem, ZoteroUtilities, executor
  registry.ts                 ← BundledRegistry (lazy-loads 685 translators)
  translator-loader.ts        ← parseTranslatorMetadata, matchesTarget
  types.ts                    ← All TypeScript types

packages/node/src/
  index.ts                    ← extractMetadata with linkedom pre-injected
  dom-utils.ts                ← SafeDOMParser, XPath bridge (linkedom + xmldom)

packages/core/tests/
  harness/                    ← Zotero test harness (parseTestCases, run-test, etc.)
  zotero-compat.test.ts       ← TRANSLATOR_COMPAT live translator tests
```

### Run Tests
```bash
# All tests
bun test

# Live translator tests (requires internet)
TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts

# Node package tests only
cd packages/node && bun test

# Generate baseline pass/fail report for all 685 translators
cd packages/core && bun run baseline
```

### Debug a Translator
```bash
DEBUG_TRANSLATORS=1 bun test packages/node/tests/integration.test.ts
```

---

## Stats

- **Timeline:** 2026-03-26 → 2026-03-28 (2 days)
- **Phases:** 7 / 7 complete
- **Plans:** 13 / 13 complete
- **Commits:** ~85 (since project start on rewrite branch)
- **TypeScript LOC:** ~2,500 (excluding auto-generated utilities bundle)
- **Translators bundled:** 685 web translators (type 4)
- **Test coverage:** 212 unit/integration tests pass; 5 live translator tests pass
- **Contributors:** ThatXliner

---

*Summary generated from phase SUMMARY.md, CONTEXT.md, VERIFICATION.md, ROADMAP.md, REQUIREMENTS.md, and v1.0-MILESTONE-AUDIT.md artifacts*
