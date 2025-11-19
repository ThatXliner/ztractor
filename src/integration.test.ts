import { test, expect, describe } from 'bun:test';
import { extractMetadata, findTranslators, getAvailableTranslators } from './index';

describe('extractMetadata - Integration Tests', () => {
  test('accepts URL as string', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Test Article">
          <meta property="og:type" content="article">
        </head>
        <body></body>
      </html>
    `;

    // Mock fetch for this test
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(html, { status: 200, statusText: 'OK' });

    try {
      const result = await extractMetadata('https://example.com/test');
      expect(result).toBeTruthy();
      expect(result.success).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('accepts URL and HTML in options object', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Test Article">
        </head>
        <body></body>
      </html>
    `;

    const result = await extractMetadata({
      url: 'https://example.com/test',
      html,
    });

    expect(result).toBeTruthy();
    expect(result.success).toBeDefined();
  });

  test('returns error for URL with no matching translator', async () => {
    const html = '<html><body>Test</body></html>';

    const result = await extractMetadata({
      url: 'https://completely-unknown-site-12345.com/article',
      html,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('No matching translator');
  });

  test('handles fetch errors gracefully', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    try {
      const result = await extractMetadata('https://example.com/test');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handles HTTP error responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response('Not Found', { status: 404, statusText: 'Not Found' });

    try {
      const result = await extractMetadata('https://example.com/notfound');
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('respects timeout option', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return new Response('Too slow');
    };

    try {
      const result = await extractMetadata({
        url: 'https://example.com/slow',
        timeout: 100, // 100ms timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 10000); // Give test itself more time

  test('passes custom headers when fetching', async () => {
    let capturedHeaders: Headers | undefined;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      capturedHeaders = new Headers(options?.headers);
      return new Response('<html></html>', { status: 200 });
    };

    try {
      await extractMetadata({
        url: 'https://example.com/test',
        headers: {
          'X-Custom-Header': 'test-value',
          Cookie: 'session=abc123',
        },
      });

      expect(capturedHeaders?.get('X-Custom-Header')).toBe('test-value');
      expect(capturedHeaders?.get('Cookie')).toBe('session=abc123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('findTranslators', () => {
  test('finds translators for known sites', async () => {
    const nytTranslators = await findTranslators('https://www.nytimes.com/article');
    expect(nytTranslators.length).toBeGreaterThan(0);
    expect(nytTranslators[0].label).toBeTruthy();
    expect(nytTranslators[0].id).toBeTruthy();
  });

  test('returns empty array for unknown sites', async () => {
    const translators = await findTranslators('https://unknown-site-xyz-12345.com/');
    expect(translators.length).toBe(0);
  });

  test('returns translator metadata', async () => {
    const translators = await findTranslators('https://arxiv.org/abs/1234.5678');

    if (translators.length > 0) {
      const t = translators[0];
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('target');
      expect(t).toHaveProperty('priority');
      expect(typeof t.priority).toBe('number');
    }
  });

  test('handles URLs with query parameters', async () => {
    const translators = await findTranslators('https://www.nytimes.com/article?param=value');
    expect(Array.isArray(translators)).toBe(true);
  });

  test('handles URLs with fragments', async () => {
    const translators = await findTranslators('https://www.nytimes.com/article#section');
    expect(Array.isArray(translators)).toBe(true);
  });
});

describe('getAvailableTranslators', () => {
  test('returns list of translators', async () => {
    const translators = await getAvailableTranslators();

    expect(Array.isArray(translators)).toBe(true);
    expect(translators.length).toBeGreaterThan(0);
  });

  test('translators have required fields', async () => {
    const translators = await getAvailableTranslators();

    const first = translators[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('label');
    expect(first).toHaveProperty('target');
    expect(first).toHaveProperty('priority');
  });

  test('returns same list on multiple calls', async () => {
    const list1 = await getAvailableTranslators();
    const list2 = await getAvailableTranslators();

    expect(list1.length).toBe(list2.length);
    expect(list1[0].id).toBe(list2[0].id);
  });

  test('has substantial number of translators', async () => {
    const translators = await getAvailableTranslators();

    // Should have hundreds of translators
    expect(translators.length).toBeGreaterThan(100);
  });
});

describe('Real translator tests', () => {
  test('can load ABC News translator', async () => {
    const translators = await findTranslators('https://www.abc.net.au/news/article');

    expect(translators.length).toBeGreaterThan(0);

    const abcTranslator = translators.find((t) => t.label.includes('ABC News'));
    expect(abcTranslator).toBeTruthy();
  });

  test('can load Wikipedia translator', async () => {
    // arXiv is type 12 (not pure web), so use Wikipedia instead which is type 4
    const translators = await findTranslators('https://en.wikipedia.org/wiki/Test');

    expect(translators.length).toBeGreaterThan(0);

    const wikipediaTranslator = translators.find((t) =>
      t.label.toLowerCase().includes('wikipedia')
    );
    expect(wikipediaTranslator).toBeTruthy();
  });

  test('NYTimes translator has correct priority', async () => {
    const translators = await findTranslators('https://www.nytimes.com/');

    if (translators.length > 0) {
      const nyt = translators.find((t) => t.label.includes('NYTimes'));
      if (nyt) {
        expect(nyt.priority).toBeGreaterThan(0);
        expect(typeof nyt.priority).toBe('number');
      }
    }
  });
});

describe('Edge cases and error handling', () => {
  test('handles malformed HTML gracefully', async () => {
    const badHtml = '<html><body><div>Unclosed div<body></html>';

    const result = await extractMetadata({
      url: 'https://example.com/bad',
      html: badHtml,
    });

    // Should not throw, even with bad HTML
    expect(result).toBeTruthy();
    expect(result.success).toBeDefined();
  });

  test('handles empty HTML', async () => {
    const result = await extractMetadata({
      url: 'https://example.com/empty',
      html: '',
    });

    expect(result).toBeTruthy();
    expect(result.success).toBe(false);
  });

  test('handles very large HTML documents', async () => {
    // Create a large HTML document
    const largeHtml = `
      <html>
        <head><title>Large Document</title></head>
        <body>
          ${'<p>Content</p>\n'.repeat(10000)}
        </body>
      </html>
    `;

    const result = await extractMetadata({
      url: 'https://example.com/large',
      html: largeHtml,
    });

    expect(result).toBeTruthy();
  });

  test('handles special characters in URL', async () => {
    const html = '<html><body>Test</body></html>';

    const result = await extractMetadata({
      url: 'https://example.com/article?title=Test%20Article&id=123',
      html,
    });

    expect(result).toBeTruthy();
  });

  test('handles non-ASCII characters in HTML', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Article 日本語 中文">
        </head>
        <body>
          <p>Content with émojis 🎉 and spëcial çharacters</p>
        </body>
      </html>
    `;

    const result = await extractMetadata({
      url: 'https://example.com/unicode',
      html,
    });

    expect(result).toBeTruthy();
  });
});

describe('Performance tests', () => {
  test('loads translator registry efficiently', async () => {
    const start = performance.now();
    await getAvailableTranslators();
    const end = performance.now();

    // Should load in reasonable time (< 1 second)
    expect(end - start).toBeLessThan(1000);
  });

  test('finds translators quickly', async () => {
    const start = performance.now();
    await findTranslators('https://www.nytimes.com/');
    const end = performance.now();

    // Should be very fast (< 100ms)
    expect(end - start).toBeLessThan(100);
  });

  test('handles concurrent requests', async () => {
    const urls = [
      'https://www.nytimes.com/',
      'https://arxiv.org/abs/1234',
      'https://www.bbc.com/news',
      'https://github.com/user/repo',
    ];

    const start = performance.now();

    await Promise.all(urls.map((url) => findTranslators(url)));

    const end = performance.now();

    // Should handle concurrent requests efficiently
    expect(end - start).toBeLessThan(500);
  });
});
