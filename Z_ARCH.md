# Zotero Architecture Documentation

This document describes the architecture of Zotero's translation system based on the utilities-translate-bundle.ts file, which contains Zotero's core translation utilities bundled from the [zotero/translate](https://github.com/zotero/translate) repository.

## Overview

Zotero's translation system is a comprehensive framework for extracting bibliographic metadata from various sources (web pages, files, searches) and converting between different citation formats. The architecture is built around a **sandbox-based execution model** where translator scripts run in isolated environments with controlled access to Zotero APIs.

## Core Architectural Components

### 1. Zotero Global Namespace

The entire system is organized under the `Zotero` namespace, which contains all core classes, utilities, and subsystems:

```javascript
Zotero = {
  Proxies,           // Proxy detection and handling
  Utilities,         // General utility functions
  Translate,         // Translation subsystem
  Translator,        // Translator metadata and info
  Translators,       // Translator registry and lookup
  HTTP,              // HTTP request handling
  Promise,           // Promise utilities
  Date,              // Date parsing and formatting
  OpenURL,           // OpenURL context object handling
  Debug,             // Logging and debugging
  Prefs,             // Preferences management
  Item,              // Item data structures (created in sandbox)
  Collection,        // Collection data structures
  RDF,               // RDF/N3 parsing and manipulation
}
```

## Translation Subsystem Architecture

### 2. Translation Types (Zotero.Translate)

The translation system supports four distinct types, each with specialized functionality:

#### a) **Zotero.Translate.Web**
- **Purpose**: Extract metadata from web pages
- **Entry Functions**: `detectWeb()`, `doWeb()`
- **Key Features**:
  - URL pattern matching to find appropriate translators
  - DOM document processing
  - Cookie sandbox support for authenticated sessions
  - Proxy detection and handling
  - RPC communication with Zotero connector

#### b) **Zotero.Translate.Import**
- **Purpose**: Import items from files (RIS, BibTeX, etc.)
- **Entry Functions**: `detectImport()`, `doImport()`
- **Key Features**:
  - File content detection
  - Streaming I/O for large files
  - Progress tracking

#### c) **Zotero.Translate.Export**
- **Purpose**: Export items to various formats
- **Entry Functions**: `doExport()`
- **Key Features**:
  - Item getter for sequential item access
  - Display options configuration
  - Collection export support

#### d) **Zotero.Translate.Search**
- **Purpose**: Search for items by identifier (DOI, ISBN, etc.)
- **Entry Functions**: `detectSearch()`, `doSearch()`

### 3. Translator Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Translation Lifecycle                     │
└─────────────────────────────────────────────────────────────┘

1. Translator Discovery
   ├── getTranslators() - Find applicable translators
   ├── _getTranslatorsGetPotentialTranslators() - Get candidates
   └── Detect phase - Run detectWeb/detectImport

2. Translator Selection
   ├── setTranslator() - Set specific translator
   └── Priority-based selection for web translators

3. Sandbox Preparation
   ├── _prepareTranslation() - Initialize translation
   ├── _loadTranslator() - Load translator code
   └── _createSandbox() - Create isolated environment

4. Translation Execution
   ├── translate() - Execute translation
   ├── _translateTranslatorLoaded() - After translator loads
   └── Execute doWeb/doImport/doExport/doSearch

5. Item Processing
   ├── _itemDone() - Process completed items
   ├── _saveItems() - Save items to storage
   └── Handler callbacks - itemDone, collectionDone

6. Completion
   ├── complete() - Finalize translation
   └── Handler callbacks - done, error
```

### 4. Sandbox Architecture (Zotero.Translate.SandboxManager)

Translators run in **sandboxed JavaScript environments** to ensure security and API control:

#### Sandbox Structure
```javascript
sandbox = {
  Zotero: {
    Item,              // Item constructor
    Collection,        // Collection constructor
    Utilities,         // Utility functions (ZU)
    debug(),           // Debug logging
    done(),            // Signal completion
    selectItems(),     // User item selection
  },
  Promise,             // Promise support
  // Translator-specific globals
}
```

#### Sandbox Features
- **Code Evaluation**: `eval()` executes translator code in controlled context
- **Object Importation**: `importObject()` exposes Zotero APIs to sandbox
- **Function Extraction**: Inner functions imported back into sandbox
- **Isolation**: Translators cannot access host environment directly

#### Sandbox Types (Zotero.Translate.Sandbox)

Each translation type has a specialized sandbox:

- **Base Sandbox**: Common APIs for all translator types
  - `_itemDone()` - Item completion handler
  - Item/tag cleaning and normalization
  - Attachment handling

- **Web Sandbox**: Additional web-specific APIs
  - Document access
  - XPath evaluation
  - HTTP requests

- **Import/Export Sandbox**: File I/O APIs
  - `Zotero.read()` - Read from input stream
  - `Zotero.write()` - Write to output stream

- **Search Sandbox**: Search-specific APIs

### 5. Translator Model (Zotero.Translator)

Translators are JavaScript files with JSON metadata headers:

```javascript
{
  translatorID: "uuid",           // Unique identifier
  label: "Site Name",             // Display name
  creator: "Author Name",         // Translator author
  target: "regex",                // URL pattern (web translators)
  minVersion: "5.0",             // Minimum Zotero version
  maxVersion: "",                // Maximum version
  priority: 100,                 // Selection priority (higher = better)
  inRepository: true,            // In official repository
  translatorType: 4,             // Type bitmask
  browserSupport: "gcsibv",      // Browser compatibility
  lastUpdated: "2023-01-01"      // Last modification date
}
```

#### Translator Types (Bitmask)
- `1` - Import
- `2` - Export
- `4` - Web
- `8` - Search

#### Run Modes
- `RUN_MODE_IN_BROWSER = 1` - Runs in browser/client
- `RUN_MODE_ZOTERO_STANDALONE = 2` - Runs in Zotero app
- `RUN_MODE_ZOTERO_SERVER = 4` - Runs on server

### 6. Translator Registry (Zotero.Translators)

Manages the collection of available translators:

```javascript
Zotero.Translators = {
  init(),                         // Initialize translator registry
  get(id),                        // Get translator by ID
  getAllForType(type),            // Get all translators of type
  getWebTranslatorsForLocation(url, rootUrl), // Match web translators

  // CodeGetter - Async translator code loading
  CodeGetter: {
    getCodeFor(index),           // Get code for specific translator
    getAll()                      // Get all translator codes
  }
}
```

## Utility Subsystems

### 7. Zotero.Utilities (ZU)

The `Zotero.Utilities` namespace provides essential helper functions:

#### Core Utilities
- **Text Processing**
  - `trimInternal()` - Normalize whitespace
  - `capitalizeTitle()` - Smart title capitalization
  - `cleanTags()` - Tag normalization
  - `quotemeta()` - Escape regex special characters

- **DOM Manipulation**
  - `xpath()` - XPath query evaluation
  - `xpathText()` - Extract text via XPath
  - `getItemArray()` - Extract links from page

- **Date Handling** (via Zotero.Date)
  - `strToDate()` - Parse date strings
  - `formatDate()` - Format dates
  - `strToISO()` - Convert to ISO 8601

- **Item Conversion** (via Zotero.Utilities.Item)
  - `itemToCSLJSON()` - Convert to CSL-JSON
  - `itemFromCSLJSON()` - Parse CSL-JSON
  - `itemTypeExists()` - Validate item type

#### Translator Utilities (Zotero.Utilities.Translate)

Extended utilities available in translators:

- **HTTP Requests**
  - `request(url, options)` - Generic HTTP request
  - `requestText(url)` - Fetch text content
  - `requestJSON(url)` - Fetch and parse JSON
  - `requestDocument(url)` - Fetch and parse HTML
  - `processDocuments(urls, processor)` - Batch document processing
  - `doGet()` / `doPost()` - Legacy HTTP methods

- **Proxy Handling**
  - `urlToProxy(url)` - Convert to proxied URL
  - `urlToProper(url)` - Remove proxy wrapper

### 8. Proxy System (Zotero.Proxy / Zotero.Proxies)

Handles institutional proxy detection and URL manipulation:

#### Zotero.Proxy
Represents a single proxy configuration:

```javascript
{
  id: timestamp,
  scheme: "%h.proxy.edu/%p",     // Proxy URL scheme
  hosts: ["example.com"],         // Proxied hosts
  autoAssociate: true,            // Auto-detect new hosts
  regexp: RegExp                  // Compiled URL matcher
}
```

#### Scheme Parameters
- `%h` - Hostname (e.g., "www.nature.com")
- `%p` - Path including query (e.g., "article/123?ref=1")
- `%d` - Directory path
- `%f` - Filename
- `%a` - Any text

#### Methods
- `compileRegexp()` - Build regex from scheme
- `toProper(url)` - Deproxify URL
- `toProxy(url)` - Proxify URL

#### Zotero.Proxies
Global proxy management:

- `getPotentialProxies(url)` - Detect proxy patterns
- `_isBlacklisted(host)` - Check if host should not be proxied

### 9. HTTP System (Zotero.HTTP)

Handles all HTTP communication:

```javascript
Zotero.HTTP = {
  request(method, url, options),   // Generic request
  doGet(url, onDone, ...),        // GET request
  doPost(url, body, onDone, ...),  // POST request
  processDocuments(doc, xpath, ...),// Process multiple docs

  StatusError                      // HTTP error class
}
```

### 10. Item Model

Items are created in the sandbox via `new Zotero.Item(itemType)`:

#### Item Structure
```javascript
{
  itemType: "journalArticle",     // Item type
  title: "Article Title",         // Title
  creators: [                     // Authors/contributors
    {
      firstName: "John",
      lastName: "Doe",
      creatorType: "author"
    }
  ],
  date: "2023-01-01",            // Publication date
  publicationTitle: "Journal",   // Journal/book title
  volume: "10",                  // Volume
  issue: "2",                    // Issue
  pages: "100-120",              // Page range
  DOI: "10.1234/example",        // Digital Object Identifier
  url: "https://...",            // URL
  accessDate: "2023-05-01",      // Access date
  tags: ["tag1", "tag2"],        // Tags
  notes: ["note text"],          // Notes
  attachments: [                 // Attached files
    {
      title: "Full Text PDF",
      url: "https://...",
      mimeType: "application/pdf"
    }
  ],
  seeAlso: [],                   // Related items
  relations: {}                  // Item relations
}
```

#### Item Completion
- Translators call `item.complete()` to save item
- Triggers `_itemDone()` handler in sandbox
- Item normalization and validation
- Attachment processing
- Handler callbacks (itemDone, itemSaving)

### 11. Item Saver (Zotero.Translate.ItemSaver)

Virtual class for receiving completed items:

```javascript
ItemSaver = {
  saveItems(jsonItems, attachmentCallback, itemsDoneCallback),
  saveCollection(collections),

  // Attachment modes
  ATTACHMENT_MODE_IGNORE: 0,
  ATTACHMENT_MODE_DOWNLOAD: 1,
  ATTACHMENT_MODE_FILE: 2
}
```

### 12. RDF/N3 Processing

Zotero includes a complete RDF (Resource Description Framework) parser for metadata extraction:

#### Components
- **Term Types**: Symbol, Literal, BlankNode, Collection
- **IndexedFormula**: RDF triple store with indexed access
- **Statement Matching**: Efficient query system for RDF graphs
- **Namespace Support**: URI prefix management

#### Use Cases
- Parsing embedded metadata (Dublin Core, PRISM, etc.)
- COinS (Context Objects in Spans) extraction
- OpenURL resolution

## Handler System

Translators communicate with the host through **event handlers**:

### Handler Types

```javascript
setHandler(type, callback)

// Available handlers:
"select"         - User item selection (web)
"itemDone"       - Item completed
"collectionDone" - Collection completed
"done"           - Translation finished
"debug"          - Debug message
"error"          - Fatal error occurred
"translators"    - Translator search complete
"pageModified"   - Web page modified (web)
"itemSaving"     - Before item save
```

### Handler Flow

```
Translator Code          Sandbox                 Host Application
─────────────────        ─────────               ───────────────────
new Zotero.Item()
  .set properties
  .complete()     ──────> _itemDone()
                          - normalize      ────> itemSaving handler
                          - validate
                          - queue/save     ────> saveItems()
                                          ────> itemDone handler

Zotero.done()     ──────> complete()      ────> done handler
```

## Asynchronous Processing

The translation system uses Promises for async operations:

### Zotero.Promise Extensions
```javascript
Promise.method(fn)        // Wrap function to return Promise
Promise.defer()           // Create deferred promise
Promise.delay(ms)         // Delay execution
```

### Async Process Tracking
```javascript
incrementAsyncProcesses(name)  // Start async task
decrementAsyncProcesses(name)  // Finish async task
// Translation completes when count reaches 0
```

### Translation Modes
- **Synchronous**: Traditional callback-based (legacy)
- **Asynchronous**: Promise-based (modern translators)
- **Hybrid**: Supports both in same translator

## Error Handling

### Error Types
- **Translation Errors**: Translator execution failures
- **HTTP Errors**: Network request failures (StatusError)
- **Item Errors**: Invalid item data
- **Timeout Errors**: Operation exceeded time limit

### Error Flow
```
Error Occurs ──> logError() ──> error handler ──> Translation fails
                                                 └> Retry next translator
```

## Preferences System (Zotero.Prefs)

Manages translator and translation settings:

```javascript
Zotero.Prefs = {
  get(pref),              // Get preference value
  set(pref, value),       // Set preference value

  // Common preferences
  "automaticSnapshots"    // Auto-save page snapshots
  "capitalizeTitles"      // Auto-capitalize titles
  "charset"               // Character encoding
}
```

## Debug and Logging (Zotero.Debug)

Comprehensive logging system:

```javascript
Zotero.debug(message, level)   // Log debug message
Zotero.logError(error)         // Log error with stack trace

// Debug levels
1 - Errors only
2 - Warnings
3 - Info
4 - Debug
5 - Trace
```

## Integration Points

### Browser/Connector Integration
- **detectWeb()** called on page load to check for translatable items
- Icon updated based on detected item type
- Save initiated by user action
- Progress feedback via handlers

### Standalone Application
- Translator editor (Scaffold)
- Batch translation
- Import/export functionality

### Server Integration
- Translation Server (REST API)
- Batch processing
- Remote translator execution

## Security Model

### Sandbox Restrictions
- No direct file system access
- No network access outside provided APIs
- No access to parent window/frame
- No `eval()` of untrusted code (only translator code)
- Limited DOM access

### API Exposure Control
- `__exposedProps__` defines accessible properties
- Translator-specific API subsets
- Request validation and sanitization

## Performance Optimizations

### Lazy Loading
- Translators loaded on-demand
- Code cached after first load
- Incremental translator discovery

### Indexing
- RDF triple indexing (subject, predicate, object, graph)
- Translator lookup by URL pattern
- Efficient statement matching

### Batching
- Batch item saves
- Queued HTTP requests
- Asynchronous processing pipeline

## Extension Points

### Custom Translators
- User-created translators
- Scaffold development tool
- Local translator override

### Custom Item Savers
- Implement `ItemSaver` interface
- Custom storage backends
- Export format handlers

### Custom Translator Providers
- `setTranslatorProvider()` for alternative sources
- Testing frameworks
- Development workflows

## Architecture Summary

Zotero's translation architecture is a sophisticated system built on these principles:

1. **Modularity**: Clear separation between translator types, utilities, and core systems
2. **Sandboxing**: Secure execution of untrusted translator code
3. **Extensibility**: Plugin architecture for translators, handlers, and providers
4. **Asynchronicity**: Full Promise support for modern async patterns
5. **Robustness**: Comprehensive error handling and fallback mechanisms
6. **Performance**: Lazy loading, indexing, and batching optimizations

The system processes millions of bibliographic items through its 600+ translators while maintaining security, performance, and extensibility.

## File Location

This architecture is implemented in:
- **Source**: `packages/core/src/utilities-translate-bundle.ts` (9,748 lines)
- **Generated**: Auto-generated from https://github.com/zotero/translate
- **License**: GNU Affero General Public License v3+
