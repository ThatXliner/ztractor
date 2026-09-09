# Ztractor

Ztractor is a TypeScript adapter around the pinned upstream Zotero translation
runtime and its handwritten web translators. Use Zotero's site-specific
extraction logic through one TypeScript API against a URL, captured HTML, or a
DOM document.

Browser consumers can install the published core package from npm:

```sh
npm install ztractor
```

The package ships the prebuilt runtime and translator registry, so browser
consumers do not need the pinned submodules or a source build.

## How the pieces fit

A caller supplies a URL plus page HTML or a document. Ztractor chooses matching
bundled web translators, runs them in the compatibility runtime, and returns
Zotero-shaped items plus diagnostics. `network: 'deny'` keeps both the initial
fetch and translator follow-up requests out of that call; the default is
`network: 'allow'`.

[Card Cutter](https://github.com/ThatXliner/cardcutter) consumes the
published `ztractor` v2 package from npm. It captures the open page HTML in the
browser and passes it to Ztractor, so metadata extraction does not refetch the
publisher during capture.

## Packages

| Package | Role |
| --- | --- |
| [`ztractor`](./packages/core) | Browser-compatible core using the DOM APIs supplied by its host. |
| [`ztractor-node`](./packages/node) | Private workspace Node wrapper injecting Linkedom DOM parsing and XPath support from `@xmldom/xmldom` and `xpath`; not published to npm. |

## Build from source

Clone the repository with both pinned upstream submodules, then build from the
repository root:

```sh
git clone --recurse-submodules https://github.com/ThatXliner/ztractor.git
cd ztractor
git submodule update --init --recursive
bun install
bun run build
```

The build generates the runtime and translator registry used by both packages.
The private `ztractor-node` workspace requires this local build for the Node and
Bun example below. Card Cutter consumes the published `ztractor` v2 package
from npm. Bun 1.3.14 matches the validated toolchain.

## Run a local Node or Bun example

After `bun run build`, from the repository root, save the following as
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

`extractMetadata` accepts a URL string or an options object. The options
object requires `url`; common inputs are:

- `html`: captured static HTML, which avoids the initial fetch.
- `document`: an already parsed DOM document, which also avoids the initial
  fetch.
- `network`: `'allow'` by default, or `'deny'` to block the initial fetch
  and translator follow-up requests.
- `timeout`, `signal`, and `headers` for request and cancellation control.

Every result has `success`. Successful results expose `items`, with
`translator`, `source`, and optional `diagnostics` when available. Failed
results expose `error` and may include `diagnostics` describing translator
attempts. If a translator reports multiple items, the result asks the caller
to open an individual article page; Ztractor does not auto-select one.

See the [core package README](./packages/core/README.md), [Node package
README](./packages/node/README.md), and the actual [option and result types](./packages/core/src/types.ts).

## Runtime constraints

Static HTML is parsed as supplied; page JavaScript is not executed. Extraction
uses web translators; import/export translation is outside this API. A bundled
translator source is available locally, but that does not mean every site has
been validated or that every translator will work without network access.

The runtime is created dynamically. Browser consumers need an isolated
execution context and a CSP that permits locally trusted runtime code. Card
Cutter keeps it in the extension manifest sandbox rather than granting
`unsafe-eval` to privileged extension pages. Translator and runtime code runs
as trusted code in the Node process; `new Function` does not provide
filesystem isolation.

## Checks

```sh
bun test
bun run --filter ztractor check
bun run --filter ztractor-node check
```

## Releases

Maintainers: see [RELEASING.md](./RELEASING.md) for the core-only npm release
procedure and [the 2.0 migration notes](./packages/core/CHANGELOG.md).

## License and upstream notices

Ztractor is licensed under AGPL v3+, available in [LICENSE](./LICENSE). The
`packages/core/translate` and `packages/core/translators` submodules retain
the upstream Zotero runtime and translator notices.
