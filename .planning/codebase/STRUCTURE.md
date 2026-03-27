# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
ztractor/ (monorepo root)
├── packages/
│   ├── core/                    # Browser/universal implementation
│   │   ├── src/
│   │   │   ├── index.ts         # Main API entry point
│   │   │   ├── types.ts         # All type definitions
│   │   │   ├── translator-system-modern.ts  # Sandbox and execution
│   │   │   ├── translator-loader.ts         # Metadata parsing
│   │   │   ├── registry.ts                  # Translator registries
│   │   │   ├── item.ts                      # Item class (legacy)
│   │   │   ├── utilities-translate-bundle.ts # Auto-generated Zotero APIs
│   │   │   ├── translators-registry.ts      # Auto-generated translator list
│   │   ├── tests/
│   │   │   ├── utilities.test.ts   # ZU helper tests
│   │   │   ├── integration.test.ts # Full extraction flow tests
│   │   │   ├── translator-system-modern.test.ts
│   │   │   └── setup.ts            # Test configuration
│   │   ├── translators/           # Git submodule (Zotero translator repo)
│   │   ├── translate/              # Git submodule (Zotero translate repo)
│   │   ├── docs/                   # Generated documentation
│   │   ├── bundle-translate.ts     # Build script: bundles Zotero utilities
│   │   ├── bundle-translators.ts   # Build script: bundles translator registry
│   │   ├── translation-bundle-patch.js # Patches for translate bundle
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── bunfig.toml
│   │   ├── MODERN_SYSTEM.md
│   │   └── dist/                   # Build output
│   │
│   └── node/                       # Node.js optimized implementation
│       ├── src/
│       │   ├── index.ts            # Re-exports core + injects dependencies
│       │   └── dom-utils.ts        # linkedom parser + XPath bridge
│       ├── tests/
│       │   ├── integration.test.ts # Node-specific extraction tests
│       └── dist/                   # Build output
│
├── examples/                       # Example usage scripts
│   ├── basic-usage.ts
│   ├── advanced-usage.ts
│   ├── browser-example.md
│   └── quickstart.ts
│
├── .planning/
│   └── codebase/                   # GSD codebase documentation
│
├── package.json                    # Workspace root configuration
├── tsconfig.json                   # Root TypeScript config
├── bun.lock                        # Dependency lock file
├── CLAUDE.md                       # Project development guidelines
├── LICENSE                         # AGPL-3.0-or-later
└── README.md
```

## Directory Purposes

**`packages/core/src/`:**
- Purpose: Core universal implementation (browser-compatible)
- Contains: TypeScript source files for translator execution, registry, and APIs
- Key files: `index.ts` (public API), `translator-system-modern.ts` (sandbox), `registry.ts` (translator sources)

**`packages/core/tests/`:**
- Purpose: Unit and integration test suite
- Contains: Bun test files using built-in test runner
- Patterns: Describe/test blocks, mock DOM for unit tests, real HTML for integration
- Key tests: ZU utilities (trimInternal, etc.), translator detection/extraction

**`packages/core/translators/`:**
- Purpose: Zotero translator repository (git submodule)
- Contains: 600+ JavaScript translator files
- Not manually edited: Git submodule, updated via `git submodule update`
- Used by: `bundle-translators.ts` during build

**`packages/core/translate/`:**
- Purpose: Zotero translate library (git submodule)
- Contains: Core Zotero utilities and APIs
- Not manually edited: Git submodule
- Used by: `bundle-translate.ts` during build

**`packages/core/docs/`:**
- Purpose: Auto-generated API documentation
- Contains: Typedoc or similar output
- Committed: No (generated during documentation build)

**`packages/node/src/`:**
- Purpose: Node.js environment adaptations
- Contains: DOM parser wrapper (linkedom), XPath support (xmldom bridge)
- Key dependency: Re-exports core package, overrides DOMParser

**`examples/`:**
- Purpose: Demonstration code for library usage
- Contains: TypeScript examples showing basic and advanced extraction
- Not tests: Reference implementations, not test suite

## Key File Locations

**Entry Points:**

- `packages/core/src/index.ts` - Main public API (extractMetadata, getAvailableTranslators, findTranslators)
- `packages/node/src/index.ts` - Node.js wrapper (injects linkedom dependencies)

**Configuration:**

- `packages/core/package.json` - Core package metadata, build scripts
- `packages/node/package.json` - Node package metadata, dependencies on core
- `packages/core/tsconfig.json` - TypeScript compiler options for core
- `packages/core/bunfig.toml` - Bun bundler configuration

**Core Logic:**

- `packages/core/src/translator-system-modern.ts` - Sandbox execution, Zotero APIs
- `packages/core/src/registry.ts` - Translator metadata and code retrieval
- `packages/core/src/translator-loader.ts` - Metadata parsing and URL matching

**Type Definitions:**

- `packages/core/src/types.ts` - All type interfaces (ZoteroItem, Creator, Translator, etc.)

**Testing:**

- `packages/core/tests/utilities.test.ts` - ZU utility function tests
- `packages/core/tests/integration.test.ts` - Full extraction flow tests
- `packages/node/tests/integration.test.ts` - Node.js-specific tests

**Generated Files (not committed):**

- `packages/core/src/translators-registry.ts` - Auto-generated translator list with bundled code
- `packages/core/src/utilities-translate-bundle.ts` - Auto-generated Zotero APIs
- `packages/core/dist/` - Build output
- `packages/node/dist/` - Build output

## Naming Conventions

**Files:**

- `*.ts` - TypeScript source files
- `*.test.ts` - Test files using Bun test runner
- `*-modern.ts` - New implementation (e.g., translator-system-modern vs legacy executor)
- `bundle-*.ts` - Build scripts that generate code
- `-registry.ts` - Registry/catalog patterns
- `-loader.ts` - Loading and parsing logic
- `-utils.ts` - Utility/helper functions
- `-system.ts` - System-level abstractions

**Directories:**

- `src/` - TypeScript source
- `tests/` - Test files
- `dist/` - Build output
- `docs/` - Documentation
- `translate/` - Zotero translate library (submodule)
- `translators/` - Zotero translators (submodule)

**Functions:**

- `extract*` - Main API functions (extractMetadata)
- `get*` - Getters returning data (getAvailableTranslators, getTranslatorCode)
- `find*` - Search/filter functions (findTranslators, findMatchingTranslators)
- `parse*` - Parsing functions (parseTranslatorMetadata)
- `create*` - Constructor functions (createZoteroUtilities, createSandbox)
- `*Handler` or `*Callback` - Event/callback handlers

**Variables:**

- `CamelCase` - Types and classes
- `camelCase` - Functions and variables
- `UPPER_CASE` - Constants (ZOTERO_CONFIG, XPathResult constants)

## Where to Add New Code

**New Feature:**
- Primary code: `packages/core/src/` for universal logic
- Node.js adapter: `packages/node/src/` if environment-specific
- Tests: `packages/core/tests/` or `packages/node/tests/`

**New Translator API Helper:**
- Add to `createZoteroUtilities()` in `packages/core/src/translator-system-modern.ts`
- Export from utilities if needed in sandbox
- Add tests in `packages/core/tests/utilities.test.ts`

**New Registry Implementation:**
- Extend `TranslatorRegistry` abstract class in `packages/core/src/registry.ts`
- Implement `getTranslatorCode()` and `getAllTranslatorMetadata()`
- Update `ExtractMetadataOptions` dependencies if needed

**Sandbox Improvements:**
- Modify `TranslatorExecutor` class in `packages/core/src/translator-system-modern.ts`
- Add new sandbox globals in `createSandbox()` method
- Update test cases in `packages/core/tests/translator-system-modern.test.ts`

**DOM Helpers (attr, text):**
- Modify function implementations in `packages/core/src/translator-system-modern.ts`
- Add tests in `packages/core/tests/`
- Keep function signatures compatible with Zotero translators

**Node.js-Specific Utilities:**
- Add to `packages/node/src/dom-utils.ts`
- Examples: DOM parser wrapping, XPath implementation, linkedom fixes
- Re-export from `packages/node/src/index.ts` if needed

**Types:**
- All types go to `packages/core/src/types.ts`
- Avoid duplicate type definitions across files
- Export all types from main entry point `packages/core/src/index.ts`

## Special Directories

**`packages/core/translators/` (submodule):**
- Purpose: Zotero translator files (600+ JavaScript files)
- Generated: No (external repository)
- Committed: Via git submodule reference only
- Update: `cd packages/core/translators && git pull origin master`
- Used by: `bundle-translators.ts` build script

**`packages/core/translate/` (submodule):**
- Purpose: Zotero translate library with core APIs
- Generated: No (external repository)
- Committed: Via git submodule reference only
- Update: `cd packages/core/translate && git pull origin master`
- Used by: `bundle-translate.ts` build script

**`packages/core/src/translators-registry.ts` (generated):**
- Purpose: Bundled translator metadata and code (~50MB)
- Generated: Yes - by `bundle-translators.ts` during build
- Committed: Yes (static distribution)
- Edit: Never - auto-generated from translators/ submodule
- Rebuild: `bun run build:translators` or `bun run build`

**`packages/core/src/utilities-translate-bundle.ts` (generated):**
- Purpose: Bundled Zotero utilities APIs
- Generated: Yes - by `bundle-translate.ts` during build
- Committed: Yes (static distribution)
- Edit: Never - auto-generated from translate/ submodule
- Rebuild: `bun run build:translate` or `bun run build`

**`packages/core/docs/` (generated):**
- Purpose: API documentation
- Generated: Yes - by documentation tool
- Committed: No (regenerate as needed)
- Rebuild: Manual via documentation tool

**`dist/` directories:**
- Purpose: Build artifacts (compiled JavaScript)
- Generated: Yes - by build scripts
- Committed: No (git-ignored)
- Rebuild: `bun run build`

---

*Structure analysis: 2026-03-26*
