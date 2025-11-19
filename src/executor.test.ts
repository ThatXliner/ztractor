import { test, expect, describe } from 'bun:test';
import { parseHTMLDocument, executeDetectWeb, executeDoWeb } from './executor';
import type { Translator } from './types';

const simpleTranslator: Translator = {
  metadata: {
    translatorID: 'test-simple',
    label: 'Simple Test Translator',
    creator: 'Test',
    target: '^https://example\\.com',
    minVersion: '3.0',
    maxVersion: '',
    priority: 100,
    inRepository: true,
    translatorType: 4,
    browserSupport: 'gcsibv',
    lastUpdated: '2024-01-01',
  },
  code: `
function detectWeb(doc, url) {
  if (url.includes('/article/')) {
    return 'webpage';
  }
  return false;
}

function doWeb(doc, url) {
  var item = new Zotero.Item('webpage');
  item.title = 'Test Article';
  item.url = url;
  item.complete();
}
  `,
};

const metadataTranslator: Translator = {
  metadata: {
    translatorID: 'test-metadata',
    label: 'Metadata Extractor',
    creator: 'Test',
    target: '^https://test\\.com',
    minVersion: '3.0',
    maxVersion: '',
    priority: 100,
    inRepository: true,
    translatorType: 4,
    browserSupport: 'gcsibv',
    lastUpdated: '2024-01-01',
  },
  code: `
function detectWeb(doc, url) {
  return 'journalArticle';
}

function doWeb(doc, url) {
  var item = new Zotero.Item('journalArticle');

  // Extract from meta tags
  var title = attr(doc, 'meta[property="og:title"]', 'content');
  if (title) {
    item.title = title;
  }

  var author = attr(doc, 'meta[name="author"]', 'content');
  if (author) {
    item.creators.push(ZU.cleanAuthor(author, 'author'));
  }

  var date = attr(doc, 'meta[property="article:published_time"]', 'content');
  if (date) {
    item.date = ZU.strToISO(date);
  }

  item.url = url;
  item.complete();
}
  `,
};

