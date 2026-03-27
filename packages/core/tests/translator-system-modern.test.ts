import { describe, test, expect } from 'bun:test';
import {
  SandboxManager,
  TranslatorExecutor,
  ZoteroItem,
  ZoteroUtilities as ZU,
  attr,
  text,
} from '../src/translator-system-modern';

describe('SandboxManager', () => {
  test('creates sandbox with defaults', () => {
    const sandbox = new SandboxManager();
    expect(sandbox.sandbox.Zotero).toEqual({});
    expect(sandbox.sandbox.Promise).toBe(Promise);
  });

  test('evaluates code and extracts functions', () => {
    const sandbox = new SandboxManager();

    sandbox.eval(`
      function detectWeb(doc, url) {
        return 'article';
      }
    `, ['detectWeb']);

    const detectWeb = sandbox.get<Function>('detectWeb');
    expect(typeof detectWeb).toBe('function');
    expect(detectWeb(null, 'http://example.com')).toBe('article');
  });

  test('injects sandbox variables into code', () => {
    const sandbox = new SandboxManager();
    sandbox.sandbox.testValue = 42;

    sandbox.eval('var result = testValue * 2;', ['result']);
    expect(sandbox.get('result')).toBe(84);
  });

  test('importObject preserves context', () => {
    const sandbox = new SandboxManager();

    class TestClass {
      value = 100;
      getValue() { return this.value; }
    }

    const instance = new TestClass();
    sandbox.importObject(instance);

    expect(sandbox.sandbox.Zotero.getValue()).toBe(100);

    instance.value = 200;
    expect(sandbox.sandbox.Zotero.getValue()).toBe(200);
  });

  test('reset clears user data but keeps defaults', () => {
    const sandbox = new SandboxManager();
    sandbox.set('customVar', 123);
    sandbox.reset();

    expect(sandbox.get('customVar')).toBeUndefined();
    expect(sandbox.sandbox.Promise).toBe(Promise);
  });
});

describe('ZoteroItem', () => {
  test('creates item with type', () => {
    const item = new ZoteroItem('article');
    expect(item.itemType).toBe('article');
    expect(item.creators).toEqual([]);
    expect(item.tags).toEqual([]);
  });

  test('complete calls callback with item data', () => {
    let completedItem: any = null;

    const item = new ZoteroItem('book');
    item._setComplete((data) => {
      completedItem = data;
    });

    item.title = 'Test Book';
    item.creators = [{ firstName: 'John', lastName: 'Doe', creatorType: 'author' }];
    item.complete();

    expect(completedItem).toBeDefined();
    expect(completedItem.itemType).toBe('book');
    expect(completedItem.title).toBe('Test Book');
    expect(completedItem.creators).toHaveLength(1);
  });
});

describe('ZoteroUtilities', () => {
  test('trim removes whitespace', () => {
    expect(ZU.trim('  hello  ')).toBe('hello');
    expect(ZU.trim('')).toBe('');
  });

  test('trimInternal collapses whitespace', () => {
    expect(ZU.trimInternal('  hello   world  ')).toBe('hello world');
  });

  test('cleanTitle removes trailing periods and extra whitespace', () => {
    expect(ZU.cleanTitle('Test Article...')).toBe('Test Article');
    expect(ZU.cleanTitle('  Multiple   Spaces  ')).toBe('Multiple Spaces');
  });

  test('cleanDOI removes URL prefix', () => {
    expect(ZU.cleanDOI('https://doi.org/10.1234/test')).toBe('10.1234/test');
    expect(ZU.cleanDOI('http://dx.doi.org/10.1234/test')).toBe('10.1234/test');
    expect(ZU.cleanDOI('10.1234/test')).toBe('10.1234/test');
  });

  test('cleanISBN removes hyphens and validates', () => {
    expect(ZU.cleanISBN('978-0-123-45678-9')).toBe('9780123456789');
    expect(ZU.cleanISBN('invalid')).toBeNull();
  });

  test('unescapeHTML decodes entities', () => {
    expect(ZU.unescapeHTML('&lt;div&gt;')).toBe('<div>');
    expect(ZU.unescapeHTML('&amp;')).toBe('&');
  });
});

describe('Helper Functions', () => {
  test('attr gets element attribute', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<div id="test" class="foo"></div>', 'text/html');
    const div = doc.querySelector('div');

    expect(attr(div, 'id')).toBe('test');
    expect(attr(div, 'class')).toBe('foo');
    expect(attr(div, 'missing')).toBeNull();
  });

  test('text gets element text content', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<div>  Hello World  </div>', 'text/html');
    const div = doc.querySelector('div');

    expect(text(div)).toBe('Hello World');
  });

  test('text with selector queries child element', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<div><span class="title">Article Title</span></div>',
      'text/html'
    );
    const div = doc.querySelector('div');

    expect(text(div, '.title')).toBe('Article Title');
  });
});

