# Browser Usage Example

This guide shows how to use Ztractor in web browsers.

## Setup with a Bundler

### Using Vite

1. Install Ztractor:
```bash
npm install ztractor
```

2. Create your app:
```typescript
// main.ts
import { extractMetadata } from 'ztractor';

async function extract() {
  // Note: Due to CORS, you may need to proxy requests through your server
  const result = await extractMetadata({
    url: 'https://arxiv.org/abs/1706.03762',
  });

  if (result.success) {
    console.log('Title:', result.items[0].title);
    console.log('Authors:', result.items[0].creators);
  }
}

extract();
```

3. The bundler will automatically use the browser build via package.json exports!

### Using Webpack

Same approach - just import and the browser build is used automatically:

```javascript
import { extractMetadata } from 'ztractor';

// Works in browser!
const result = await extractMetadata({
  url: 'https://example.com',
  html: document.documentElement.outerHTML, // Can use current page HTML
});
```

## Direct Browser Usage

You can also use the browser build directly without a bundler by building it first:

```bash
cd node_modules/ztractor
bun run build:browser
```

Then in your HTML:

```html
<script type="module">
  import { extractMetadata } from './node_modules/ztractor/dist/browser.js';

  const result = await extractMetadata({
    url: 'https://arxiv.org/abs/1706.03762',
  });

  console.log(result);
</script>
```

## Handling CORS

Browsers enforce CORS, which means you can't fetch arbitrary URLs directly. Solutions:

### Option 1: Proxy through your server

```typescript
// Fetch HTML server-side to avoid CORS
const html = await fetch('/api/proxy?url=' + encodeURIComponent(targetUrl))
  .then(r => r.text());

const result = await extractMetadata({
  url: targetUrl,
  html, // Use pre-fetched HTML
});
```

### Option 2: Browser Extension

Browser extensions have special permissions to bypass CORS. This is how Zotero Connector works!

```typescript
// In a browser extension with host permissions
const result = await extractMetadata({
  url: 'https://example.com',
});
```

### Option 3: Same-origin pages

If you control the page, you can extract from the current page:

```typescript
// Extract metadata from current page
const result = await extractMetadata({
  url: window.location.href,
  html: document.documentElement.outerHTML,
});
```

## Bundle Size

The browser build is approximately **8.2 MB** (uncompressed) because it includes all 682 translators.

To reduce bundle size:
- Use code splitting to load only when needed
- Consider building a custom version with only translators you need
- Use compression (gzip/brotli) - the bundle compresses well due to repetitive code patterns

Example with dynamic import:

```typescript
// Only load Ztractor when needed
async function extractWhenNeeded(url: string) {
  const { extractMetadata } = await import('ztractor');
  return extractMetadata({ url });
}
```

## Browser Compatibility

Ztractor browser build requires:
- **ES Modules** support (all modern browsers)
- **Native `DOMParser`** (all browsers)
- **Native XPath** via `document.evaluate()` (all browsers)
- **`fetch()` API** (all modern browsers)
- **`AbortSignal.timeout()`** (modern browsers, or polyfill for older ones)

Supports:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 15+
- ✅ All modern mobile browsers

## Testing

See `examples/browser-test.html` for a complete working example you can open in a browser.

## Differences from Node.js Version

| Feature | Node.js | Browser |
|---------|---------|---------|
| DOM Parsing | linkedom library | Native DOMParser |
| XPath | xmldom + xpath library | Native document.evaluate() |
| Bundle Size | 8.8 MB | 8.2 MB |
| CORS | No restrictions | Browser restrictions apply |
| Debug mode | `process.env.DEBUG_TRANSLATORS` | Not available (use console) |

Both versions have the exact same API surface!
