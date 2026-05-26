import { describe, test, expect, spyOn, afterEach } from 'bun:test';
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

  test('setExtra stores field:value in extra', () => {
    const item = new ZoteroItem('article');
    item.setExtra('DOI', '10.1/abc');
    expect(item.extra).toBe('DOI: 10.1/abc');
  });

  test('setExtra overwrites existing field', () => {
    const item = new ZoteroItem('article');
    item.setExtra('DOI', '10.1/abc');
    item.setExtra('DOI', '10.1/xyz');
    expect(item.extra).toBe('DOI: 10.1/xyz');
  });

  test('setExtra appends new fields on separate lines', () => {
    const item = new ZoteroItem('article');
    item.setExtra('DOI', '10.1/abc');
    item.setExtra('PMID', '12345');
    expect(item.extra).toBe('DOI: 10.1/abc\nPMID: 12345');
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

describe('Sandbox Globals', () => {
  test('sandbox provides Z as alias for Zotero', async () => {
    const executor = new TranslatorExecutor();
    const translator = {
      metadata: { translatorID: 'z-test', label: 'Z Test', translatorType: 4, target: '', priority: 100 },
      code: `
        function detectWeb(doc, url) {
          Z.debug("testing Z alias");
          return (Z === Zotero) ? 'article' : false;
        }
      `,
    };
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const result = await executor.detectWeb(translator, doc, 'http://example.com');
    expect(result).toBe('article');
  });

  test('sandbox provides innerText as global function', async () => {
    const executor = new TranslatorExecutor();
    const translator = {
      metadata: { translatorID: 'it-test', label: 'InnerText Test', translatorType: 4, target: '', priority: 100 },
      code: `
        function doWeb(doc, url) {
          const item = new Zotero.Item('article');
          item.title = innerText(doc, 'h1');
          item.complete();
        }
      `,
    };
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body><h1>  Hello  World  </h1></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Hello World');
  });

  test('sandbox provides bare request* globals as functions', async () => {
    const executor = new TranslatorExecutor();
    const translator = {
      metadata: { translatorID: 'req-test', label: 'Request Test', translatorType: 4, target: '', priority: 100 },
      code: `
        function detectWeb(doc, url) {
          const hasAll = typeof request === 'function'
            && typeof requestText === 'function'
            && typeof requestJSON === 'function'
            && typeof requestDocument === 'function';
          return hasAll ? 'article' : false;
        }
      `,
    };
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const result = await executor.detectWeb(translator, doc, 'http://example.com');
    expect(result).toBe('article');
  });

  test('sandbox sets Zotero.isConnector/isServer/isBookmarklet to false', async () => {
    const executor = new TranslatorExecutor();
    const translator = {
      metadata: { translatorID: 'flag-test', label: 'Flag Test', translatorType: 4, target: '', priority: 100 },
      code: `
        function detectWeb(doc, url) {
          if (Zotero.isConnector !== false) return false;
          if (Zotero.isServer !== false) return false;
          if (Zotero.isBookmarklet !== false) return false;
          if (Zotero.parentTranslator !== null) return false;
          return 'article';
        }
      `,
    };
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const result = await executor.detectWeb(translator, doc, 'http://example.com');
    expect(result).toBe('article');
  });

  test('sandbox provides ZU.HTTP as alias for ZU', async () => {
    const executor = new TranslatorExecutor();
    const translator = {
      metadata: { translatorID: 'http-test', label: 'HTTP Test', translatorType: 4, target: '', priority: 100 },
      code: `
        function detectWeb(doc, url) {
          return (typeof ZU.HTTP === 'object' && typeof ZU.HTTP.doGet === 'function') ? 'article' : false;
        }
      `,
    };
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const result = await executor.detectWeb(translator, doc, 'http://example.com');
    expect(result).toBe('article');
  });
});

function makeTranslator(code: string) {
  return {
    metadata: { label: 'test', translatorID: 'test-id', target: '', priority: 100, translatorType: 4, lastUpdated: '' },
    code,
  };
}

describe('Advanced Flows', () => {
  let fetchSpy: ReturnType<typeof spyOn> | null = null;

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
      fetchSpy = null;
    }
  });

  test('doWeb collects items from async processDocuments callback', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><head><title>Page2</title></head><body></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      async function doWeb(doc, url) {
        await ZU.processDocuments('http://example.com/page2', function(doc2, url2) {
          var item = new Zotero.Item('journalArticle');
          item.title = doc2.querySelector('title')?.textContent || 'fetched';
          item.url = url2;
          item.complete();
        });
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Page2');
    expect(items[0].url).toBe('http://example.com/page2');
  });

  test('processDocuments resolves relative URLs against page URL', async () => {
    let fetchedUrl = '';
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      fetchedUrl = typeof input === 'string' ? input : input.toString();
      return new Response('<html><body></body></html>', { status: 200 });
    });

    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      async function doWeb(doc, url) {
        await ZU.processDocuments('/relative/path', function(doc2) {
          var item = new Zotero.Item('journalArticle');
          item.title = 'resolved';
          item.complete();
        });
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    await executor.doWeb(translator, doc, 'http://example.com/article');

    expect(fetchedUrl).toBe('http://example.com/relative/path');
  });

  test('processDocuments passes (doc, url) to processor where doc has location set', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body><p>content</p></body></html>', { status: 200 })
    );

    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      async function doWeb(doc, url) {
        await ZU.processDocuments('http://example.com/detail', function(doc2, url2) {
          var item = new Zotero.Item('journalArticle');
          item.title = url2;
          item.complete();
        });
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('http://example.com/detail');
  });

  test('doGet(url, processor) calls processor(text, fakeXhr, url) with correct shape', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('response body', { status: 200 })
    );

    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      function doWeb(doc, url) {
        ZU.doGet('http://example.com/data', function(text, xhr, reqUrl) {
          var item = new Zotero.Item('journalArticle');
          item.title = text;
          item.extra = xhr.status + ':' + xhr.responseURL;
          item.complete();
        });
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('response body');
    expect(items[0].extra).toBe('200:http://example.com/data');
  });

  test('doGet([url1, url2], processor, done) calls processor for each URL then done()', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response('data', { status: 200 })
    );

    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      function doWeb(doc, url) {
        var count = 0;
        ZU.doGet(['http://a.com', 'http://b.com'], function(text) {
          count++;
          var item = new Zotero.Item('journalArticle');
          item.title = 'item' + count;
          item.complete();
        }, function() {
          // done callback — no-op
        });
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(2);
  });

  test('doPost(url, body, onDone) sends POST and calls onDone(text, fakeXhr)', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('post response', { status: 201 })
    );

    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      function doWeb(doc, url) {
        ZU.doPost('http://example.com/api', 'key=value', function(text, xhr) {
          var item = new Zotero.Item('journalArticle');
          item.title = text;
          item.extra = '' + xhr.status;
          item.complete();
        });
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('post response');
    expect(items[0].extra).toBe('201');
  });

  test('selectItems callback that triggers processDocuments collects all items', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body></body></html>', { status: 200 })
    );

    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      async function doWeb(doc, url) {
        Zotero.selectItems({a: 'Item A', b: 'Item B'}, function(selected) {
          ZU.processDocuments('http://example.com/detail', function(doc2) {
            for (var key in selected) {
              var item = new Zotero.Item('journalArticle');
              item.title = selected[key];
              item.complete();
            }
          });
        });
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(2);
    const titles = items.map(i => i.title).sort();
    expect(titles).toEqual(['Item A', 'Item B']);
  });

  test('Zotero.done() and Zotero.wait() exist as no-op functions', async () => {
    const executor = new TranslatorExecutor();
    const translator = makeTranslator(`
      function doWeb(doc, url) {
        Zotero.done();
        Zotero.wait();
        var item = new Zotero.Item('journalArticle');
        item.title = 'noop-ok';
        item.complete();
      }
    `);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(translator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('noop-ok');
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

describe('loadTranslator', () => {
  const embeddedCode = `
    function doWeb(doc, url) {
      var item = new Zotero.Item('journalArticle');
      item.title = 'Embedded Result';
      item.url = url;
      item.complete();
    }
  `;

  function makeEmbeddedTranslator(code: string) {
    return {
      metadata: { label: 'Embedded', translatorID: 'embed-id', target: '', priority: 100, translatorType: 4, lastUpdated: '' },
      code,
    };
  }

  test('getTranslatorObject calls callback with {detectWeb, doWeb} from embedded translator', async () => {
    const embeddedTranslator = makeEmbeddedTranslator(embeddedCode);
    const executor = new TranslatorExecutor({
      getTranslatorById: async (id) => id === 'embed-id' ? embeddedTranslator : null,
    });

    const parentCode = `
      async function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('web');
        translator.setTranslator('embed-id');
        translator.setDocument(doc);
        translator.setHandler('itemDone', function(obj, item) { item.complete(); });
        await new Promise(function(resolve) {
          translator.getTranslatorObject(function(trans) {
            trans.doWeb(doc, url);
            resolve();
          });
        });
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com/article');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Embedded Result');
  });

  test('getTranslatorObject without getTranslatorById option calls callback with empty object', async () => {
    const executor = new TranslatorExecutor(); // no getTranslatorById
    let callbackArg: any = undefined;

    const parentCode = `
      async function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('web');
        translator.setTranslator('some-id');
        await new Promise(function(resolve) {
          translator.getTranslatorObject(function(trans) {
            // store how many keys this object has
            var item = new Zotero.Item('journalArticle');
            item.title = Object.keys(trans).length === 0 ? 'empty-object' : 'non-empty';
            item.complete();
            resolve();
          });
        });
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('empty-object');
  });

  test('translate() executes embedded translator doWeb and items arrive via itemDone handler', async () => {
    const embeddedTranslator = makeEmbeddedTranslator(embeddedCode);
    const executor = new TranslatorExecutor({
      getTranslatorById: async (id) => id === 'embed-id' ? embeddedTranslator : null,
    });

    const parentCode = `
      async function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('web');
        translator.setTranslator('embed-id');
        translator.setDocument(doc);
        var itemDoneFired = false;
        translator.setHandler('itemDone', function(obj, item) {
          itemDoneFired = true;
          item.complete();
        });
        await translator.translate();
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com/article');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Embedded Result');
  });

  test('translate() executes import translator strings', async () => {
    const importTranslator = {
      metadata: { label: 'Mini Import', translatorID: 'import-id', target: '', priority: 100, translatorType: 1, lastUpdated: '' },
      code: `
        function doImport() {
          var title = 'missing';
          var line;
          while ((line = Zotero.read()) !== false) {
            if (line.indexOf('TI  - ') === 0) title = line.slice(6);
          }
          var item = new Zotero.Item('journalArticle');
          item.title = title;
          item.complete();
        }
      `,
    };
    const executor = new TranslatorExecutor({
      getTranslatorById: async (id) => id === 'import-id' ? importTranslator : null,
    });

    const parentCode = `
      async function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('import');
        translator.setTranslator('import-id');
        translator.setString('TY  - JOUR\\nTI  - Import Result\\nER  -');
        translator.setHandler('itemDone', function(obj, item) {
          item.title = item.title + ' via handler';
          item.complete();
        });
        await translator.translate();
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com/article');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Import Result via handler');
  });

  test('translate() tracks fire-and-forget import translators as pending work', async () => {
    const importTranslator = {
      metadata: { label: 'Mini Import', translatorID: 'import-id', target: '', priority: 100, translatorType: 1, lastUpdated: '' },
      code: `
        async function doImport() {
          await Promise.resolve();
          var line = Zotero.read();
          var item = new Zotero.Item('journalArticle');
          item.title = line.replace('TI  - ', '');
          item.complete();
        }
      `,
    };
    const executor = new TranslatorExecutor({
      getTranslatorById: async (id) => id === 'import-id' ? importTranslator : null,
    });

    const parentCode = `
      function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('import');
        translator.setTranslator('import-id');
        translator.setString('TI  - Async Import Result');
        translator.setHandler('itemDone', function(obj, item) { item.complete(); });
        translator.translate();
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com/article');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Async Import Result');
  });

  test('translate() items also arrive in parent doWeb items array via onItemComplete', async () => {
    const embeddedTranslator = makeEmbeddedTranslator(embeddedCode);
    const executor = new TranslatorExecutor({
      getTranslatorById: async (id) => id === 'embed-id' ? embeddedTranslator : null,
    });

    const parentCode = `
      async function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('web');
        translator.setTranslator('embed-id');
        translator.setDocument(doc);
        translator.setHandler('itemDone', function(obj, item) { item.complete(); });
        await translator.translate();
        // Also create a parent item
        var parentItem = new Zotero.Item('journalArticle');
        parentItem.title = 'Parent Item';
        parentItem.complete();
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com/article');

    expect(items).toHaveLength(2);
    const titles = items.map((i: any) => i.title).sort();
    expect(titles).toContain('Embedded Result');
    expect(titles).toContain('Parent Item');
  });

  test('translate() with missing translator ID is a no-op (does not throw)', async () => {
    const executor = new TranslatorExecutor({
      getTranslatorById: async () => null,
    });

    const parentCode = `
      async function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('web');
        // no setTranslator call — translatorId is null
        await translator.translate();
        var item = new Zotero.Item('journalArticle');
        item.title = 'no-throw';
        item.complete();
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('no-throw');
  });

  test('setDocument changes the document passed to embedded translator', async () => {
    const embeddedWithDocRead = `
      function doWeb(doc, url) {
        var item = new Zotero.Item('journalArticle');
        item.title = doc.querySelector('h1') ? doc.querySelector('h1').textContent : 'no-h1';
        item.complete();
      }
    `;
    const embeddedTranslator = makeEmbeddedTranslator(embeddedWithDocRead);
    const executor = new TranslatorExecutor({
      getTranslatorById: async (id) => id === 'embed-id' ? embeddedTranslator : null,
    });

    const parentCode = `
      async function doWeb(doc, url) {
        var parser = new DOMParser();
        var newDoc = parser.parseFromString('<html><body><h1>From New Doc</h1></body></html>', 'text/html');
        var translator = Zotero.loadTranslator('web');
        translator.setTranslator('embed-id');
        translator.setDocument(newDoc);
        translator.setHandler('itemDone', function(obj, item) { item.complete(); });
        await translator.translate();
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('From New Doc');
  });

  test('setHandler itemDone receives (null, item) for each completed item', async () => {
    const embeddedTranslator = makeEmbeddedTranslator(embeddedCode);
    const executor = new TranslatorExecutor({
      getTranslatorById: async (id) => id === 'embed-id' ? embeddedTranslator : null,
    });

    // We use a workaround: store the first arg to a Zotero.Item field so we can inspect it
    const parentCode = `
      async function doWeb(doc, url) {
        var translator = Zotero.loadTranslator('web');
        translator.setTranslator('embed-id');
        translator.setDocument(doc);
        var firstArg = 'not-null';
        translator.setHandler('itemDone', function(obj, item) {
          firstArg = obj;  // should be null
          item.complete();
          // set firstArg on a new item
          var marker = new Zotero.Item('journalArticle');
          marker.title = obj === null ? 'first-arg-null' : 'first-arg-not-null';
          marker.complete();
        });
        await translator.translate();
      }
    `;
    const parentTranslator = makeTranslator(parentCode);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');
    const items = await executor.doWeb(parentTranslator, doc, 'http://example.com');

    const markerItem = items.find((i: any) => i.title === 'first-arg-null' || i.title === 'first-arg-not-null');
    expect(markerItem?.title).toBe('first-arg-null');
  });
});
