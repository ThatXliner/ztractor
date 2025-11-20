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

## API

See the package-specific READMEs for detailed API documentation:
- [ztractor API docs](./packages/core/README.md#api)
- [ztractor-node API docs](./packages/node/README.md#api)

## Supported Sites

Ztractor supports 600+ websites including academic publishers (ArXiv, PubMed, JSTOR), news sites (NYT, Guardian, BBC), and many more. See the package READMEs for a complete list.

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

MIT - see [LICENSE](./LICENSE)

## Credits

- [Zotero](https://www.zotero.org/) - For the amazing translator collection
- [linkedom](https://github.com/WebReflection/linkedom) - Fast DOM implementation for Node.js
- Built with [Bun](https://bun.sh/)