describe('parseHTMLDocument', () => {
  test('parses simple HTML', () => {
    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');

    expect(doc.querySelector('h1')?.textContent).toBe('Test');
  });

  test('sets document URL', () => {
    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com/page');

    expect(doc.URL).toBe('https://example.com/page');
    expect(doc.documentURI).toBe('https://example.com/page');
  });

  test('parses complex HTML', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Page</title>
          <meta property="og:title" content="Test Title">
        </head>
        <body>
          <article>
            <h1>Article Title</h1>
            <p>Content</p>
          </article>
        </body>
      </html>
    `;

    const doc = parseHTMLDocument(html, 'https://example.com');

    expect(doc.querySelector('title')?.textContent).toBe('Test Page');
    expect(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Test Title');
    expect(doc.querySelector('h1')?.textContent).toBe('Article Title');
  });

  test('handles empty HTML', () => {
    const html = '';
    const doc = parseHTMLDocument(html, 'https://example.com');

    expect(doc).toBeTruthy();
  });
});

describe('executeDetectWeb', () => {
  test('executes detectWeb and returns item type', async () => {
    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com/article/123');

    const result = await executeDetectWeb(simpleTranslator, doc, 'https://example.com/article/123');

    expect(result).toBe('webpage');
  });

  test('returns false when detectWeb fails', async () => {
    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com/other');

    const result = await executeDetectWeb(simpleTranslator, doc, 'https://example.com/other');

    expect(result).toBe(false);
  });

  test('returns null on error', async () => {
    const brokenTranslator: Translator = {
      ...simpleTranslator,
      code: `
function detectWeb(doc, url) {
  throw new Error('Test error');
}
      `,
    };

    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');

    const result = await executeDetectWeb(brokenTranslator, doc, 'https://example.com');

    expect(result).toBeNull();
  });

  test('handles translator without detectWeb', async () => {
    const noDetectWeb: Translator = {
      ...simpleTranslator,
      code: `
function doWeb(doc, url) {
  // No detectWeb function
}
      `,
    };

    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');

    const result = await executeDetectWeb(noDetectWeb, doc, 'https://example.com');

    expect(result).toBeNull();
  });
});

describe('executeDoWeb', () => {
  test('executes doWeb and returns items', async () => {
    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com/article/123');

    const items = await executeDoWeb(simpleTranslator, doc, 'https://example.com/article/123');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Test Article');
    expect(items[0].url).toBe('https://example.com/article/123');
    expect(items[0].itemType).toBe('webpage');
  });

  test('extracts metadata from HTML', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="My Article Title">
          <meta name="author" content="John Doe">
          <meta property="article:published_time" content="2024-01-15T10:00:00Z">
        </head>
        <body></body>
      </html>
    `;

    const doc = parseHTMLDocument(html, 'https://test.com/article');

    const items = await executeDoWeb(metadataTranslator, doc, 'https://test.com/article');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('My Article Title');
    expect(items[0].creators?.length).toBe(1);
    expect(items[0].creators?.[0].firstName).toBe('John');
    expect(items[0].creators?.[0].lastName).toBe('Doe');
    expect(items[0].date).toMatch(/2024-01-15/);
  });

  test('returns empty array on error', async () => {
    const brokenTranslator: Translator = {
      ...simpleTranslator,
      code: `
function doWeb(doc, url) {
  throw new Error('Test error');
}
      `,
    };

    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');

    const items = await executeDoWeb(brokenTranslator, doc, 'https://example.com');

    expect(items.length).toBe(0);
  });

  test('handles multiple items', async () => {
    const multiItemTranslator: Translator = {
      ...simpleTranslator,
      code: `
function detectWeb(doc, url) {
  return 'multiple';
}

function doWeb(doc, url) {
  var item1 = new Zotero.Item('webpage');
  item1.title = 'Article 1';
  item1.complete();

  var item2 = new Zotero.Item('webpage');
  item2.title = 'Article 2';
  item2.complete();
}
      `,
    };

    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');

    const items = await executeDoWeb(multiItemTranslator, doc, 'https://example.com');

    expect(items.length).toBe(2);
    expect(items[0].title).toBe('Article 1');
    expect(items[1].title).toBe('Article 2');
  });

  test('handles translator with ZU utilities', async () => {
    const zuTranslator: Translator = {
      ...simpleTranslator,
      code: `
function detectWeb(doc, url) {
  return 'webpage';
}

function doWeb(doc, url) {
  var item = new Zotero.Item('webpage');
  item.title = ZU.trimInternal('  Multiple   Spaces  ');

  var creator = ZU.cleanAuthor('Doe, Jane', 'author', true);
  item.creators.push(creator);

  item.date = ZU.strToISO('2024-01-15');

  item.complete();
}
      `,
    };

    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');

    const items = await executeDoWeb(zuTranslator, doc, 'https://example.com');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Multiple Spaces');
    expect(items[0].creators?.[0].firstName).toBe('Jane');
    expect(items[0].creators?.[0].lastName).toBe('Doe');
    expect(items[0].date).toBe('2024-01-15');
  });

  test('handles helper functions (attr, text)', async () => {
    const helperTranslator: Translator = {
      ...simpleTranslator,
      code: `
function detectWeb(doc, url) {
  return 'webpage';
}

function doWeb(doc, url) {
  var item = new Zotero.Item('webpage');

  // Use attr helper
  var title = attr(doc, 'meta[property="og:title"]', 'content');
  if (title) item.title = title;

  // Use text helper
  var heading = text(doc, 'h1');
  if (heading) item.abstractNote = heading;

  item.complete();
}
      `,
    };

    const html = `
      <html>
        <head>
          <meta property="og:title" content="Page Title">
        </head>
        <body>
          <h1>Main Heading</h1>
        </body>
      </html>
    `;

    const doc = parseHTMLDocument(html, 'https://example.com');

    const items = await executeDoWeb(helperTranslator, doc, 'https://example.com');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Page Title');
    expect(items[0].abstractNote).toBe('Main Heading');
  });
});

describe('Sandbox isolation', () => {
  test('translator has access to Zotero API', async () => {
    const apiTranslator: Translator = {
      ...simpleTranslator,
      code: `
function detectWeb(doc, url) {
  return 'webpage';
}

function doWeb(doc, url) {
  var item = new Zotero.Item('webpage');
  item.title = 'Test';

  // Test Item methods
  item.addTag('tag1');
  item.addNote('note1');

  item.complete();
}
      `,
    };

    const html = '<html><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');

    const items = await executeDoWeb(apiTranslator, doc, 'https://example.com');

    expect(items.length).toBe(1);
    expect(items[0].tags?.length).toBe(1);
    expect(items[0].notes?.length).toBe(1);
  });

  test('translator has access to document and url', async () => {
    const contextTranslator: Translator = {
      ...simpleTranslator,
      code: `
function detectWeb(doc, url) {
  return 'webpage';
}

function doWeb(doc, url) {
  var item = new Zotero.Item('webpage');

  // Access doc
  var title = doc.querySelector('title');
  if (title) item.title = title.textContent;

  // Access url
  item.url = url;

  item.complete();
}
      `,
    };

    const html = '<html><head><title>Document Title</title></head><body></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com/page');

    const items = await executeDoWeb(contextTranslator, doc, 'https://example.com/page');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Document Title');
    expect(items[0].url).toBe('https://example.com/page');
  });
});
