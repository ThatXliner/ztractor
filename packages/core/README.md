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

const result = await extractMetadata({
  url: 'https://arxiv.org/abs/2303.08774',
});

if (result.success) {
  const item = result.items[0];
  console.log(item.itemType);  // "preprint"
  console.log(item.title);     // "GPT-4 Technical Report"
  console.log(item.creators);  // [{ firstName: "Josh", lastName: "Achiam", creatorType: "author" }, ...]
  console.log(item.date);      // "2024-03-04"
  console.log(item.DOI);       // "10.48550/arXiv.2303.08774"
}
```

### Node.js

For Node.js environments, use the optimized `ztractor-node` package instead:

```bash
bun add ztractor-node
```

```typescript
import { extractMetadata } from 'ztractor-node';
// API is identical to the browser version
```

## Features

- **600+ translators** - Support for academic journals, news sites, blogs, and more
- **TypeScript-native** - Full type definitions for all metadata fields
- **Isomorphic** - Works in both browsers and Node.js
- **Zero config** - All translators bundled at build time
- **Lightweight** - Uses native DOM APIs in browsers

## API

See the [repository](https://github.com/ThatXliner/ztractor#API) for details

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

AGPL v3+

## Credits

- [Zotero](https://www.zotero.org/) - For the amazing collection of translators
- Built with [Bun](https://bun.sh/)

## Related Projects

- [Zotero](https://www.zotero.org/) - Reference manager
- [translation-server](https://github.com/zotero/translation-server) - Official Zotero translation server
