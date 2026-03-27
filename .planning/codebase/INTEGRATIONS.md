# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**Zotero Translator Repository (Optional):**
- Service: Zotero Official Translator Repository
- What it's used for: Optional runtime retrieval of translator code and metadata
- SDK/Client: HTTPRegistry class in `src/registry.ts`
- Endpoint: `https://www.zotero.org/repo/` (ZOTERO_CONFIG.REPOSITORY_URL)
  - `/metadata` - Retrieve translator metadata with optional timestamp filter
  - `/code/{translatorId}` - Retrieve specific translator code
- Integration: Opt-in via HTTPRegistry; default uses BundledRegistry instead
- No authentication required - public API

**Crossref API (Embedded in Translators):**
- Service: Crossref REST API (referenced in bundled translator utilities)
- Configuration location: `src/utilities-translate-bundle.ts` line mentions `CrossrefREST.email`
- Note: Configuration hook present but not wired in core; available to translators that use it
- No default API key configured

**HTTP/HTTPS Requests (Generic):**
- Service: External websites being scraped
- Mechanism: Fetch API in browser, Node.js fetch in packages/node
- User-Agent: "Mozilla/5.0 (compatible; Ztractor/1.0; +https://github.com/ThatXliner/ztractor)"
- Timeout: 30 seconds (configurable via ExtractMetadataOptions.timeout)
- Implementation: `src/index.ts` lines 91-97

## Data Storage

**Databases:**
- None - Ztractor is a stateless extraction library, no database integration

**File Storage:**
- None - No persistent file storage or caching

**Caching:**
- Optional HTTP caching in HTTPRegistry (marked TODO)
- Location: `src/registry.ts` line 58 - "// TODO: cache"
- Not currently implemented

**In-Memory State:**
- BundledRegistry lazy-loads translator registry on first access
- Cached in `_TRANSLATORS_REGISTRY` property
- Contains ~685 web translators with code strings

## Authentication & Identity

**Auth Provider:**
- None - No user authentication or identity system
- Zotero translator repository endpoints are unauthenticated (public API)

**API Keys:**
- Not required for core functionality
- Optional configuration: Crossref email (for translator requests) - not enforced
- Translators may require API keys for their target websites (embedded in translator code)

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking integration

**Logs:**
- Conditional debug logging via DEBUG_TRANSLATORS environment variable
- Implementation: Translator execution logs written to console
- Set `DEBUG_TRANSLATORS=1` to enable translator debug output

**Debugging Support:**
- Source mapping in sandbox execution for error location tracking
- `src/translator-system-modern.ts` addSourceMapping() - embeds sourceURL comments

## CI/CD & Deployment

**Hosting:**
- None - Ztractor is a library package published to npm
- Consumption: Imported as dependency in applications

**CI Pipeline:**
- None detected - No GitHub Actions or other CI configuration

**Publishing:**
- npm package: https://www.npmjs.com/package/ztractor
- npm package: https://www.npmjs.com/package/ztractor-node
- Both packages configured with proper exports and type definitions

## Environment Configuration

**No required environment variables** - Ztractor works with sensible defaults

**Optional configuration:**

1. **Fetch headers** - Custom HTTP headers via ExtractMetadataOptions.headers
   - Default User-Agent: "Mozilla/5.0 (compatible; Ztractor/1.0; +https://github.com/ThatXliner/ztractor)"

2. **Timeout** - Request timeout in milliseconds
   - Default: 30000 (30 seconds)
   - Configurable: `extractMetadata({ timeout: 60000 })`

3. **Registry** - Choose translator source
   - BundledRegistry (default) - Use bundled translator code
   - HTTPRegistry (optional) - Fetch translators from Zotero repository at runtime

4. **Dependencies injection** - Custom DOM parser and HTML parser
   - Node.js injects linkedom + xmldom implementation
   - Browser uses native DOMParser and document.evaluate

**Secrets location:**
- None - No secrets required (public API consumption)

## Webhooks & Callbacks

**Incoming:**
- None - Ztractor is pull-only (client calls extractMetadata)

**Outgoing:**
- None - Ztractor does not send data to external services
- Translators may make HTTP requests to target websites (normal web scraping)

## Translator Execution Model

**How Translators Communicate:**
- Translators execute in isolated sandbox: `src/translator-system-modern.ts`
- Sandbox provides Zotero API via injected globals:
  - `Zotero.Item()` - Create metadata items
  - `Zotero.Utilities.request()` - HTTP requests
  - `ZU` utilities - DOM helpers, text processing, date parsing
- Item completion callback collects extracted data
- No external communication beyond HTTP requests made by translators

## Git Submodules (Build-Time Dependencies)

**Zotero Translators Repository:**
- Path: `packages/core/translators/`
- Source: https://github.com/zotero/translators
- When needed: Required for build to include translator code
- Init: `git submodule update --init`
- Update: `cd packages/core/translators && git pull origin master`

**Zotero Translate Repository:**
- Path: `packages/core/translate/`
- Source: https://github.com/zotero/translate
- When needed: Required for build to bundle utilities
- Init: `git submodule update --init`
- Utilities bundled at build time into single module

---

*Integration audit: 2026-03-26*
