# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-28
**Phases:** 7 | **Plans:** 13

### What Was Built

- Zotero translator test harness — parseTestCases/normalizeItem/compareItems utilities with relaxed field equality to avoid false negatives from Zotero's ItemFields registry
- Full sandbox API surface — Zotero.Item, ZU.*, Z alias, innerText global, fakeXhr callbacks for doGet/doPost/processDocuments, pendingWork drain for async sub-requests
- Advanced translator flows — selectItems, translator-to-translator delegation (loadTranslator/translate()), with proper pendingWork integration for nested async callbacks
- `ztractor-node` package — linkedom + xmldom XPath bridge pre-wired, 113 tests pass
- Both packages publish-ready at v1.0.0 — npm pack verified, arXiv quick-start READMEs
- Phase 7 gap closure — getAllResponseHeaders, XPath typeof guard, attribute bridge — all 5 TRANSLATOR_COMPAT live tests pass

### What Worked

- GSD phase-by-phase structure kept scope contained — each phase had a clear goal and verifiable success criteria
- The TRANSLATOR_COMPAT guard (env flag to gate live tests) kept the main test suite fast without sacrificing live verification
- translation-bundle-patch.js approach for persisting utility bundle fixes across rebuilds — clean solution that survived Phase 7
- Audit step before milestone completion (audit-milestone) surfaced real gaps (MISS-01, MISS-02) that became Phase 7

### What Was Inefficient

- Phase 4 VERIFICATION had 4 plans but only 3 were executed as independent plans — 04-03 (bunfig fix) was a one-liner that could have been folded into 04-02
- Some SUMMARY.md one-liners were too raw (e.g., "Task 1 — Core README:") and needed manual cleanup during milestone completion
- Nyquist validation was partial/missing for 4 of 7 phases — validation debt accumulated instead of being done inline

### Patterns Established

- `translation-bundle-patch.js` as the canonical place for persistent utility bundle patches (not direct edits to gitignored auto-generated files)
- TRANSLATOR_COMPAT env guard for all live-network tests
- Relaxed item comparison: expected fields must appear in actual; extra fields silently allowed
- Phase 7 as "gap closure" phase pattern — milestone audit finds integration gaps, numbered phase closes them before milestone complete

### Key Lessons

1. Audit before milestone complete — `audit-milestone` found MISS-01 and MISS-02 that were invisible from phase-level verification. Worth running even when all phase summaries are green.
2. Auto-generated CJS bundles need a patch layer — direct edits to gitignored files get wiped on rebuild. Keep a tracked patch file.
3. XPath + linkedom is a hybrid problem — linkedom parses fast but XPath needs xmldom; the two-library bridge (xmldom evaluation + linkedom node mapping by tree path) is the right pattern for Node.js translators.
4. SUMMARY.md one-liners should be complete sentences — raw stubs like "Task 1 — Core README:" fail at milestone extraction.

### Cost Observations

- Notable: All phases executed sequentially on `rewrite` branch; branching strategy was `none`
- Phase 6 required an inline Rule 3 fix (docs committed to wrong branch — main vs rewrite)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 13 | First milestone; established GSD workflow patterns |

### Cumulative Quality

| Milestone | Tests | Key Coverage |
|-----------|-------|-------------|
| v1.0 | 244 pass | 5/5 live TRANSLATOR_COMPAT tests |

### Top Lessons (Verified Across Milestones)

1. Audit before milestone complete — surfaces integration gaps invisible at phase level
2. Patch layers for auto-generated files — tracked patch files survive rebuilds
