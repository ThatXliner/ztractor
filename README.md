# Ztractor

> Extract metadata from websites using Zotero's powerful collection of 600+ translators

Ztractor makes it easy to extract structured metadata (titles, authors, dates, etc.) from websites using [Zotero's translators](https://github.com/zotero/translators). It provides a simple TypeScript/JavaScript API with all translators bundled at build time.

## Packages

This is a monorepo containing two packages:

- **[ztractor](./packages/core)** - Core package for browsers and Node.js
- **[ztractor-node](./packages/node)** - Node.js optimized version with linkedom for faster DOM parsing

## Installation

**For browsers or universal use:**
```bash
npm install ztractor
```

**For Node.js (recommended for server-side):**
```bash
npm install ztractor-node
```

## Quick Start

```typescript
import { extractMetadata } from 'ztractor';
// or: import { extractMetadata } from 'ztractor-node';

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

## Features

- **600+ translators** - Support for academic journals, news sites, blogs, and more
- **TypeScript-native** - Full type definitions for all metadata fields
- **Zero config** - All translators bundled at build time
- **Flexible API** - Pass URLs or pre-fetched HTML
- **Isomorphic** - Works in both Node.js and browsers
- **Lightweight** - Fast DOM parsing with native APIs or linkedom

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

## Development

```bash
# Clone the repository
git clone https://github.com/ThatXliner/ztractor.git
cd ztractor

# Initialize submodules (downloads Zotero translators)
git submodule update --init

# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test
```

See [CLAUDE.md](./CLAUDE.md) for detailed development documentation.

## Contributing

Contributions welcome! Please submit issues or pull requests.

## License

AGPL v3+ - see [LICENSE](./LICENSE)

## Credits

- [Zotero](https://www.zotero.org/) - For the amazing translator collection
- [linkedom](https://github.com/WebReflection/linkedom) - Fast DOM implementation for Node.js
- Built with [Bun](https://bun.sh/)
