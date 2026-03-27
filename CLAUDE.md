# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ztractor is a monorepo that extracts structured metadata from websites using Zotero's 600+ translators. It provides two packages:

- **ztractor** (packages/core): Browser/universal version using native DOM APIs
- **ztractor-node** (packages/node): Node.js optimized version with linkedom for fast DOM parsing

The core functionality wraps Zotero translator JavaScript files, executes them in a sandboxed environment, and returns structured metadata.

## Build Commands

This project uses Bun as the package manager and build tool.

**Initial setup:**
```bash
# Initialize the Zotero translators git submodule (required for first build)
git submodule update --init

# Install dependencies
bun install
```

**Build all packages:**
```bash
bun run build
```

This runs the build scripts for both packages in the monorepo workspace. For the core package, it:
1. Executes `bundle-translators.ts` to generate the translator registry
2. Runs `bunup` to build and bundle the TypeScript code

**Build individual packages:**
```bash
# Build core package only
cd packages/core && bun run build

# Build node package only
cd packages/node && bun run build
```

**Run tests:**
```bash
# Run all tests
bun test

# Run tests for specific package
cd packages/core && bun test
cd packages/node && bun test

# Run a single test file
bun test packages/core/tests/utilities.test.ts
```

## Architecture

### Translator Registry System (packages/core)

