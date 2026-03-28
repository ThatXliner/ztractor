---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 06-02-PLAN.md
last_updated: "2026-03-28T03:13:10.217Z"
last_activity: 2026-03-28
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 12
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** The sandbox is compatible enough that real Zotero translators pass Zotero's own test suite — meaning any translator that works in Zotero works in ztractor.
**Current focus:** Phase 06 — publish

## Current Position

Phase: 06
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-03-28

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 7 | 2 tasks | 6 files |
| Phase 01 P02 | 3 | 2 tasks | 6 files |
| Phase 02 P01 | 184s | 2 tasks | 2 files |
| Phase 03-sandbox-advanced-flows P01 | 3min | 1 tasks | 2 files |
| Phase 03-sandbox-advanced-flows P02 | 3min | 1 tasks | 2 files |
| Phase 04-verification P01 | 8min | 1 tasks | 1 files |
| Phase 04-verification P02 | 150 | 1 tasks | 6 files |
| Phase 04-verification P03 | 2min | 1 tasks | 1 files |
| Phase 05-node-js-package P01 | 20min | 2 tasks | 5 files |
| Phase 06-publish P01 | 68s | 3 tasks | 3 files |
| Phase 06-publish P02 | 5min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Rewrite executor from scratch (translator-system-modern.ts) — old executor.ts is being phased out
- Dependency injection for DOM — keeps packages/core browser-compatible
- Two packages (ztractor + ztractor-node) — universal core stays clean
- [Phase 01]: Relaxed item comparison: expected fields must match in actual, extra fields in actual silently allowed — avoids false negatives from Zotero ItemFields registry
- [Phase 01]: normalizeItem removes empty arrays beyond Zotero sanitizeItem spec — prevents false mismatches on absent vs empty array fields
- [Phase 01]: TRANSLATOR_COMPAT guard on live test: keeps bun test fast by default, avoids flaky CI from network conditions
- [Phase 01]: node:fs allowed in report.ts/scripts/ since only used from test/script context, not imported into browser-targeted src/
- [Phase 02]: Copy prototype methods to wrappedZU (not just spread) to expose request/requestText/requestJSON/requestDocument from ZoteroUtilities.Translate prototype
- [Phase 03-sandbox-advanced-flows]: pendingWork array (not counter) allows drain loop to catch promises added by nested callbacks (selectItems -> processDocuments)
- [Phase 03-sandbox-advanced-flows]: doGet/doPost use callback pattern (not Promise return) to match Zotero's API surface for real translator compatibility
- [Phase 03-sandbox-advanced-flows]: Capture executor with const executor = this before object literal return to avoid unbound this in createTranslatorLoader
- [Phase 03-sandbox-advanced-flows]: Attach no-op complete() to itemDone items to match Zotero's behavior where item.complete is re-attached before handler fires
- [Phase 03-sandbox-advanced-flows]: translate() both pushes to pendingWork AND awaits — fire-and-forget and await-chaining both supported
- [Phase 04-verification]: Wrap all callback() invocations in getTranslatorObject with individual try-catch blocks to prevent unhandled rejections from user-provided callbacks that throw on empty objects
- [Phase 04-verification]: Inject DOMParser as explicit Function parameter in all translator execution contexts rather than relying on global scope availability
- [Phase 04-verification]: Use nullish coalescing (options.dependencies ??) in TranslatorExecutor constructor to prevent undefined from overriding DOMParser default
- [Phase 04-02]: Used NPR instead of The Guardian for news site test — Guardian 2013 test cases no longer match live page og:type metadata
- [Phase 04-02]: Preprint publisher->repository field aliasing in onItemComplete mirrors Zotero type-schema alias map (zoteroTypeSchemaData preprint: { 124: 8 })
- [Phase 04-verification]: Root bunfig.toml uses repo-root-relative path (./packages/core/tests/setup.ts) to fix bun test packages/core/ from repo root without modifying package-level bunfig.toml
- [Phase 05-node-js-package]: Export Item from ./item (class with setComplete/toJSON/addCreator/addNote/addTag), not ZoteroItem from translator-system-modern (sandbox class)
- [Phase 05-node-js-package]: Add addTag/addNote/addCreator to sandbox ZoteroItem to match Zotero API surface for real translator compatibility
- [Phase 05-node-js-package]: Generic translators (unAPI, COinS, Embedded Metadata, DOI) match any URL via empty target pattern
- [Phase 06-publish]: Use arXiv GPT-4 paper (2303.08774) as stable quick-start example — stable URL, realistic preprint output with DOI, creators, date
- [Phase 06-publish]: Replace workspace:* with ^1.0.0 in ztractor-node — workspace protocol fails on npm registry; semver required for publishing
- [Phase 06-publish]: Applied 06-01 README and version fixes to main branch — worktree was on main, not rewrite; required Rule 3 inline fix

### Pending Todos

None yet.

### Blockers/Concerns

- Zotero's translator test format is not yet understood — Phase 1 must investigate before any harness can be built
- Node.js package (packages/node) is planned but not yet implemented
- executor.ts transition in progress — verify it is fully replaced before Phase 2 sandbox work

## Session Continuity

Last session: 2026-03-28T03:09:54.276Z
Stopped at: Completed 06-02-PLAN.md
Resume file: None
