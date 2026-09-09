# ztractor

`ztractor` is the browser-compatible package in this repository. It runs the
pinned Zotero translation runtime and bundled web translators against a URL,
captured HTML, or an already parsed DOM document.

Install the published package with:

```sh
npm install ztractor
```

Version 2.0.0 is published on npm. The package ships the prebuilt runtime and
translator registry, so browser consumers do not need the pinned submodules or
a source build.

For a source checkout, follow the [root build
instructions](https://github.com/ThatXliner/ztractor/blob/main/README.md) to
initialize the pinned submodules and generate the runtime and translator
registry before importing a local build. See the [migration
notes](https://github.com/ThatXliner/ztractor/blob/main/packages/core/CHANGELOG.md)
for changes from 1.0.0.

## Primary API

In a browser or extension context with `DOMParser` available:

```ts
import { extractMetadata } from 'ztractor';

const url = 'https://example.org/article';
const pageHTML = `<!doctype html>
  <html><head>
    <meta name="citation_title" content="Reliable evidence">
    <meta name="citation_author" content="Doe, Jane">
    <meta name="citation_publication_date" content="2024-02-03">
  </head><body><article>Article text.</article></body></html>`;

const result = await extractMetadata({
  url,
  html: pageHTML,
  network: 'deny',
  timeout: 10_000,
});

if (result.success) {
  console.log(result.items);
} else {
  console.error(result.error);
  console.error(result.diagnostics);
}
```

`extractMetadata` accepts a URL string or an options object. The object
requires `url`. The commonly used options are:

- `html`: supplied static HTML, which skips the initial fetch.
- `document`: an already parsed document, which also skips the initial fetch.
- `network`: `'allow'` by default, or `'deny'` to block the initial fetch
  and translator follow-up requests.
- `headers`, `timeout`, and `signal` for fetch and cancellation control.

Results have `success`. A successful result exposes `items`; a failed result
exposes `error`. `translator`, `source`, and `diagnostics` are optional
fields described by the [source types](https://github.com/ThatXliner/ztractor/blob/main/packages/core/src/types.ts). When a translator
reports multiple items, the result asks the caller to open an individual
article page. Ztractor does not auto-select one.

The entry point also exposes translator discovery and compatibility helpers.
See [src/index.ts](https://github.com/ThatXliner/ztractor/blob/main/packages/core/src/index.ts) for the current exports.

## Runtime constraints

Static HTML is parsed as supplied; page JavaScript is not executed. Extraction
uses web translators; import/export translation is outside this API. A bundled
translator source is available locally, but that does not mean every site has
been validated or that every translator works without network access.

The runtime is created dynamically. Browser consumers need an isolated
execution context and a CSP that permits locally trusted runtime code. Card
Cutter keeps this code in its extension manifest sandbox rather than granting
`unsafe-eval` to privileged extension pages.

## Checks

From the repository root:

```sh
bun run --filter ztractor check
bun test
```

## License and upstream notices

This package is licensed under AGPL v3+, available in [LICENSE](https://github.com/ThatXliner/ztractor/blob/main/LICENSE).
The pinned `translate` and `translators` submodules retain their upstream
Zotero runtime and translator notices.
