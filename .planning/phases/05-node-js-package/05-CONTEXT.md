# Phase 5: Node.js Package - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Node.js users can install ztractor-node and extract metadata without any manual dependency injection or DOM setup. The `packages/node` package already exists with source code and tests — this phase wires it up, fills missing core exports, and verifies tests pass.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key findings from codebase analysis:
- `packages/node/src/index.ts` and `dom-utils.ts` already exist and are correct
- Core (`packages/core/src/index.ts`) is missing exports needed by node tests:
  - `ZU` (alias for `ZoteroUtilities` from `translator-system-modern.ts`)
  - `Item` (alias for `ZoteroItem` from `translator-system-modern.ts`)
  - `parseTranslatorMetadata` (from `translator-loader.ts`)
  - `executeDetectWeb`, `executeDoWeb` (from `translator-system-modern.ts`)
- `Translator` type is already exported via registry types
- Package.json for node package looks correct

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/src/translator-system-modern.ts` — exports `ZoteroItem`, `ZoteroUtilities`, `TranslatorExecutor`
- `packages/core/src/translator-loader.ts` — exports `parseTranslatorMetadata`
- `packages/node/src/dom-utils.ts` — `SafeDOMParser`, `parseHTMLDocument` with XPath bridge
- `packages/node/src/index.ts` — wraps core with injected dependencies

### Established Patterns
- Named exports from index.ts
- Re-exports use `export { X } from "./module"`
- `Translator` type in registry.ts

### Integration Points
- `packages/core/src/index.ts` needs new exports
- `packages/node` tests import from `ztractor` (workspace:*)
- Build: `bunup --exports` for node package

</code_context>

<specifics>
## Specific Ideas

- Export `ZU` as alias for `ZoteroUtilities`
- Export `Item` as alias for `ZoteroItem`
- Export `parseTranslatorMetadata` directly
- Export `executeDetectWeb` and `executeDoWeb` if they exist, or create them as thin wrappers

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
