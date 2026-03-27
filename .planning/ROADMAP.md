# Roadmap: Ztractor

## Overview

This milestone takes the existing rewrite branch — a modern executor with 173 passing tests — and closes the gap between "it runs" and "it matches Zotero's own test suite." The path is: understand how Zotero tests translators, build a harness to measure compatibility, fix the sandbox API surface incrementally, verify against real translators, ship the Node.js package, and publish both packages to npm.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Test Infrastructure** - Understand Zotero's test format and build a harness that runs translator tests against ztractor's sandbox (completed 2026-03-27)
- [ ] **Phase 2: Sandbox Core API** - Implement the Zotero.Item and ZU base API surface that translators depend on for detection and basic extraction
- [ ] **Phase 3: Sandbox Advanced Flows** - Implement multi-page fetch, HTTP sub-requests, item selection, and translator-to-translator delegation
- [ ] **Phase 4: Verification** - Confirm real-world translators pass and existing tests hold
- [ ] **Phase 5: Node.js Package** - Ship ztractor-node with linkedom + XPath pre-wired and matching core API
- [ ] **Phase 6: Publish** - Publish both packages to npm with correct metadata and READMEs

## Phase Details

### Phase 1: Test Infrastructure
**Goal**: Developers can run Zotero's translator tests against ztractor's sandbox and see a baseline pass/fail report
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Zotero's translator test format is documented — inputs, expected outputs, and how tests are structured
  2. A test harness exists that takes a translator's test cases and runs them against ztractor's sandbox
  3. A baseline report exists showing which translators pass and fail before any sandbox changes
  4. The harness is runnable with a single command: `bun test` or equivalent
**Plans:** 2/2 plans complete
Plans:
- [x] 01-01-PLAN.md — Harness utilities: test case parser, item normalizer, and item comparator with unit tests
- [x] 01-02-PLAN.md — Harness runner, zotero-compat smoke test, and baseline report script

### Phase 2: Sandbox Core API
**Goal**: Translators that use Zotero.Item and ZU base utilities can detect and extract metadata without crashing on missing API
**Depends on**: Phase 1
**Requirements**: SAND-01, SAND-02, SAND-05
**Success Criteria** (what must be TRUE):
  1. Translators can create items of any supported type and set any standard field without an error
  2. `item.complete()` and `item.setExtra()` work and produce correctly structured output (note: translators push to `item.creators` and `item.tags` arrays directly — they do not call `addTag()`/`addCreator()` methods)
  3. All ZU text-cleaning, ISBN/ISSN/DOI, and DOM utility methods that translators call are implemented
  4. `detectWeb(doc, url)` and `doWeb(doc, url)` receive the correct arguments and `this` context that Zotero's runtime provides
**Plans:** 1 plan
Plans:
- [ ] 02-01-PLAN.md — Sandbox globals (Z, innerText, request*), ZoteroItem.setExtra(), Zotero flags, ZU.HTTP alias

### Phase 3: Sandbox Advanced Flows
**Goal**: Translators that fetch additional pages, make HTTP sub-requests, present item selection, or delegate to other translators work end-to-end
**Depends on**: Phase 2
**Requirements**: SAND-03, SAND-04, SAND-06, SAND-07
**Success Criteria** (what must be TRUE):
  1. `ZU.processDocuments()` fetches additional URLs and delivers parsed documents to the callback
  2. `ZU.doGet()` and `ZU.doPost()` make HTTP requests and deliver responses to translator callbacks
  3. Translators that call `Zotero.selectItems()` receive a working callback that auto-selects all items
  4. Translators that call `Zotero.loadTranslator()` to delegate to another translator successfully extract items
**Plans**: TBD

### Phase 4: Verification
**Goal**: A representative set of real-world translators pass their Zotero test cases and no existing tests regress
**Depends on**: Phase 3
**Requirements**: VERIFY-01, VERIFY-02
**Success Criteria** (what must be TRUE):
  1. Translators for academic publishers (e.g., arXiv, DOI, Wikipedia) pass their Zotero test cases when run via the Phase 1 harness
  2. A news site translator and at least one social/general translator also pass
  3. All 173 existing ztractor unit and integration tests continue to pass
**Plans**: TBD

### Phase 5: Node.js Package
**Goal**: Node.js users can install ztractor-node and extract metadata without any manual dependency injection or DOM setup
**Depends on**: Phase 4
**Requirements**: NODE-01, NODE-02, NODE-03
**Success Criteria** (what must be TRUE):
  1. `import { extractMetadata } from 'ztractor-node'` works in Node.js 18+ without additional setup
  2. XPath queries used by translators (`document.evaluate()`) return correct results in the Node.js package
  3. All functions exported by `ztractor-node` match the same names and signatures as `ztractor` core
**Plans**: TBD

### Phase 6: Publish
**Goal**: Both packages are live on npm and a new user can install, run a quick-start example, and extract real metadata in under 5 minutes
**Depends on**: Phase 5
**Requirements**: PUB-01, PUB-02, PUB-03
**Success Criteria** (what must be TRUE):
  1. `npm install ztractor` installs the core package with correct exports and TypeScript types
  2. `npm install ztractor-node` installs the Node.js package with correct exports and TypeScript types
  3. Both package READMEs contain install instructions and a working quick-start code example
  4. Running the quick-start example from each README extracts real metadata from a live URL
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Test Infrastructure | 2/2 | Complete   | 2026-03-27 |
| 2. Sandbox Core API | 0/1 | In progress | - |
| 3. Sandbox Advanced Flows | 0/TBD | Not started | - |
| 4. Verification | 0/TBD | Not started | - |
| 5. Node.js Package | 0/TBD | Not started | - |
| 6. Publish | 0/TBD | Not started | - |
