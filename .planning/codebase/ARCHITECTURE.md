# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Translator Execution Pipeline with Sandbox Isolation

**Key Characteristics:**
- Modular translator registry system that lazily loads translator code
- Sandboxed execution of untrusted Zotero translator JavaScript
- Dependency injection pattern for environment-specific DOM implementations
- Monorepo structure separating browser-universal core from Node.js optimizations

## Layers

**API Layer:**
- Purpose: Public interface for metadata extraction
- Location: `packages/core/src/index.ts`
- Contains: Main `extractMetadata()` function, translator discovery functions (`getAvailableTranslators`, `findTranslators`)
- Depends on: TranslatorExecutor, TranslatorRegistry, types
- Used by: External packages and applications

**Translator Registry Layer:**
- Purpose: Manages translator metadata and code retrieval
- Location: `packages/core/src/registry.ts`
- Contains: Abstract `TranslatorRegistry` base class, `BundledRegistry` (static bundled translators), `HTTPRegistry` (dynamic fetching from Zotero)
- Depends on: Translator types, generated translators-registry
- Used by: Executor layer for translator resolution

**Executor Layer:**
- Purpose: Sandbox management and translator code execution
- Location: `packages/core/src/translator-system-modern.ts`
- Contains: `TranslatorExecutor` (orchestrates detection and extraction), `SandboxManager` (code isolation), `ZoteroItem` (metadata container), `ZoteroUtilities` (helper functions)
- Depends on: types, utilities-translate-bundle
- Used by: API layer

**Utilities Layer:**
- Purpose: Zotero compatibility APIs (HTTP, DOM, text processing)
- Location: `packages/core/src/utilities-translate-bundle.ts` (auto-generated)
- Contains: Zotero object, HTTP utilities (request, doGet, doPost), text cleaning functions (cleanISBN, cleanISSN, strToISO, capitalizeTitle, cleanTags, cleanTitle)
- Depends on: None (self-contained)
- Used by: SandboxManager, Executor

**Loader Layer:**
- Purpose: Translator metadata parsing and matching
- Location: `packages/core/src/translator-loader.ts`
- Contains: `parseTranslatorMetadata()`, `loadTranslator()`, `matchesTarget()`, translator filtering functions
- Depends on: types
- Used by: Registry and executor layers

**Type Layer:**
- Purpose: Type definitions for the entire system
- Location: `packages/core/src/types.ts`
- Contains: `ZoteroItem`, `ItemType`, `Creator`, `Tag`, `Note`, `Attachment`, `TranslatorMetadata`, `Translator`, `ExtractMetadataOptions`, `ExtractMetadataResult`
- Depends on: None
- Used by: All layers

**Node.js Adapter Layer:**
- Purpose: Node.js-specific DOM handling and optimizations
- Location: `packages/node/src/` (dom-utils.ts, index.ts)
- Contains: `SafeDOMParser` (linkedom wrapper), `parseHTMLDocument` (XPath bridge), XPath evaluation using xmldom
- Depends on: Core package, linkedom, @xmldom/xmldom, xpath
- Used by: Applications targeting Node.js

## Data Flow

**Metadata Extraction Flow:**

1. **Input Phase** - `extractMetadata()` in `packages/core/src/index.ts`:
   - Accepts URL string or options object
   - Fetches HTML if not provided (using native fetch with User-Agent header)
   - Parses HTML into Document using injected or native DOMParser

2. **Matching Phase** - Filter translators by URL pattern:
   - `getAllTranslatorMetadata()` loads translator registry (lazy-loaded from generated file)
   - `matchesTarget()` tests URL against each translator's regex pattern
   - Translators sorted by priority (lower number = higher priority)
   - Returns early if no matches found

3. **Detection Phase** - Per translator:
   - `TranslatorExecutor.detectWeb()` executes translator's `detectWeb(doc, url)` function
   - Runs in Function constructor with sandboxed Zotero API
   - Returns item type or false/null
   - Skip translator if detection fails

4. **Extraction Phase** - Per translator that passes detection:
   - `TranslatorExecutor.doWeb()` executes translator's `doWeb(doc, url)` function
   - Items collected via `Zotero.Item()` class constructor
   - Item.complete() callback captures created items
   - Handles both synchronous and asynchronous translators (100ms setTimeout fallback)
   - Returns items if any created

5. **Success/Fallback**:
   - Return success with first translator that produces items
   - Continue to next translator if current fails
   - Return error if all translators fail

**Translator Code Execution:**

1. Create sandbox via `SandboxManager.eval()`:
   - Inject sandbox properties as local variables
   - Add function extraction wrappers
   - Add source mapping for debugging

2. Create execution Function:
   - Pass translator code as template literal
   - Provide Zotero API, utilities, helper functions (attr, text, XPathResult)
   - Return detectWeb or doWeb result

