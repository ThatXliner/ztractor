# Ztractor

> Extract metadata from websites using Zotero's powerful collection of 600+ translators

Ztractor makes it easy to extract structured metadata (titles, authors, dates, etc.) from websites using [Zotero's translators](https://github.com/zotero/translators). This core package works in both browsers and Node.js environments.

## Installation

```bash
npm install ztractor
```

Or with bun:

```bash
bun add ztractor
```

## Quick Start

### Browser

```typescript
import { extractMetadata } from 'ztractor';

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

### Node.js

For Node.js environments, use the optimized `ztractor-node` package instead:

```bash
npm install ztractor-node
```

```typescript
import { extractMetadata } from 'ztractor-node';
// Same API as browser version
```

The Node.js version uses [linkedom](https://github.com/WebReflection/linkedom) for faster DOM parsing.

## Features

- **600+ translators** - Support for academic journals, news sites, blogs, and more
- **TypeScript-native** - Full type definitions for all metadata fields
- **Isomorphic** - Works in both browsers and Node.js
- **Zero config** - All translators bundled at build time
- **Lightweight** - Uses native DOM APIs in browsers

## API

### `extractMetadata(options)`

Extract metadata from a URL.

**Parameters:**

- `options`: `string | ExtractMetadataOptions`
  - If string: The URL to extract from
  - If object:
    - `url` (string, required): The URL to extract from
    - `html` (string, optional): Pre-fetched HTML content
    - `headers` (object, optional): Custom HTTP headers
    - `timeout` (number, optional): Timeout in milliseconds (default: 10000)

**Returns:** `Promise<ExtractMetadataResult>`

```typescript
interface ExtractMetadataResult {
  success: boolean;
  items?: ZoteroItem[];      // Extracted metadata
  error?: string;            // Error message if failed
  translator?: string;       // Name of translator used
}
```

### `findTranslators(url)`

Find all translators that can handle a URL.

```typescript
const translators = await findTranslators('https://www.nytimes.com');
// Returns array of matching translators with metadata
```

### `getAvailableTranslators()`

Get list of all available translators.

```typescript
const all = await getAvailableTranslators();
console.log(`${all.length} translators available`);
```

## Metadata Structure

Extracted items follow Zotero's metadata schema:

```typescript
interface ZoteroItem {
  itemType: string;          // "journalArticle", "book", "webpage", etc.
  title?: string;
  creators?: Creator[];      // Authors, editors, etc.
  abstractNote?: string;
  publicationTitle?: string; // Journal/publication name
  volume?: string;
  issue?: string;
  pages?: string;
  date?: string;             // ISO format
  DOI?: string;
  ISBN?: string;
  ISSN?: string;
  url?: string;
  tags?: Tag[];
  // ... and many more fields
}
```

## Supported Sites

Ztractor supports 600+ websites through Zotero translators, including:

**Academic:**
- ArXiv, PubMed, Google Scholar
- ScienceDirect, Springer, Wiley
- JSTOR, Project MUSE
- IEEE, ACM Digital Library

**News & Media:**
- New York Times, The Guardian, BBC
- CNN, Reuters, Associated Press
- Medium, Substack

**Reference:**
- Wikipedia, Encyclopedia Britannica
- Library catalogs worldwide

Check `getAvailableTranslators()` for the full list.

## Examples

### With pre-fetched HTML

```typescript
const html = await fetch('https://example.com').then(r => r.text());
const result = await extractMetadata({
  url: 'https://example.com',
  html,
});
```

### With custom headers

```typescript
const result = await extractMetadata({
  url: 'https://example.com/article',
  headers: {
    'User-Agent': 'MyApp/1.0',
  },
});
```

### Batch processing

```typescript
const urls = [
  'https://example.com/article1',
  'https://example.com/article2',
  'https://example.com/article3',
];

const results = await Promise.all(
  urls.map(url => extractMetadata({ url }))
);

results.forEach((result, i) => {
  if (result.success) {
    console.log(`${result.items[0].title}`);
  } else {
    console.log(`Failed: ${result.error}`);
  }
});
```

## Browser Compatibility

This package uses native browser APIs:
- `DOMParser` for HTML parsing
- `document.evaluate()` for XPath queries
- `fetch()` for HTTP requests

Supports all modern browsers (Chrome, Firefox, Safari, Edge).

## Limitations

- **Static HTML only**: Does not execute JavaScript on pages. Some sites with heavy client-side rendering may not work.
- **CORS restrictions**: When running in browsers, you may need to fetch HTML server-side due to CORS policies.
- **Web translators only**: Only supports web translators (type 4). Import/export translators are not included.

## License

MIT

## Credits

- [Zotero](https://www.zotero.org/) - For the amazing collection of translators
- Built with [Bun](https://bun.sh/)

## Related Projects

- [Zotero](https://www.zotero.org/) - Reference manager
- [translation-server](https://github.com/zotero/translation-server) - Official Zotero translation server
