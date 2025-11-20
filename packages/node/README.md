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

## Features

- **600+ translators** - Support for academic journals, news sites, blogs, and more
- **TypeScript-native** - Full type definitions for all metadata fields
- **Zero config** - All translators bundled at build time
- **Fast** - linkedom provides excellent performance
- **XPath 1.0** - Full support for complex XPath queries

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
    console.log(`${result.items[0].title}`);
  } else {
    console.log(`Failed: ${result.error}`);
  }
});
```

### Export to JSON

```typescript
import { writeFile } from 'fs/promises';

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

- **Static HTML only**: Does not execute JavaScript on pages. No headless browser.
- **Web translators only**: Currently only supports web translators (type 4). Import/export translators are not included.
- **Async handling**: Some complex translators that fetch multiple pages may not work perfectly.

## Performance

Benchmarks show linkedom is significantly faster than alternatives:

- ~10x faster than jsdom for typical scraping tasks
- No browser overhead like puppeteer/playwright
- Small memory footprint

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
