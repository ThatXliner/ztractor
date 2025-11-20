# Ztractor

> Extract metadata from websites using Zotero's powerful collection of 600+ translators

Ztractor makes it easy to extract structured metadata (titles, authors, dates, etc.) from websites using [Zotero's translators](https://github.com/zotero/translators). It provides a simple TypeScript/JavaScript API with all translators bundled at build time.

## Features

- **600+ translators** - Support for academic journals, news sites, blogs, and more
- **TypeScript-native** - Full type definitions for all metadata fields
- **Zero runtime dependencies** - All translators bundled at build time
- **Flexible API** - Pass URLs or pre-fetched HTML
- **Isomorphic** - Works in both Node.js and browsers
- **Lightweight** - Uses linkedom (Node) or native DOM (browser) for fast parsing
- **Built with Bun** - Fast builds and modern JavaScript runtime

## Installation

```bash
bun install ztractor
```

Or with npm:

```bash
npm install ztractor
```

## Quick Start

### Node.js / Bun

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

### Browser

Ztractor works in browsers too! Modern bundlers (Vite, Webpack, etc.) will automatically use the browser build via package.json exports.

```typescript
import { extractMetadata } from 'ztractor';

// Same API in the browser - uses native DOM APIs
const result = await extractMetadata({
  url: 'https://www.nytimes.com/2024/01/15/technology/example.html',
});

if (result.success && result.items) {
  console.log(result.items[0].title);
}
```

**Note:** Browser builds use native `DOMParser` and `document.evaluate()` for XPath, making them lighter and faster than the Node version. CORS restrictions apply when fetching URLs from the browser.

## API

### `extractMetadata(options)`

Extract metadata from a URL.

**Parameters:**

- `options`: `string | ExtractMetadataOptions`
  - If string: The URL to extract from (HTML will be fetched automatically)
  - If object:
    - `url` (string, required): The URL to extract from
    - `html` (string, optional): Pre-fetched HTML content
    - `headers` (object, optional): Custom HTTP headers for fetching
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

**Examples:**

```typescript
// Basic usage - URL only
const result = await extractMetadata('https://example.com/article');

// With options
const result = await extractMetadata({
  url: 'https://example.com/article',
  timeout: 5000,
  headers: {
    'User-Agent': 'MyApp/1.0',
  },
});

// With pre-fetched HTML
const html = await fetch('https://example.com').then(r => r.text());
const result = await extractMetadata({
  url: 'https://example.com',
  html,
});
```

### `findTranslators(url)`

Find translators that match a URL.

```typescript
const translators = await findTranslators('https://www.nytimes.com');
// Returns array of matching translators with their metadata
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

### Item Types

Supported item types include:

- `journalArticle` - Academic journal articles
- `newspaperArticle` - News articles
- `blogPost` - Blog posts
- `webpage` - Generic web pages
- `book` - Books
- `videoRecording` - Videos
- `podcast` - Podcasts
- And 30+ more types

### Creator Types

Creators can have different roles:

```typescript
interface Creator {
  firstName?: string;
  lastName?: string;
  name?: string;           // For single-field names
  creatorType: string;     // "author", "editor", "translator", etc.
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

**And many more!** Check `getAvailableTranslators()` for the full list.

## Examples

### Extract from a news article

```typescript
const result = await extractMetadata({
  url: 'https://www.nytimes.com/2024/01/15/technology/ai-advances.html',
});

if (result.success) {
  const article = result.items[0];
  console.log(`Title: ${article.title}`);
  console.log(`Authors: ${article.creators.map(c => `${c.firstName} ${c.lastName}`).join(', ')}`);
  console.log(`Date: ${article.date}`);
  console.log(`Publication: ${article.publicationTitle}`);
}
```

### Extract from an academic paper

```typescript
const result = await extractMetadata({
  url: 'https://arxiv.org/abs/2401.12345',
});

if (result.success) {
  const paper = result.items[0];
  console.log(`Title: ${paper.title}`);
  console.log(`Abstract: ${paper.abstractNote}`);
  console.log(`Authors: ${paper.creators.map(c => c.lastName).join(', ')}`);
}
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
    console.log(`✅ ${result.items[0].title}`);
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
});
```

### Export to JSON

```typescript
const result = await extractMetadata('https://example.com/article');

if (result.success) {
  // Save metadata to file
  await Bun.write('metadata.json', JSON.stringify(result.items, null, 2));
}
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ztractor.git
cd ztractor

# Initialize submodules (downloads Zotero translators)
git submodule update --init

# Install dependencies
bun install

# Build the project
bun run build
```

### Testing

```bash
bun test
```

### Project Structure

```
ztractor/
├── src/
│   ├── index.ts              # Node.js API
│   ├── index.browser.ts      # Browser API
│   ├── types.ts              # TypeScript definitions
│   ├── item.ts               # Zotero.Item class
│   ├── utilities.ts          # Zotero Utilities (ZU)
│   ├── executor.ts           # Node translator executor (uses linkedom)
│   ├── executor.browser.ts   # Browser translator executor (uses native DOM)
│   ├── translator-loader.ts  # Translator loading and matching
│   └── translators-registry.ts # Auto-generated translator registry
├── build/
│   └── bundle-translators.ts # Build script
├── translators/              # Git submodule (Zotero translators)
└── examples/                 # Usage examples
```

### How It Works

1. **Build time**: The `bundle-translators.ts` script scans all translator files in the `translators/` directory, parses their metadata, and generates a registry
2. **Runtime**: When you call `extractMetadata()`:
   - It matches the URL against translator patterns
   - Loads the matching translator code
   - Executes it in a sandboxed environment with DOM and Zotero APIs
   - Returns structured metadata

## Limitations

- **Static HTML only**: Does not execute JavaScript on pages (no headless browser). Some sites that heavily rely on client-side rendering may not work.
- **Web translators only**: Currently only supports web translators (type 4). Import/export translators are not included.
- **Async handling**: Some complex translators that fetch multiple pages may not work perfectly.
- **Browser CORS**: When running in browsers, CORS restrictions apply. You may need to fetch HTML server-side and pass it to `extractMetadata()`.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

To add support for a new website:
1. Create a translator using [Zotero Scaffold](https://www.zotero.org/support/dev/translators)
2. Submit it to the [Zotero translators repository](https://github.com/zotero/translators)
3. Update the translators submodule in this repo

## License

MIT

## Credits

- [Zotero](https://www.zotero.org/) - For the amazing collection of translators
- [linkedom](https://github.com/WebReflection/linkedom) - Fast DOM implementation
- Built with [Bun](https://bun.sh/)

## Related Projects

- [Zotero](https://www.zotero.org/) - Reference manager
- [Zotero Connectors](https://github.com/zotero/zotero-connectors) - Browser extensions
- [translation-server](https://github.com/zotero/translation-server) - Official Zotero translation server
- [Citation.js](https://citation.js.org/) - Alternative citation library
