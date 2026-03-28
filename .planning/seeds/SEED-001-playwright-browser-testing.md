---
id: SEED-001
status: dormant
planted: 2026-03-27
planted_during: v1.0 / phase 04-verification
trigger_when: v2 milestone start
scope: medium
---

# SEED-001: Add Playwright-based browser testing for JS-rendered sites

## Why This Matters

Many high-value translator targets (ScienceDirect, Elsevier journals, publisher portals) render
their pages via JavaScript — the export forms and metadata don't exist in the static HTML. Ztractor's
current test harness uses `extractMetadata({ url, html })` which only works on server-rendered pages.

Without browser testing, translators for JS-rendered sites can't be verified at all — they fail with
"Could not scrape metadata via known methods" because the DOM elements they depend on are never present.

Playwright gives translators a real browser context: JS executes, forms render, session cookies persist.
This would make ScienceDirect and similar sites testable and would catch regressions that static HTML
tests can't detect.

## When to Surface

**Trigger:** Start of v2 milestone

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches:
- Expanding translator coverage beyond what static HTML can handle
- Adding browser/headless execution support
- Testing JS-rendered publisher sites (Elsevier, Springer, Nature, etc.)

## Scope Estimate

**Medium** — A phase or two. Likely includes:
- Playwright dependency + browser executor wrapper
- `extractMetadata` option to use browser context instead of `fetch`
- TRANSLATOR_COMPAT-gated Playwright tests for ScienceDirect and 1-2 other JS-rendered sites
- CI configuration for headless browser runs

## Breadcrumbs

Relevant artifacts from the current codebase:

- `packages/core/tests/zotero-compat.test.ts` — existing TRANSLATOR_COMPAT test harness to extend
- `packages/core/tests/harness/run-test.ts` — `runTranslatorWebTest()` would need a browser variant
- `packages/core/src/index.ts` — `extractMetadata()` entry point; browser option would inject here
- `packages/core/translators/ScienceDirect.js` — first target; uses PII meta tag + RIS sub-request
- `sciencedirect.html` + `sciencedirect.ris` — saved HTML snapshot and expected RIS output for the
  Bahmid et al. (2024) article (DOI: 10.1016/j.fpsl.2024.101311); useful as fixture
- `.planning/phases/04-verification/04-RESEARCH.md` — notes on translator compatibility testing approach

## Notes

Discovered during v1 Phase 4 verification when attempting to add a ScienceDirect live test.
The page returns HTTP 403 for headless fetches, and even with local HTML the export form is
JS-rendered so the translator throws "Could not scrape metadata via known methods".

The `.ris` file at repo root is the expected output for the test fixture article — keep it when
setting up Playwright fixtures.
