# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ztractor is a TypeScript library that uses Zotero's 600+ translators to extract structured metadata from websites. It bundles all translator code at build time (as strings) and executes them in a sandboxed environment using linkedom for DOM parsing.

## Build and Development Commands

```bash
# Install dependencies
bun install

# Initialize Zotero translators submodule (required before first build)
git submodule update --init

# Build the project (bundles translators + compiles TypeScript)
bun run build

# Run all tests
bun test

# Run a specific test file
bun test tests/index.test.ts

# Run tests matching a pattern
bun test --test-name-pattern "cleanAuthor"
```

## Architecture Overview

### Build-Time Translator Bundling

The project uses a unique build-time bundling approach to eliminate runtime file I/O:

1. **`build/bundle-translators.ts`** - Build script that:
   - Scans `translators/` directory for all `.js` files
   - Parses metadata from each translator's JSON header
   - Filters for web translators only (type 4)
   - Bundles translator code as template literal strings
   - Generates `src/translators-registry.ts` (~3MB file with all translators)

2. **`src/translators-registry.ts`** (auto-generated):
   - Large auto-generated file containing all translator code as strings
   - Exports `TRANSLATORS_REGISTRY` array with metadata + code
   - Exports `findTranslatorsForUrl()` helper for URL pattern matching
   - Never edit manually - regenerated on every build

### Runtime Execution Flow

1. **URL Matching** (`src/index.ts`):
   - Lazy-loads `translators-registry.ts` on first use
   - Matches URL against translator `target` regex patterns
   - Sorts matches by priority (higher priority first)

2. **DOM Parsing** (`src/executor.ts`):
   - Uses linkedom to parse HTML into Document for fast DOM manipulation
   - Enhances Document with `URL`, `documentURI`, and `location` properties
   - Creates SafeDOMParser wrapper to handle edge cases
   - **XPath Support**: Parses HTML with both linkedom (for DOM) and @xmldom/xmldom (for XPath)
     - XPath queries execute on xmldom document using `xpath` library
     - Results are mapped back to linkedom nodes by path for full compatibility

3. **Sandboxed Execution** (`src/executor.ts`):
   - Creates isolated environment with Zotero API surface
   - Uses `new Function()` to execute translator code strings
   - Executes `detectWeb(doc, url)` to check if translator can handle page
   - Executes `doWeb(doc, url)` to extract metadata
   - Collects items via completion callbacks

4. **Zotero API Implementation**:
   - **`src/item.ts`** - Implements `Zotero.Item` class with all metadata fields
   - **`src/utilities.ts`** - Implements `ZU` (Zotero Utilities) helper functions
   - Provides `attr()`, `text()`, `request()` global helpers
   - Full XPath 1.0 support via hybrid linkedom/xmldom approach

### Key Components

- **`src/index.ts`** - Public API: `extractMetadata()`, `findTranslators()`, `getAvailableTranslators()`
- **`src/types.ts`** - TypeScript definitions for all Zotero item types, metadata fields, and API interfaces
- **`src/executor.ts`** - Sandboxed translator execution using `Function` constructor
- **`src/translator-loader.ts`** - Utilities for parsing translator metadata and URL matching
- **`src/item.ts`** - Zotero.Item implementation with `complete()` callback mechanism
- **`src/utilities.ts`** - ZU utilities (XPath, date parsing, author parsing, DOI cleaning, etc.)

### Testing Structure

Tests are in `tests/` directory (recently moved from `src/*.test.ts`):
- Use Bun's built-in test runner (`bun:test`)
- Test files mirror source file names (e.g., `utilities.test.ts` tests `utilities.ts`)
- Integration tests in `integration.test.ts` test against real translators
- Edge case tests in `edge-cases.test.ts` handle error conditions

## Important Constraints

### Translator Execution

- Translators are executed via `new Function()`, not `eval()`
- Each translator runs in a fresh sandbox with controlled scope
- No access to Node.js APIs or file system from translator code
- Translators use callback-based completion (`item.complete()`)
- Async operations handled with 100ms timeout for completion

### DOM Implementation

- Uses linkedom (not jsdom or real browser) for DOM manipulation - fast and lightweight
- **Full XPath 1.0 support** via hybrid approach:
  - linkedom provides the main DOM for queries and manipulation
  - @xmldom/xmldom + xpath library handle XPath evaluation
  - Results automatically mapped between the two DOM implementations
  - Supports complex XPath: axes (following-sibling, etc.), predicates, contains(), and more
- No JavaScript execution on pages (static HTML only)
- Some translators that require complex DOM APIs may not work

### Bundling Constraints

- Only web translators (type 4) are bundled
- Translator code is bundled as strings, requiring `Function()` at runtime
- Registry file is ~3MB and must be regenerated when translators submodule updates
- Import/export/search translators are excluded

## Common Patterns

### Adding Support for New Zotero Item Fields

1. Add field to `ZoteroItem` interface in `src/types.ts`
2. Add field as class property in `src/item.ts`
3. No changes needed in executor - fields are dynamically collected

### Extending Zotero Utilities

Add new utility functions to the `ZU` object in `src/utilities.ts`. Many translators depend on:
- `ZU.xpath()` - Execute XPath queries and return nodes (full XPath 1.0 support)
- `ZU.xpathText()` - Extract text via XPath
- `ZU.cleanAuthor()` - Parse author names
- `ZU.strToISO()` - Convert dates to ISO format
- `ZU.cleanDOI()` / `cleanISBN()` / `cleanISSN()` - Clean identifiers

Note: XPath queries are handled by the hybrid linkedom/xmldom system automatically.

### Debugging Translator Execution

Set `DEBUG_TRANSLATORS=1` environment variable to enable `Zotero.debug()` logging:
```bash
DEBUG_TRANSLATORS=1 bun test tests/integration.test.ts
```

## Updating Zotero Translators

When Zotero releases new translators:

```bash
# Update submodule to latest
cd translators
git pull origin master
cd ..

# Rebuild to regenerate registry
bun run build
```

The build automatically bundles all updated translators into the registry.
