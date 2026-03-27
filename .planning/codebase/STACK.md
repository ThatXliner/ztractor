# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- TypeScript 5.x - Core implementation and type definitions across both packages
- JavaScript - Zotero translator files (bundled at build time)

**Secondary:**
- TOML - Build configuration (bunfig.toml)

## Runtime

**Environment:**
- Node.js >= 18.0.0 (for root and packages/node)
- Browser environment (for packages/core with native APIs)
- Bun 1.x (runtime and build tool)

**Package Manager:**
- Bun - Primary package manager and test runner
- Lockfile: `bun.lock` (present)

## Frameworks

**Core:**
- No web framework - Library-based package (exported as ESM module)

**Testing:**
- Bun's built-in test runner - No external test framework dependency

**Build/Dev:**
- bunup 0.15.14 - Tree-shaking bundler for TypeScript to ESM
- @babel/parser 7.28.5 - AST parsing for Zotero translator bundling
- recast 0.23.11 - AST transformation for unwrapping IIFEs in translator utilities
- Biome 2.2.4 - Code formatter and linter (optional, available as dev tool)

## Key Dependencies

**Core Package (`packages/core`):**

**No runtime dependencies** - packages/core is a zero-dependency library that:
- Uses native DOM APIs (browser) or injected dependencies (Node.js)
- Bundles Zotero translator utilities at build time as a single module
- Exports types and functions for metadata extraction

**Dev-only:**
- TypeScript 5.x - Type checking
- @babel/parser - JavaScript parsing for translator bundling
- recast - AST rewriting to convert IIFE-wrapped utilities to modules
- bunup - Build and bundling
- Biome - Code quality (linting/formatting)

**Node Package (`packages/node`):**

**Runtime:**
- ztractor (workspace:*) - Depends on core package
- linkedom 0.18.5 - Fast DOM parser and implementation for Node.js
- @xmldom/xmldom 0.8.11 - XPath support via xmldom for XPath queries on parsed HTML
- xpath 0.0.34 - XPath expression evaluation library

**Dev-only:**
- TypeScript 5.x, bunup, @types/bun

## Configuration

**Environment:**
- .env file present (contains build or test configuration)
- No environment variables required for core library (uses fetch API)
- Node package injects dependencies for environment-specific DOM parsing

**Build:**
- `tsconfig.json` - Strict TypeScript configuration (strict: true, bundler module resolution)
- `packages/core/bunfig.toml` - Bun test configuration with test setup preload
- Build targets ESNext with native module preservation

## Build Process

**Core Package Build:**
1. `bundle-translate.ts` - Bundles Zotero's translate utilities from git submodule:
   - Reads files from `packages/core/translate/` directory (git submodule)
   - Unwraps IIFE-wrapped code into module-compatible format
   - Concatenates in dependency order (zotero.js → utilities → translators)
   - Generates `src/utilities-translate-bundle.ts` (~7.5 MB)
   - Re-exports Zotero and utility functions

2. `bundle-translators.ts` (script: build:translators) - Generates translator registry:
   - Scans `packages/core/translators/` for .js files (Zotero submodule)
   - Extracts translator metadata (ID, label, target pattern, priority)
   - Bundles web translators (type 4) as code strings
   - Generates `src/translators-registry.ts` (~7.5 MB)

3. bunup - Final bundling:
   - Exports as browser target (ESM)
   - Tree-shakes dependencies
   - Generates `dist/index.js` and `dist/index.d.ts`

**Node Package Build:**
- bunup only - Simpler build (no translator bundling needed, uses core)

## Platform Requirements

**Development:**
- macOS, Linux, or Windows with Bun installed
- Git submodule setup required: `git submodule update --init`
- Node.js >= 18 for bun compatibility

**Production:**
- Browser: ES2020+ support (uses fetch API, native DOMParser)
- Node.js: >= 18.0.0 (Bun or Node.js runtime)
- No external services required - fully self-contained after build

## External Submodules

**Zotero Translators:**
- Location: `packages/core/translators/` (git submodule)
- Source: https://github.com/zotero/translators
- Content: 600+ web translators (type 4) for metadata extraction
- Updated manually: `cd packages/core/translators && git pull origin master`

**Zotero Translate:**
- Location: `packages/core/translate/` (git submodule)
- Source: https://github.com/zotero/translate
- Content: Core Zotero translation utilities and APIs
- Bundled at build time into `utilities-translate-bundle.ts`

---

*Stack analysis: 2026-03-26*
