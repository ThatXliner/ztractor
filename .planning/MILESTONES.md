# Milestones

## v1.0 MVP (Shipped: 2026-03-28)

**Phases completed:** 7 phases, 13 plans, 13 tasks

**Delivered:** Rewrote the Zotero translator execution sandbox to match Zotero's actual API surface — all 5 live TRANSLATOR_COMPAT tests pass (Wikipedia, arXiv, reddit, DOI, NPR); 244 tests pass total; both packages publish-ready on npm.

**Key accomplishments:**

- Built Zotero translator test harness — parseTestCases/normalizeItem/compareItems utilities parse Zotero's embedded test format and compare items with relaxed field equality
- Implemented sandbox core API — Z alias, innerText global, Zotero.Item, ZU.* methods, fakeXhr callbacks for doGet/doPost/processDocuments
- Implemented advanced translator flows — pendingWork drain for async sub-requests, selectItems, translator-to-translator delegation via loadTranslator/translate()
- Shipped `ztractor-node` package with linkedom + xmldom XPath bridge pre-wired; 113 node tests pass
- Both packages publish-ready — version 1.0.0, npm pack verified, READMEs with arXiv quick-start examples
- Fixed TRANSLATOR_COMPAT bugs (getAllResponseHeaders, XPath guard, attribute bridge) — all 5 live tests pass

**Stats:** 359 files changed, ~96k insertions, 30k TypeScript LOC
**Timeline:** 2025-11-19 → 2026-03-28 (4 months)

---
