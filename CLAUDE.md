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
