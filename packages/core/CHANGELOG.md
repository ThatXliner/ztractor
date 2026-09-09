# Changelog

## 2.0.1

Documentation-only patch release. The runtime and bundled translator files are
unchanged.

- Corrected the npm README links to point to the repository files on `main`.
- Documented `npm install ztractor` for the published browser package. It
  includes the prebuilt runtime and translator registry, so consumers do not
  need the source submodules or a local build.

## 2.0.0

Published on npm as `ztractor@2.0.0`.

### Runtime changes

- The primary `extractMetadata` API runs the pinned upstream Zotero translation
  runtime and bundled web translators through a compatibility layer.
- Supplied HTML or a DOM document can be processed without fetching the page.
  `network: 'deny'` also blocks translator follow-up requests. The default is
  still `network: 'allow'`.
- Extraction supports an abort signal, a timeout, and diagnostics for failed
  translator attempts. Embedded page metadata can provide a fallback.
- Multiple-item detection asks the caller to use an individual article page;
  it does not automatically select a result.

### Migrating from 1.0.0

The `extractMetadata(url)` and `extractMetadata(options)` call shapes remain,
as do the existing runtime export names. Review these changes before upgrading:

- **`browserSupport` is optional** on metadata returned by
  `parseTranslatorMetadata`. Guard it before using string methods:

  ```ts
  const support = metadata?.browserSupport ?? '';
  ```

- **`ItemType` adds `dataset`, `preprint`, and `standard`.** Update exhaustive
  switches and mappings that enumerate all item types.
- **Extraction behavior changes with the upstream runtime.** Recheck your
  site's fixtures and result handling. Translator availability does not
  guarantee support for every page or every offline extraction.
- **Browser hosts must permit the dynamically created runtime in an isolated
  context.** Card Cutter uses an extension manifest sandbox. Do not add
  `unsafe-eval` to privileged extension pages to accommodate the runtime.
- Use `extractMetadata` for new integrations. `executeDetectWeb` and
  `executeDoWeb` remain legacy compatibility helpers and do not provide the
  primary API's complete runtime or network-policy behavior.

`ztractor-node` remains a private workspace adapter. Only `ztractor` is
published in this release.
