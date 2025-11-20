# Ztractor Node

> Node.js optimized version of Ztractor with linkedom for fast DOM parsing

Ztractor makes it easy to extract structured metadata (titles, authors, dates, etc.) from websites using [Zotero's translators](https://github.com/zotero/translators). This Node.js package uses [linkedom](https://github.com/WebReflection/linkedom) for fast, lightweight DOM parsing.

## Installation

```bash
npm install ztractor-node
```

Or with bun:

```bash
bun add ztractor-node
```

## Quick Start

```typescript
import { extractMetadata } from 'ztractor-node';

// Simple usage - just pass a URL
const result = await extractMetadata({
  url: 'https://www.nytimes.com/2024/01/15/technology/example.html',
});

if (result.success && result.items) {
  const item = result.items[0];
  console.log(item.title);        // Article title
  console.log(item.creators);     // Authors
  console.log(item.date);         // Publication date
  console.log(item.itemType);     // "newspaperArticle"
}
```

## Why Use ztractor-node?

This package is optimized for Node.js environments:

- **Fast DOM parsing** - Uses [linkedom](https://github.com/WebReflection/linkedom) instead of heavyweight alternatives
- **Decent XPath support** - Hybrid linkedom/@xmldom/xmldom implementation for XPath 1.0 (used by some Zotero Translators)
- **No browser required** - Pure Node.js implementation, no headless browser needed
- **Small footprint** - Lightweight compared to jsdom or puppeteer

For browser environments, use the `ztractor` package instead, which uses native browser APIs.

## API Reference

The API is identical to the core `ztractor` package. See the [core package README](../core/README.md) for complete documentation on:

- **API Functions**: `extractMetadata()`, `findTranslators()`, `getAvailableTranslators()`
- **Metadata Structure**: `ZoteroItem` interface, item types, creator types
- **Supported Sites**: Complete list of 600+ supported websites
- **Usage Examples**: News articles, academic papers, batch processing, etc.

### Node.js-Specific Example

```typescript
import { writeFile } from 'fs/promises';
import { extractMetadata } from 'ztractor-node';

const result = await extractMetadata('https://example.com/article');

if (result.success) {
  // Save metadata to file
  await writeFile('metadata.json', JSON.stringify(result.items, null, 2));
}
```

## Technical Details

### DOM Implementation

This package uses a hybrid DOM approach for optimal compatibility:

- **linkedom** - Main DOM implementation for queries and manipulation (fast and lightweight)
- **@xmldom/xmldom + xpath** - XPath evaluation engine
- Results automatically mapped between implementations

This provides full XPath 1.0 support including:
- Complex axes (following-sibling, ancestor, etc.)
- Predicates and filters
- Functions like `contains()`, `normalize-space()`

### Translator Execution

- Translators run in a sandboxed environment using `new Function()`
- No access to Node.js APIs or file system from translator code
- Full Zotero API surface implemented (`Zotero.Item`, `ZU` utilities, etc.)

## Limitations

As with the original Ztractor:
- **Static HTML only**: Does not execute JavaScript on pages. No headless browser.
- **Web translators only**: Currently only supports web translators (type 4). Import/export translators are not included.

## License

AGPL v3+

## Credits

- [Zotero](https://www.zotero.org/) - For the amazing collection of translators
- [linkedom](https://github.com/WebReflection/linkedom) - Fast DOM implementation
- Built with [Bun](https://bun.sh/)

## Related Projects

- [Zotero](https://www.zotero.org/) - Reference manager
- [translation-server](https://github.com/zotero/translation-server) - Official Zotero translation server
- [Citation.js](https://citation.js.org/) - Alternative citation library