describe('TranslatorExecutor', () => {
  test('detectWeb executes and returns item type', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'test-id',
        label: 'Test Translator',
        translatorType: 4,
        target: '',
        priority: 100,
      },
      code: `
        function detectWeb(doc, url) {
          if (url.includes('article')) return 'article';
          return false;
        }
      `,
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body><h1>Test</h1></body></html>', 'text/html');

    const result1 = await executor.detectWeb(translator, doc, 'http://example.com/article');
    expect(result1).toBe('article');

    const result2 = await executor.detectWeb(translator, doc, 'http://example.com/page');
    expect(result2).toBe(false);
  });

  test('doWeb executes and returns items', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'test-id',
        label: 'Test Translator',
        translatorType: 4,
        target: '',
        priority: 100,
      },
      code: `
        function doWeb(doc, url) {
          const item = new Zotero.Item('article');
          item.title = 'Test Article';
          item.url = url;
          item.complete();
        }
      `,
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');

    const items = await executor.doWeb(translator, doc, 'http://example.com/article');

    expect(items).toHaveLength(1);
    expect(items[0].itemType).toBe('article');
    expect(items[0].title).toBe('Test Article');
    expect(items[0].url).toBe('http://example.com/article');
  });

  test('doWeb handles multiple items', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'test-id',
        label: 'Test Translator',
        translatorType: 4,
        target: '',
        priority: 100,
      },
      code: `
        function doWeb(doc, url) {
          for (let i = 1; i <= 3; i++) {
            const item = new Zotero.Item('article');
            item.title = 'Article ' + i;
            item.complete();
          }
        }
      `,
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');

    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe('Article 1');
    expect(items[1].title).toBe('Article 2');
    expect(items[2].title).toBe('Article 3');
  });

  test('translator can use ZU utilities', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'test-id',
        label: 'Test Translator',
        translatorType: 4,
        target: '',
        priority: 100,
      },
      code: `
        function doWeb(doc, url) {
          const item = new Zotero.Item('article');
          item.title = ZU.cleanTitle('  Test   Article...  ');
          item.DOI = ZU.cleanDOI('https://doi.org/10.1234/test');
          item.complete();
        }
      `,
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');

    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items[0].title).toBe('Test Article');
    expect(items[0].DOI).toBe('10.1234/test');
  });

  test('translator can use attr and text helpers', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'test-id',
        label: 'Test Translator',
        translatorType: 4,
        target: '',
        priority: 100,
      },
      code: `
        function doWeb(doc, url) {
          const titleEl = doc.querySelector('h1');
          const linkEl = doc.querySelector('a');

          const item = new Zotero.Item('article');
          item.title = text(titleEl);
          item.url = attr(linkEl, 'href');
          item.complete();
        }
      `,
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><h1>My Article</h1><a href="http://link.com">Link</a></body></html>',
      'text/html'
    );

    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items[0].title).toBe('My Article');
    expect(items[0].url).toBe('http://link.com');
  });

  test('handles translator errors gracefully', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'test-id',
        label: 'Broken Translator',
        translatorType: 4,
        target: '',
        priority: 100,
      },
      code: `
        function doWeb(doc, url) {
          throw new Error('Intentional error');
        }
      `,
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');

    const items = await executor.doWeb(translator, doc, 'http://example.com');

    // Should return empty array on error
    expect(items).toEqual([]);
  });

  test('supports async translators', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'test-id',
        label: 'Async Translator',
        translatorType: 4,
        target: '',
        priority: 100,
      },
      code: `
        async function doWeb(doc, url) {
          await new Promise(resolve => setTimeout(resolve, 10));

          const item = new Zotero.Item('article');
          item.title = 'Async Article';
          item.complete();
        }
      `,
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');

    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Async Article');
  });
});

describe('Complete Translator Workflow', () => {
  test('full extraction workflow', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'full-test',
        label: 'Full Test Translator',
        translatorType: 4,
        target: 'example\\.com',
        priority: 100,
      },
      code: `
        function detectWeb(doc, url) {
          if (doc.querySelector('article')) {
            return 'article';
          }
          return false;
        }

        function doWeb(doc, url) {
          const item = new Zotero.Item('article');

          // Extract metadata using helpers
          item.title = text(doc.querySelector('h1.title'));
          item.abstractNote = text(doc.querySelector('div.abstract'));
          item.url = url;

          // Extract authors
          const authorElements = doc.querySelectorAll('.author');
          authorElements.forEach(el => {
            const name = text(el);
            if (name) {
              item.creators.push({
                firstName: '',
                lastName: name,
                creatorType: 'author'
              });
            }
          });

          // Extract tags
          const tagElements = doc.querySelectorAll('.tag');
          tagElements.forEach(el => {
            const tag = text(el);
            if (tag) item.tags.push(tag);
          });

          item.complete();
        }
      `,
    };

    const html = `
      <html>
        <body>
          <article>
            <h1 class="title">Advanced JavaScript Techniques</h1>
            <div class="abstract">This article explores advanced techniques...</div>
            <div class="authors">
              <span class="author">John Doe</span>
              <span class="author">Jane Smith</span>
            </div>
            <div class="tags">
              <span class="tag">JavaScript</span>
              <span class="tag">Programming</span>
            </div>
          </article>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const url = 'http://example.com/article/123';

    // Test detection
    const itemType = await executor.detectWeb(translator, doc, url);
    expect(itemType).toBe('article');

    // Test extraction
    const items = await executor.doWeb(translator, doc, url);

    expect(items).toHaveLength(1);
    expect(items[0].itemType).toBe('article');
    expect(items[0].title).toBe('Advanced JavaScript Techniques');
    expect(items[0].abstractNote).toBe('This article explores advanced techniques...');
    expect(items[0].url).toBe(url);
    expect(items[0].creators).toHaveLength(2);
    expect(items[0].creators[0].lastName).toBe('John Doe');
    expect(items[0].tags).toEqual(['JavaScript', 'Programming']);
  });
});
