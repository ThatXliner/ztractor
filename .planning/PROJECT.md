# Ztractor

## What This Is

Ztractor is a programmatic API for Zotero's 600+ web translators — libraries that extract structured bibliographic metadata (title, authors, DOI, publication info, etc.) from websites. A version already exists on npm, but the translator execution sandbox isn't fully compatible with what real translators expect. This rewrite re-implements the sandbox in modern JS to match Zotero's actual API surface, so that the full translator library works correctly.

## Core Value

The sandbox is compatible enough that real Zotero translators pass Zotero's own test suite — meaning any translator that works in Zotero works in ztractor.

## Requirements

### Validated

- ✓ `extractMetadata(url | options)` — fetches HTML, finds matching translator, runs detectWeb + doWeb, returns structured items — existing
- ✓ `findTranslators(url)` — returns matching translators sorted by priority for a given URL — existing
- ✓ `getAvailableTranslators()` — lists all bundled translators with id/label/target/priority — existing
- ✓ `BundledRegistry` — lazy-loads 685 bundled web translators from generated registry — existing
- ✓ Translator sandbox (`TranslatorExecutor`, `SandboxManager`) — executes translator JS safely via `new Function()` with injected Zotero API — existing
- ✓ `ZoteroUtilities` — text cleaning, HTTP helpers, DOM utilities matching Zotero's ZU API — existing
- ✓ Dependency injection pattern — `dependencies` param accepts `DOMParser` / `parseHTMLDocument` for environment-specific DOM — existing
- ✓ Build pipeline — `bundle-translate.ts` generates utilities bundle; `bundle-translators.ts` generates translator registry — existing
- ✓ Test suite — Bun test runner with linkedom preload, integration + unit tests — existing

### Active

- [ ] Sandbox compatibility — full Zotero translator API surface (ZU.*, Zotero.Item, calling conventions) so real translators run correctly
- [ ] Passes Zotero's own translator test suite — the gold standard for compatibility
- [ ] `ztractor-node` package — Node.js wrapper with linkedom + XPath pre-wired
- [ ] npm publish — both packages published to npm public registry with proper exports, types, READMEs
- [ ] README for both packages — install instructions + quick-start example

### Out of Scope

- HTTP server / REST API — not building a zotero-server clone; this is a library, not a service
- CLI tool — out of v1 scope; pure programmatic API only
- Import/export translators (translatorType != 4) — only web translators are supported; search/import/export types are not in scope
- Runtime translator fetching as default — `HTTPRegistry` exists but bundled is the default; keeping translators up to date is a manual build step
- Custom translator authoring tools — not a translator development environment

## Context

- Based on Zotero's internal extension code and zotero-server; translators are plain JS files with JSON metadata headers executing `detectWeb()` + `doWeb()`
- The translator utility bundle (`utilities-translate-bundle.ts`) is ~19k lines of auto-generated CJS code — patched at build time with `eval('require')` wrappers to prevent ESM bundler from trying to resolve dead-code CJS paths
- Translators are a git submodule (`packages/core/translators/`) pointing to Zotero's translator repo
- v1 exists on npm but sandbox is incompatible with many real translators — missing ZU.* methods, Zotero.Item API gaps, calling convention mismatches
- Currently on `rewrite` branch — fresh executor (`translator-system-modern.ts`) replaced old broken code; 173 unit/integration tests pass, but real-world translator compatibility is the open question
- Node.js package (`packages/node`) is planned but not yet implemented
- `ztractor-node` needs XPath support for translators that use `document.evaluate()` — linkedom parses fast but has limited XPath; xmldom can handle XPath queries
- Zotero's translator test format is not yet understood — need to investigate how to run their tests against ztractor's sandbox

## Constraints

- **Tech Stack**: Bun as package manager and build tool — all scripts use `bun`, `bunup`, `bun test`
- **Compatibility**: Must work in browser (native DOM) and Node.js (injected linkedom) — no Node-specific imports in `packages/core`
- **Bundler**: `bunup --exports -t browser --external jsdom,./xregexp-all` — browser target, certain deps externalized
- **Translators**: ~685 bundled web translators; auto-generated registry must never be manually edited
- **License**: AGPL v3+ — copyleft; derivative works must also be AGPL

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rewrite executor from scratch (translator-system-modern.ts) | Zotero's translate.js is a Firefox extension CJS bundle with dead XUL/nsIFile code; codemoding it was infeasible | — Pending |
| Dependency injection for DOM | Keeps packages/core browser-compatible; Node.js gets linkedom via ztractor-node wrapper | — Pending |
| eval('require') patches in CJS bundle | Prevents ESM bundler from statically analyzing dead-code require() calls in utilities-translate-bundle.ts | — Pending |
| Two packages (ztractor + ztractor-node) | Universal core stays clean; Node.js users get a pre-wired package without manual setup | — Pending |
| Bundled translators (not runtime fetch) | Zero external dependencies at runtime; reproducible builds | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after initialization*
