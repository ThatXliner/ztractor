# ztractor-node

`ztractor-node` is the Node.js adapter for the browser-compatible
[`ztractor`](../core) package. It injects a Linkedom-based `DOMParser` and
HTML document parser, with XPath support provided by `@xmldom/xmldom` and
`xpath`. It runs the same pinned Zotero runtime and web translators as the
core package.

These docs describe a source checkout. Build the monorepo from the repository
root using the [root instructions](../../README.md), including its pinned
submodules. The generated runtime and translator sources are required for a
local build.

## Run a local build

After `bun run build`, from the repository root, save this as
`tmp-extract.mjs` and run it with `node tmp-extract.mjs` or
`bun tmp-extract.mjs`:

```js
import { extractMetadata } from './packages/node/dist/index.js';

const result = await extractMetadata({
  url: 'https://example.org/article',
  html: `<!doctype html>
    <html><head>
      <meta name="citation_title" content="Reliable evidence">
      <meta name="citation_author" content="Doe, Jane">
      <meta name="citation_publication_date" content="2024-02-03">
    </head><body><article>Article text.</article></body></html>`,
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

## API

The Node wrapper accepts the same URL string or options object as
`ztractor.extractMetadata`. The options object requires `url`; common inputs
are:

- `html`: captured static HTML, which skips the initial fetch.
- `document`: an already parsed DOM document, which also skips the initial
  fetch.
- `network`: `'allow'` by default, or `'deny'` to block the initial fetch
  and translator follow-up requests.
- `timeout`, `signal`, and `headers` for request and cancellation control.

Results have `success`. Successful results expose `items`; failures expose
`error`. Optional `translator`, `source`, and `diagnostics` fields
identify the selected translator or explain attempts. A translator that
reports multiple items produces a failure asking for an individual article
page. The adapter does not auto-select one.

See the [core package README](../core/README.md) and the actual [option and
result types](../core/src/types.ts) for shared API details.

## Runtime constraints

The Node adapter parses supplied HTML and does not execute page JavaScript. It
uses web translators only; bundled translator sources are not a validation
claim for every site or page shape. Allowing network access can also let a
translator make follow-up requests.

Translator/runtime code runs as trusted code in the Node process; `new
Function` does not provide filesystem isolation.

## Checks

From the repository root:

```sh
bun run --filter ztractor-node check
bun test
```

## License and upstream notices

This package is licensed under AGPL v3+, available in [LICENSE](../../LICENSE).
The pinned `translate` and `translators` submodules retain their upstream
Zotero runtime and translator notices.
