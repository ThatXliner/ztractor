# Ztractor

Ztractor runs the pinned Zotero translation runtime against supplied page HTML.
It is a source branch for the next minor release; the published 1.0.0 npm
packages do not include this runtime extension.

## Build from source

Clone with the upstream runtime and translator submodules, then build from the
repository root:

```sh
git clone --recurse-submodules https://github.com/ThatXliner/ztractor.git
cd ztractor
git submodule update --init --recursive
bun install
bun run build
```

Run `bun test` for the test suite. The packages are [core](./packages/core) for
browser-compatible extraction and [node](./packages/node) for Linkedom-backed
Node.js extraction. [Card Cutter](https://github.com/ThatXliner/cardcutter)
uses the core package from this checkout.

## API and limits

Pass captured HTML with `network: 'deny'` to keep extraction local:

```ts
import { extractMetadata } from 'ztractor';

const result = await extractMetadata({
  url: 'https://example.org/article',
  html: pageHTML,
  network: 'deny',
  timeout: 10_000,
});
```

When supplied, `html` is parsed as static page data and page JavaScript is not
executed. With `network: 'deny'`, Ztractor rejects an initial fetch and blocks
translator follow-up requests. Results can include diagnostics. Some sites and
translators require networking or unsupported runtime features, so coverage is
not guaranteed. See the [core README](./packages/core/README.md) for the full
API and runtime constraints.

## License

AGPL v3+ — see [LICENSE](./LICENSE). Upstream Zotero notices remain with the
bundled runtime and translator source.
