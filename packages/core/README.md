# Ztractor

Ztractor runs the pinned upstream Zotero translation runtime against supplied HTML. It bundles the
translator sources in this repository; having a bundled translator does not mean every site, page
shape, or translator network dependency is supported or verified.

## Use this branch from source

The published `ztractor@1.0.0` package does not include this runtime extension. Build this branch
with its pinned `translate` and `translators` submodules instead:

```bash
git submodule update --init --recursive
cd packages/core
bun install
bun run build
```

This branch is intended for the next minor release. It does not publish to npm.

## Primary API

Supply page HTML and deny all network access when extraction must stay offline:

```typescript
import { extractMetadata } from 'ztractor';

const result = await extractMetadata({
  url: 'https://example.org/article',
  html: pageHTML,
  network: 'deny',
  timeout: 10_000,
  signal: abortController.signal,
});

if (result.success) console.log(result.items?.[0]);
```

`html: ''` and `document` are supplied page data and do not trigger an initial fetch. If neither is
provided, Ztractor fetches the initial URL. With `network: 'deny'`, that call is rejected before
fetching and translators cannot make follow-up requests. Results include `diagnostics` for failed
translators. A targeted translator that reports multiple items returns a failure asking for an
individual article page; Ztractor never auto-selects an item.

`ztractor-node` exposes the same API and supplies Linkedom-based DOM and XPath support for Node.js.

## Runtime requirements and limits

The upstream translator runtime is dynamically created from pinned sources. Browser deployments need
a CSP and isolated execution context that permit that runtime. Static HTML is parsed; page JavaScript
is not executed. Browser CORS can require fetching the page elsewhere before supplying its HTML. Some
translators need network access or features outside this runtime, so neither all-site support nor
request-free extraction is guaranteed when networking is allowed.

Only web translators are used for extraction. `executeDetectWeb()` and `executeDoWeb()` remain
exported as deprecated compatibility shims; new code should use `extractMetadata()`.

## License

AGPL v3+
