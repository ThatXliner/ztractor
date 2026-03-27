# Requirements: Ztractor

**Defined:** 2026-03-26
**Core Value:** The sandbox is compatible enough that real Zotero translators pass Zotero's own test suite — meaning any translator that works in Zotero works in ztractor.

## v1 Requirements

### Translator Test Infrastructure

- [ ] **TEST-01**: Understand Zotero's translator test format — identify how translator tests are structured, what inputs/outputs they expect, and whether they can run outside Zotero
- [ ] **TEST-02**: Implement a test harness that runs Zotero translator tests against ztractor's sandbox
- [ ] **TEST-03**: Baseline measurement — run existing translator tests and document which pass/fail before sandbox improvements

### Sandbox Compatibility

- [ ] **SAND-01**: `Zotero.Item` implements the full field/method API that translators use (all item types, all fields, `complete()`, `addTag()`, `addCreator()`, etc.)
- [ ] **SAND-02**: `ZU` (ZoteroUtilities) implements all methods translators call — text cleaning, ISBN/ISSN/DOI, HTTP helpers, DOM utilities
- [ ] **SAND-03**: `ZU.processDocuments()` works correctly — translators use this to fetch and process additional pages
- [ ] **SAND-04**: `ZU.doGet()` / `ZU.doPost()` work correctly — translators use these for HTTP sub-requests
- [ ] **SAND-05**: Translator calling conventions match what Zotero's runtime provides — `detectWeb()` and `doWeb()` receive the correct arguments and `this` context
- [ ] **SAND-06**: Multi-item selection flow works — translators that call `Zotero.selectItems()` get a functioning callback
- [ ] **SAND-07**: Translator-to-translator calls work — translators that delegate to other translators (via `Zotero.loadTranslator`) function correctly

### Verification

- [ ] **VERIFY-01**: A representative set of real-world translators (academic publishers, Wikipedia, arXiv, DOI, news sites) pass their Zotero tests when run against ztractor's sandbox
- [ ] **VERIFY-02**: All existing 173 ztractor unit/integration tests continue to pass after sandbox changes

### Node.js Package

- [ ] **NODE-01**: `ztractor-node` package exists with linkedom as the DOM implementation (pre-wired, no manual dependency injection needed)
- [ ] **NODE-02**: `ztractor-node` supports XPath queries (`document.evaluate()`) used by translators — via xmldom or a compatible implementation
- [ ] **NODE-03**: `ztractor-node` exports the same API surface as `ztractor` core

### Publishing

- [ ] **PUB-01**: `ztractor` (core) published to npm with correct exports, types, and package.json fields
- [ ] **PUB-02**: `ztractor-node` published to npm with correct exports, types, and package.json fields
- [ ] **PUB-03**: Both packages have a README with install instructions and a working quick-start example

## v2 Requirements

### API Surface

- **API-01**: `executeTranslator(id, html, url)` — low-level API to run a specific translator directly
- **API-02**: `HTTPRegistry` — runtime fetching of latest translators from Zotero's repo instead of bundled
- **API-03**: CLI tool — `ztractor <url>` command for quick metadata lookups

### Developer Experience

- **DX-01**: Full TypeDoc-generated API reference docs
- **DX-02**: Detailed error messages indicating which part of the Zotero API a translator tried to call that isn't supported

## Out of Scope

| Feature | Reason |
|---------|--------|
| HTTP server / REST API | Library only — not building a zotero-server clone |
| Import/export/search translators (type != 4) | Only web translators (type 4) are in scope |
| Custom translator authoring | Not a Zotero translator development environment |
| Browser extension | Pure npm library |
| Zotero sync / library management | Only the extraction part of Zotero's stack |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 1 | Pending |
| SAND-01 | Phase 2 | Pending |
| SAND-02 | Phase 2 | Pending |
| SAND-05 | Phase 2 | Pending |
| SAND-03 | Phase 3 | Pending |
| SAND-04 | Phase 3 | Pending |
| SAND-06 | Phase 3 | Pending |
| SAND-07 | Phase 3 | Pending |
| VERIFY-01 | Phase 4 | Pending |
| VERIFY-02 | Phase 4 | Pending |
| NODE-01 | Phase 5 | Pending |
| NODE-02 | Phase 5 | Pending |
| NODE-03 | Phase 5 | Pending |
| PUB-01 | Phase 6 | Pending |
| PUB-02 | Phase 6 | Pending |
| PUB-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation — all requirements mapped*