The build process (`bundle-translators.ts`) scans the `packages/core/translators/` directory (a git submodule of Zotero's translator repository) and generates `src/translators-registry.ts`, which:

- Bundles all web translators (type 4) as JavaScript code strings
- Extracts and stores metadata (ID, label, target URL pattern, priority)
- Creates helper functions `findTranslatorsForUrl()` and `getTranslatorById()`
- Results in a ~MB-sized generated file that should never be edited manually

The registry is lazy-loaded at runtime to avoid loading all translators upfront.

### Execution Flow

1. **extractMetadata()** (src/index.ts) - Main entry point that:
   - Fetches HTML if not provided
   - Parses HTML into a Document object
   - Finds matching translators by URL pattern
   - Tries translators in priority order

2. **executeDetectWeb()** (src/executor.ts) - Checks if a translator can handle the page:
   - Creates a sandboxed Zotero environment
   - Executes translator's `detectWeb()` function using `Function` constructor
   - Returns item type or false/null

3. **executeDoWeb()** (src/executor.ts) - Extracts metadata:
   - Creates sandbox with item completion callback
   - Executes translator's `doWeb()` function
   - Collects items created by translator via `new Zotero.Item()`

4. **Sandbox Environment** - Provides Zotero API to translators:
   - `Zotero.Item` class for creating metadata items
   - `ZU` utilities for HTTP requests, DOM manipulation, text processing
   - Helper functions: `attr()`, `text()`, `request()`, `requestText()`, `requestJSON()`
   - Resolves relative URLs against the page URL

### Node.js Optimizations (packages/node)

The Node.js package wraps the core package and injects linkedom-based dependencies:

- **dom-utils.ts** provides:
  - `SafeDOMParser` - Wraps linkedom's DOMParser with fallback for edge cases
  - `parseHTMLDocument()` - Creates Document with URL properties and XPath support
  - XPath bridge between linkedom (fast parsing) and xmldom (XPath queries)

- **XPath Implementation**: Uses xmldom to execute XPath queries, then maps results back to linkedom nodes by traversing the DOM tree path. This hybrid approach balances speed (linkedom) with compatibility (xmldom XPath).

### Package Relationship

```
ztractor-node (packages/node)
  └─ imports extractMetadata from ztractor (packages/core)
  └─ injects { DOMParser, parseHTMLDocument } dependencies
  └─ workspace:* dependency ensures local linking
```

## Important Patterns

### Working with Translators

- Translators are Zotero JavaScript files with JSON metadata headers
- Only web translators (translatorType: 4) are included
- Translators use `detectWeb()` to check compatibility and `doWeb()` to extract
- Translators execute in a sandboxed environment with limited Zotero API access

### Testing Approach

Tests are located in `packages/*/tests/` and use Bun's built-in test runner:

- **Unit tests**: Test individual utilities, item creation, translator loading
- **Integration tests**: Test full extraction flow with real HTML samples
- **Edge case tests**: Handle malformed HTML, missing fields, XPath errors

### Dependency Injection Pattern

The core package accepts a `dependencies` parameter to allow environment-specific implementations (browser vs Node.js) while keeping the core logic universal. This enables:

- Browser: Use native `DOMParser` and `document.evaluate()`
- Node.js: Use linkedom + xmldom for faster parsing and XPath support

## Common Development Tasks

### Adding Support for New Translators

New translators are automatically picked up when:
1. Updating the translators submodule: `cd packages/core/translators && git pull origin master`
2. Running the build: `bun run build`

No code changes needed - the bundler automatically processes all `.js` files in the translators directory.

### Debugging Translator Execution

Set `DEBUG_TRANSLATORS=1` environment variable to enable translator debug logging:
```bash
DEBUG_TRANSLATORS=1 bun test packages/node/tests/integration.test.ts
```

### Updating Zotero Translators

```bash
cd packages/core/translators
git pull origin master
cd ../../..
bun run build
```

### Publishing Packages

Both packages are configured for npm publishing with proper exports and type definitions. Build artifacts are in `packages/*/dist/`.

## License

AGPL v3+ - This is a copyleft license that requires derivative works to also be open source under AGPL.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Ztractor**

Ztractor is a programmatic API for Zotero's 600+ web translators — libraries that extract structured bibliographic metadata (title, authors, DOI, publication info, etc.) from websites. A version already exists on npm, but the translator execution sandbox isn't fully compatible with what real translators expect. This rewrite re-implements the sandbox in modern JS to match Zotero's actual API surface, so that the full translator library works correctly.

**Core Value:** The sandbox is compatible enough that real Zotero translators pass Zotero's own test suite — meaning any translator that works in Zotero works in ztractor.

### Constraints

- **Tech Stack**: Bun as package manager and build tool — all scripts use `bun`, `bunup`, `bun test`
- **Compatibility**: Must work in browser (native DOM) and Node.js (injected linkedom) — no Node-specific imports in `packages/core`
- **Bundler**: `bunup --exports -t browser --external jsdom,./xregexp-all` — browser target, certain deps externalized
- **Translators**: ~685 bundled web translators; auto-generated registry must never be manually edited
- **License**: AGPL v3+ — copyleft; derivative works must also be AGPL
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.x - Core implementation and type definitions across both packages
- JavaScript - Zotero translator files (bundled at build time)
- TOML - Build configuration (bunfig.toml)
## Runtime
- Node.js >= 18.0.0 (for root and packages/node)
- Browser environment (for packages/core with native APIs)
- Bun 1.x (runtime and build tool)
- Bun - Primary package manager and test runner
- Lockfile: `bun.lock` (present)
## Frameworks
- No web framework - Library-based package (exported as ESM module)
- Bun's built-in test runner - No external test framework dependency
- bunup 0.15.14 - Tree-shaking bundler for TypeScript to ESM
- @babel/parser 7.28.5 - AST parsing for Zotero translator bundling
- recast 0.23.11 - AST transformation for unwrapping IIFEs in translator utilities
- Biome 2.2.4 - Code formatter and linter (optional, available as dev tool)
## Key Dependencies
- Uses native DOM APIs (browser) or injected dependencies (Node.js)
- Bundles Zotero translator utilities at build time as a single module
- Exports types and functions for metadata extraction
- TypeScript 5.x - Type checking
- @babel/parser - JavaScript parsing for translator bundling
- recast - AST rewriting to convert IIFE-wrapped utilities to modules
- bunup - Build and bundling
- Biome - Code quality (linting/formatting)
- ztractor (workspace:*) - Depends on core package
- linkedom 0.18.5 - Fast DOM parser and implementation for Node.js
- @xmldom/xmldom 0.8.11 - XPath support via xmldom for XPath queries on parsed HTML
- xpath 0.0.34 - XPath expression evaluation library
- TypeScript 5.x, bunup, @types/bun
## Configuration
- .env file present (contains build or test configuration)
- No environment variables required for core library (uses fetch API)
- Node package injects dependencies for environment-specific DOM parsing
- `tsconfig.json` - Strict TypeScript configuration (strict: true, bundler module resolution)
- `packages/core/bunfig.toml` - Bun test configuration with test setup preload
- Build targets ESNext with native module preservation
## Build Process
- bunup only - Simpler build (no translator bundling needed, uses core)
## Platform Requirements
- macOS, Linux, or Windows with Bun installed
- Git submodule setup required: `git submodule update --init`
- Node.js >= 18 for bun compatibility
- Browser: ES2020+ support (uses fetch API, native DOMParser)
- Node.js: >= 18.0.0 (Bun or Node.js runtime)
- No external services required - fully self-contained after build
## External Submodules
- Location: `packages/core/translators/` (git submodule)
- Source: https://github.com/zotero/translators
- Content: 600+ web translators (type 4) for metadata extraction
- Updated manually: `cd packages/core/translators && git pull origin master`
- Location: `packages/core/translate/` (git submodule)
- Source: https://github.com/zotero/translate
- Content: Core Zotero translation utilities and APIs
- Bundled at build time into `utilities-translate-bundle.ts`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- camelCase for function/module files: `translator-loader.ts`, `translator-system-modern.ts`
- kebab-case for hyphenated names: `translator-system-modern.ts`, `utilities-translate-bundle.ts`
- Types file: `types.ts`
- Registry file: `registry.ts`
- camelCase: `extractMetadata()`, `findTranslators()`, `parseHTMLDocument()`, `createZoteroUtilities()`
- Verb-first naming pattern for main operations: `extractMetadata()`, `parseTranslatorMetadata()`, `loadTranslator()`, `matchesTarget()`
- Helper functions use clear intent: `createMockDocument()`, `createZoteroUtilities()`, `createSandbox()`
- camelCase: `translatorID`, `itemType`, `htmlContent`, `matchingMetadata`
- Const-first pattern for immutable data: `const defaultRegistry = new BundledRegistry()`
- Private properties prefix underscore: `_TRANSLATORS_REGISTRY`, `_setComplete()`, `_debug()`
- Destructuring for function parameters: `const { url, html, headers, timeout = 30000, dependencies, registry } = opts`
- PascalCase for classes and interfaces: `ZoteroItem`, `TranslatorExecutor`, `SandboxManager`
- CapitalCase for union types: `ItemType`, `CreatorType`
- Interface names prefixed with `I` is NOT used; prefer bare names: `Creator`, `Tag`, `Note`, `Attachment`
- Type imports explicitly marked: `import type { ItemType, Translator } from './types'`
## Code Style
- No formatter configured (biome was deleted from root, `.prettierrc` not present)
- Tab indentation appears to be standard (seen in package.json)
- Line length follows natural code breaks, not strict limit
- Comments use `//` for single-line, `/** */` for JSDoc blocks
- No eslint config in root or core package
- Biome was used but removed (noted in git status as deleted)
- Strict TypeScript enabled: `"strict": true` in `tsconfig.json`
- Additional strict rules enabled:
- Disabled strict rules:
## Import Organization
- `ztractor` alias points to `./src/index.ts` in packages/core tsconfig
- Workspace: dependencies use `workspace:*` in packages/node for local linking
- ES modules throughout: `"type": "module"` in package.json
- Preserve module syntax: `"module": "Preserve"` in tsconfig
- Bundler module resolution: `"moduleResolution": "bundler"`
## Error Handling
- Try-catch blocks used for regressive errors: In `parseTranslatorMetadata()` and `matchesTarget()`
- Console.error for logging: `console.error("Error parsing translator metadata:", e)`
- Return `null` for failed parsing: `return null` when metadata parse fails
- Silent catches with fallback: `} catch (_e) { return false; }` in `matchesTarget()`
- Result objects for errors: `{ success: false, error: "message" }` in `extractMetadata()`
- Promise rejection handling: `.catch()` not used; errors bubble up or return failure objects
- Error context passed: `catch (e) { console.error(\`Error in detectWeb for ${translator.metadata.label}:\`, e) }`
- Errors in translator execution return empty array: `expect(items).toEqual([])` on error
- Translator errors don't crash extraction: `catch (e) { /* Try next translator */ continue; }`
## Logging
- Debug mode via environment: `process.env?.DEBUG_TRANSLATORS` for conditional debug logs
- Error logging with context: `console.error(\`Error in detectWeb for ${translator.metadata.label}:\`, e)`
- Debug logs with prefix: `console.log('[ZU]', msg)` when `DEBUG_TRANSLATORS` enabled
- Minimal logging in core: Most logging happens in error paths only
## Comments
- Complex algorithms: `// Build the augmented code` before code transformation
- Intent clarification: `// Lower number = higher priority` for sort operations
- Browser compatibility notes: `// read-only in some environments — ignore`
- Zotero API compatibility: Comments explaining why specific handling exists
- Type narrowing: Comments explain guard conditions
- Used for public functions only
- Block format with @example for main exports: See `extractMetadata()` with full example
- Parameter docs: Rare; types are relied upon instead
- Links to related functions: `@example` blocks shown
- Property descriptions in interfaces: Minimal; types are self-documenting
## Function Design
- Single object parameter for multiple options: `extractMetadata(options: string | ExtractMetadataOptions)`
- Destructuring in function body for clarity: `const { url, html, headers, timeout = 30000 } = opts`
- Type-safe defaults: `timeout = 30000` in destructuring
- Operator overloading pattern: `typeof options === "string" ? { url: options } : options`
- Union types for success/failure: `Promise<ExtractMetadataResult>` with `{ success: boolean, error?: string }`
- Null for "not found": `return null` in `parseTranslatorMetadata()`
- Empty array for "no items": `return []` in failed translator execution
- Typed arrays: `Promise<ZoteroItem[]>` is explicit
## Module Design
- Named exports for functions: `export async function extractMetadata()`
- Default export avoided: Files export multiple related functions
- Type exports on separate lines: `export type { ExtractMetadataOptions, ExtractMetadataResult }`
- Barrel re-exports used: `export { BundledRegistry, HTTPRegistry } from "./registry"`
- Main `index.ts` re-exports public API
- No nested barrel files (one level only)
- Private methods use underscore: `_setComplete()`, `_TRANSLATORS_REGISTRY`
- Abstract base classes define contracts: `abstract class TranslatorRegistry`
- Concrete implementations extend: `class BundledRegistry extends TranslatorRegistry`
## Class Patterns
- Public constructor with optional options: `constructor(options: TranslatorExecutorOptions = {})`
- Spread defaults in constructor: `this.options = { ...options }`
- Lazy initialization: Registry loads translators on first access
- Private methods prefixed underscore: `private injectSandboxVariables()`
- Method chaining avoided
- Private utility methods kept small: `private executeInContext()`
- Public readonly where no mutation: `public sandbox: SandboxGlobals`
- Private properties with underscore: `private options: TranslatorExecutorOptions`
- Type definitions in property signatures
## TypeScript Patterns
- Minimal generic usage: `get<T = any>(key: string): T | undefined`
- Type parameters with defaults: `<T = any>` avoids caller burden
- No complex generic constraints
- Early returns for null checks: `if (!docOrElem) return null`
- Conditional type narrowing: `if (typeof attrNameOrUndef === 'string') { ... }`
- Type casting only when necessary: Avoided when possible
- Used strategically for Zotero API compatibility: `as any` for dynamically built Zotero object
- Not used in test code (prefer assertions)
- Limited to integration boundaries
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Modular translator registry system that lazily loads translator code
- Sandboxed execution of untrusted Zotero translator JavaScript
- Dependency injection pattern for environment-specific DOM implementations
- Monorepo structure separating browser-universal core from Node.js optimizations
## Layers
- Purpose: Public interface for metadata extraction
- Location: `packages/core/src/index.ts`
- Contains: Main `extractMetadata()` function, translator discovery functions (`getAvailableTranslators`, `findTranslators`)
- Depends on: TranslatorExecutor, TranslatorRegistry, types
- Used by: External packages and applications
- Purpose: Manages translator metadata and code retrieval
- Location: `packages/core/src/registry.ts`
- Contains: Abstract `TranslatorRegistry` base class, `BundledRegistry` (static bundled translators), `HTTPRegistry` (dynamic fetching from Zotero)
- Depends on: Translator types, generated translators-registry
- Used by: Executor layer for translator resolution
- Purpose: Sandbox management and translator code execution
- Location: `packages/core/src/translator-system-modern.ts`
- Contains: `TranslatorExecutor` (orchestrates detection and extraction), `SandboxManager` (code isolation), `ZoteroItem` (metadata container), `ZoteroUtilities` (helper functions)
- Depends on: types, utilities-translate-bundle
- Used by: API layer
- Purpose: Zotero compatibility APIs (HTTP, DOM, text processing)
- Location: `packages/core/src/utilities-translate-bundle.ts` (auto-generated)
- Contains: Zotero object, HTTP utilities (request, doGet, doPost), text cleaning functions (cleanISBN, cleanISSN, strToISO, capitalizeTitle, cleanTags, cleanTitle)
- Depends on: None (self-contained)
- Used by: SandboxManager, Executor
- Purpose: Translator metadata parsing and matching
- Location: `packages/core/src/translator-loader.ts`
- Contains: `parseTranslatorMetadata()`, `loadTranslator()`, `matchesTarget()`, translator filtering functions
- Depends on: types
- Used by: Registry and executor layers
- Purpose: Type definitions for the entire system
- Location: `packages/core/src/types.ts`
- Contains: `ZoteroItem`, `ItemType`, `Creator`, `Tag`, `Note`, `Attachment`, `TranslatorMetadata`, `Translator`, `ExtractMetadataOptions`, `ExtractMetadataResult`
- Depends on: None
- Used by: All layers
- Purpose: Node.js-specific DOM handling and optimizations
- Location: `packages/node/src/` (dom-utils.ts, index.ts)
- Contains: `SafeDOMParser` (linkedom wrapper), `parseHTMLDocument` (XPath bridge), XPath evaluation using xmldom
- Depends on: Core package, linkedom, @xmldom/xmldom, xpath
- Used by: Applications targeting Node.js
## Data Flow
- No global state in executor
- Each execution creates isolated sandbox
- Items collected via callback into local array
- Promise-based async handling with 100ms timeout for sync translators
- No persistent execution context between translator calls
## Key Abstractions
- Purpose: Abstract interface for translator source management
- Examples: `packages/core/src/registry.ts` (BundledRegistry, HTTPRegistry)
- Pattern: Abstract class with two implementations - bundled (for distribution) and HTTP (for live updates)
- Purpose: Secure code execution and scope isolation
- Location: `packages/core/src/translator-system-modern.ts`
- Pattern: Manages execution context, injects dependencies, wraps functions, extracts results
- Key methods: `eval()`, `importObject()`, `set()`, `get()`
- Purpose: Metadata container and completion tracking
- Location: Defined in `packages/core/src/translator-system-modern.ts`
- Pattern: Plain class with property collection and completion callback
- Used by: Translators via `new Zotero.Item(itemType)` and `.complete()`
- Purpose: Translator compatibility layer for HTTP, text, and DOM operations
- Location: `packages/core/src/translator-system-modern.ts` (createZoteroUtilities)
- Pattern: Singleton combining Zotero.Utilities.Translate (HTTP/async) with base utilities (text processing)
- Custom additions: cleanTitle, cleanISBN, cleanISSN, cleanTags, slugify, parseQueryString
- Purpose: Parse and validate translator files
- Location: `packages/core/src/translator-loader.ts`
- Pattern: Pure functions for metadata extraction, URL pattern matching, translator filtering
- Purpose: Enable different DOM implementations (browser vs Node.js)
- Pattern: Optional `dependencies` parameter in ExtractMetadataOptions
- Browser: Uses native DOMParser and document.evaluate
- Node.js: Uses linkedom (fast) + xmldom bridge (XPath support)
## Entry Points
- Location: `packages/core/src/index.ts`
- Function: `async extractMetadata(options: string | ExtractMetadataOptions): Promise<ExtractMetadataResult>`
- Triggers: Direct library calls
- Responsibilities: HTML fetching, parsing, translator matching, orchestration
- Location: `packages/core/src/index.ts`
- Functions: `getAvailableTranslators()`, `findTranslators(url)`
- Triggers: Registry lookups
- Responsibilities: Return translator metadata for inspection
- Location: `packages/node/src/index.ts`
- Function: `async extractMetadata(options)` with injected dependencies
- Triggers: Node.js application calls
- Responsibilities: Inject linkedom-based DOM parser, re-export core types
## Error Handling
- **HTTP Fetch Errors**: Return error result with HTTP status and message
- **HTML Parse Errors**: Caught by DOMParser, document created (possibly empty)
- **Translator Matching**: Continue to next translator if detection throws
- **Translator Execution**: Catch all errors, log to console, try next translator
- **No Matching Translators**: Return specific error message
- **Async Timeout**: 100ms setTimeout fallback for synchronous translators
- **XPath Evaluation**: Catch errors, log, return empty NodeList
- Success: `{ success: true, items: ZoteroItem[], translator: string }`
- Failure: `{ success: false, error: string }`
## Cross-Cutting Concerns
- Debug translators via `DEBUG_TRANSLATORS=1` environment variable
- Zotero.debug() outputs when DEBUG_TRANSLATORS is set
- Manual console.error() for critical failures
- Translator metadata validation in parseTranslatorMetadata (required fields)
- URL pattern validation via regex (wrapped in try-catch)
- Item type validation via TypeScript union type
- Creator type validation via TypeScript union type
- No built-in auth (translators handle per-site)
- User-Agent header set for fetch (Ztractor/1.0)
- Custom headers supported via ExtractMetadataOptions.headers
- Lazy-loading of translator registry (loaded on first extraction)
- Bundled translators as strings (~MB) to avoid file I/O
- Priority-based translator ordering (exit early on success)
- Parallel processing not used (sequential matching ensures deterministic results)
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