3. Sandbox Globals:
   - `Zotero.Item` - Class for creating metadata items
   - `Zotero.selectItems` - Auto-selects all items (no UI)
   - `Zotero.loadTranslator` - Loads embedded translators
   - `ZU` (Zotero.Utilities) - HTTP, text processing, DOM helpers
   - `attr()`, `text()` - CSS selector helpers
   - `XPathResult` - XPath constants

**State Management:**

- No global state in executor
- Each execution creates isolated sandbox
- Items collected via callback into local array
- Promise-based async handling with 100ms timeout for sync translators
- No persistent execution context between translator calls

## Key Abstractions

**TranslatorRegistry:**
- Purpose: Abstract interface for translator source management
- Examples: `packages/core/src/registry.ts` (BundledRegistry, HTTPRegistry)
- Pattern: Abstract class with two implementations - bundled (for distribution) and HTTP (for live updates)

**SandboxManager:**
- Purpose: Secure code execution and scope isolation
- Location: `packages/core/src/translator-system-modern.ts`
- Pattern: Manages execution context, injects dependencies, wraps functions, extracts results
- Key methods: `eval()`, `importObject()`, `set()`, `get()`

**ZoteroItem:**
- Purpose: Metadata container and completion tracking
- Location: Defined in `packages/core/src/translator-system-modern.ts`
- Pattern: Plain class with property collection and completion callback
- Used by: Translators via `new Zotero.Item(itemType)` and `.complete()`

**ZoteroUtilities:**
- Purpose: Translator compatibility layer for HTTP, text, and DOM operations
- Location: `packages/core/src/translator-system-modern.ts` (createZoteroUtilities)
- Pattern: Singleton combining Zotero.Utilities.Translate (HTTP/async) with base utilities (text processing)
- Custom additions: cleanTitle, cleanISBN, cleanISSN, cleanTags, slugify, parseQueryString

**TranslatorLoader:**
- Purpose: Parse and validate translator files
- Location: `packages/core/src/translator-loader.ts`
- Pattern: Pure functions for metadata extraction, URL pattern matching, translator filtering

**DOMParser Dependency Injection:**
- Purpose: Enable different DOM implementations (browser vs Node.js)
- Pattern: Optional `dependencies` parameter in ExtractMetadataOptions
- Browser: Uses native DOMParser and document.evaluate
- Node.js: Uses linkedom (fast) + xmldom bridge (XPath support)

## Entry Points

**Main Extraction Entry:**
- Location: `packages/core/src/index.ts`
- Function: `async extractMetadata(options: string | ExtractMetadataOptions): Promise<ExtractMetadataResult>`
- Triggers: Direct library calls
- Responsibilities: HTML fetching, parsing, translator matching, orchestration

**Translator Discovery Entry:**
- Location: `packages/core/src/index.ts`
- Functions: `getAvailableTranslators()`, `findTranslators(url)`
- Triggers: Registry lookups
- Responsibilities: Return translator metadata for inspection

**Node.js Wrapper Entry:**
- Location: `packages/node/src/index.ts`
- Function: `async extractMetadata(options)` with injected dependencies
- Triggers: Node.js application calls
- Responsibilities: Inject linkedom-based DOM parser, re-export core types

## Error Handling

**Strategy:** Graceful degradation with per-translator try-catch

**Patterns:**

- **HTTP Fetch Errors**: Return error result with HTTP status and message
- **HTML Parse Errors**: Caught by DOMParser, document created (possibly empty)
- **Translator Matching**: Continue to next translator if detection throws
- **Translator Execution**: Catch all errors, log to console, try next translator
- **No Matching Translators**: Return specific error message
- **Async Timeout**: 100ms setTimeout fallback for synchronous translators
- **XPath Evaluation**: Catch errors, log, return empty NodeList

**Result Types:**
- Success: `{ success: true, items: ZoteroItem[], translator: string }`
- Failure: `{ success: false, error: string }`

## Cross-Cutting Concerns

**Logging:**
- Debug translators via `DEBUG_TRANSLATORS=1` environment variable
- Zotero.debug() outputs when DEBUG_TRANSLATORS is set
- Manual console.error() for critical failures

**Validation:**
- Translator metadata validation in parseTranslatorMetadata (required fields)
- URL pattern validation via regex (wrapped in try-catch)
- Item type validation via TypeScript union type
- Creator type validation via TypeScript union type

**Authentication:**
- No built-in auth (translators handle per-site)
- User-Agent header set for fetch (Ztractor/1.0)
- Custom headers supported via ExtractMetadataOptions.headers

**Performance:**
- Lazy-loading of translator registry (loaded on first extraction)
- Bundled translators as strings (~MB) to avoid file I/O
- Priority-based translator ordering (exit early on success)
- Parallel processing not used (sequential matching ensures deterministic results)

---

*Architecture analysis: 2026-03-26*
