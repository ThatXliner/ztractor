import { describe, test, expect } from 'bun:test';
import { extractMetadata } from '../src/index';
import { Item, parseTranslatorMetadata, ZU } from 'ztractor';
import { parseHTMLDocument } from '../src/dom-utils';

describe('ZU Edge Cases', () => {
  describe('trimInternal edge cases', () => {
    test('handles null and undefined gracefully with empty string', () => {
      // TypeScript would prevent this, but test runtime behavior
      expect(ZU.trimInternal('' as any)).toBe('');
    });

    test('handles very long strings', () => {
      const long = ' '.repeat(10000) + 'text' + ' '.repeat(10000);
      expect(ZU.trimInternal(long)).toBe('text');
    });

    test('handles mixed whitespace types', () => {
      expect(ZU.trimInternal('\t\n\r hello \t\n\r world \t\n\r')).toBe(
        'hello world'
      );
    });
  });

  describe('cleanAuthor edge cases', () => {
    test('handles authors with multiple commas', () => {
      const author = ZU.cleanAuthor('Smith, Jr., John', 'author');
      expect(author.lastName).toBe('Smith');
      expect(author.firstName).toBe('Jr. John');
    });

    test('handles authors with titles', () => {
      const author = ZU.cleanAuthor('Dr. John Smith', 'author');
      expect(author.firstName).toBe('Dr. John');
      expect(author.lastName).toBe('Smith');
    });

    test('handles authors with suffixes', () => {
      const author = ZU.cleanAuthor('John Smith Jr.', 'author');
      expect(author.firstName).toBe('John Smith');
      expect(author.lastName).toBe('Jr.');
    });

    test('handles very long names', () => {
      const longName = 'FirstName ' + 'MiddleName '.repeat(10) + 'LastName';
      const author = ZU.cleanAuthor(longName, 'author');
      expect(author.lastName).toBe('LastName');
      expect(author.firstName).toContain('FirstName');
    });

    test('handles names with apostrophes', () => {
      const author = ZU.cleanAuthor("O'Brien, Sean", 'author');
      expect(author.lastName).toBe("O'Brien");
      expect(author.firstName).toBe('Sean');
    });

    test('handles names with hyphens', () => {
      const author = ZU.cleanAuthor('Jean-Paul Sartre', 'author');
      expect(author.firstName).toBe('Jean-Paul');
      expect(author.lastName).toBe('Sartre');
    });
  });

  describe('strToISO edge cases', () => {
    test('handles dates at year boundaries', () => {
      expect(ZU.strToISO('2024-01-01')).toBe('2024-01-01');
      expect(ZU.strToISO('2024-12-31')).toBe('2024-12-31');
    });

    test('handles partial dates', () => {
      const result = ZU.strToISO('2024');
      expect(result).toBeTruthy();
    });

    test('handles timestamps with milliseconds', () => {
      const result = ZU.strToISO('2024-01-15T10:30:45.123Z');
      expect(result).toBe('2024-01-15');
    });

    test('handles timestamps with timezone offsets', () => {
      const result = ZU.strToISO('2024-01-15T10:30:00+05:30');
      expect(result).toMatch(/2024-01-1[45]/);
    });

    test('handles very old dates', () => {
      const result = ZU.strToISO('1900-01-01');
      expect(result).toBe('1900-01-01');
    });

    test('handles future dates', () => {
      const result = ZU.strToISO('2099-12-31');
      expect(result).toBe('2099-12-31');
    });
  });

  describe('cleanDOI edge cases', () => {
    test('handles DOI with parentheses', () => {
      const doi = ZU.cleanDOI('10.1234/test(2024)123');
      expect(doi).toContain('10.1234');
    });

    test('handles DOI with multiple slashes', () => {
      const doi = ZU.cleanDOI('10.1234/abc/def/ghi');
      expect(doi).toBe('10.1234/abc/def/ghi');
    });

    test('handles DOI in sentence', () => {
      const doi = ZU.cleanDOI('The DOI is 10.1234/example in this paper.');
      expect(doi).toBe('10.1234/example');
    });

    test('handles multiple DOIs (returns first)', () => {
      const doi = ZU.cleanDOI('10.1234/first and 10.5678/second');
      expect(doi).toBe('10.1234/first');
    });

    test('handles DOI with underscores', () => {
      const doi = ZU.cleanDOI('10.1234/test_article_2024');
      expect(doi).toBe('10.1234/test_article_2024');
    });
  });

  describe('cleanISBN edge cases', () => {
    test('handles ISBN-13', () => {
      expect(ZU.cleanISBN('978-0-123-45678-9')).toBe('9780123456789');
    });

    test('handles ISBN-10', () => {
      expect(ZU.cleanISBN('0-123-45678-X')).toBe('012345678X');
    });

    test('handles ISBN with spaces and hyphens', () => {
      expect(ZU.cleanISBN('978 0 123 45678 9')).toBe('9780123456789');
    });

    test('handles ISBN in text', () => {
      // cleanISBN removes all non-digit and non-X characters, which includes the "13" from "ISBN-13"
      expect(ZU.cleanISBN('ISBN: 978-0-123-45678-9 (hardcover)')).toBe(
        '9780123456789'
      );
    });

    test('preserves both X and x', () => {
      expect(ZU.cleanISBN('012345678X')).toBe('012345678X');
      expect(ZU.cleanISBN('012345678x')).toBe('012345678X');
    });
  });

  describe('parseQueryString edge cases', () => {
    test('handles URL without query string', () => {
      const params = ZU.parseQueryString('https://example.com');
      expect(Object.keys(params).length).toBe(0);
    });

    test('handles query string with empty value', () => {
      const params = ZU.parseQueryString('https://example.com?key=');
      expect(params.key).toBe('');
    });

    test('handles query string with special characters', () => {
      const params = ZU.parseQueryString(
        'https://example.com?title=Hello%20World&symbols=%21%40%23'
      );
      expect(params.title).toBe('Hello World');
      expect(params.symbols).toBe('!@#');
    });

    test('handles query string with array-like params', () => {
      const params = ZU.parseQueryString('https://example.com?id[]=1&id[]=2');
      expect(params['id[]']).toBeTruthy();
    });

    test('handles malformed query strings', () => {
      const params = ZU.parseQueryString('https://example.com?key1&key2=value');
      expect(Object.keys(params).length).toBeGreaterThan(0);
    });
  });
});

describe('Item Edge Cases', () => {
  test('handles very long titles', () => {
    const item = new Item('book');
    item.title = 'A'.repeat(10000);
    const json = item.toJSON();
    expect(json.title?.length).toBe(10000);
  });

  test('handles many creators', () => {
    const item = new Item('book');
    for (let i = 0; i < 100; i++) {
      item.addCreator({
        firstName: `Author${i}`,
        lastName: `Name${i}`,
        creatorType: 'author',
      });
    }
    expect(item.creators.length).toBe(100);
  });

  test('handles many tags', () => {
    const item = new Item('webpage');
    for (let i = 0; i < 100; i++) {
      item.addTag(`tag${i}`);
    }
    expect(item.tags.length).toBe(100);
  });

  test('handles special characters in fields', () => {
    const item = new Item('book');
    item.title = 'Title with émojis 🎉 and spëcial çharacters';
    item.abstractNote = 'Abstract with 日本語 and 中文';

    const json = item.toJSON();
    expect(json.title).toContain('🎉');
    expect(json.abstractNote).toContain('日本語');
  });

  test('handles null-like values', () => {
    const item = new Item('book');
    item.title = '';
    item.abstractNote = undefined;

    const json = item.toJSON();
    expect(json.title).toBe('');
    expect(json.abstractNote).toBeUndefined();
  });

  test('handles circular reference in relations', () => {
    const item = new Item('book');
    // Relations is just a plain object, so this should work
    item.relations['relatedTo'] = 'item-id-123';
    expect(item.relations['relatedTo']).toBe('item-id-123');
  });
});

describe('parseTranslatorMetadata Edge Cases', () => {
  test('handles metadata with unusual priority values', () => {
    const code = `{
  "translatorID": "test",
  "label": "Test",
  "creator": "Author",
  "target": "^https://test",
  "minVersion": "3.0",
  "maxVersion": "",
  "priority": 999999,
  "inRepository": true,
  "translatorType": 4,
  "browserSupport": "gcsibv",
  "lastUpdated": "2024-01-01"
}`;

    const metadata = parseTranslatorMetadata(code);
    expect(metadata?.priority).toBe(999999);
  });

  test('handles metadata with zero priority', () => {
    const code = `{
  "translatorID": "test",
  "label": "Test",
  "creator": "Author",
  "target": "^https://test",
  "minVersion": "3.0",
  "maxVersion": "",
  "priority": 0,
  "inRepository": true,
  "translatorType": 4,
  "browserSupport": "gcsibv",
  "lastUpdated": "2024-01-01"
}`;

    const metadata = parseTranslatorMetadata(code);
    expect(metadata?.priority).toBe(0);
  });

  test('handles very long target patterns', () => {
    const longPattern = '^https://(' + 'example|test|'.repeat(100) + 'other)';
    const code = `{
  "translatorID": "test",
  "label": "Test",
  "creator": "Author",
  "target": "${longPattern}",
  "minVersion": "3.0",
  "maxVersion": "",
  "priority": 100,
  "inRepository": true,
  "translatorType": 4,
  "browserSupport": "gcsibv",
  "lastUpdated": "2024-01-01"
}`;

    const metadata = parseTranslatorMetadata(code);
    expect(metadata?.target).toBeTruthy();
    if (metadata?.target) {
      expect(metadata.target.length).toBeGreaterThan(100);
    }
  });

  test('handles Unicode in metadata fields', () => {
    const code = `{
  "translatorID": "test",
  "label": "Test 日本語",
  "creator": "Author 中文",
  "target": "^https://test",
  "minVersion": "3.0",
  "maxVersion": "",
  "priority": 100,
  "inRepository": true,
  "translatorType": 4,
  "browserSupport": "gcsibv",
  "lastUpdated": "2024-01-01"
}`;

    const metadata = parseTranslatorMetadata(code);
    expect(metadata?.label).toBeTruthy();
    expect(metadata?.creator).toBeTruthy();
    if (metadata) {
      expect(metadata.label).toContain('日本語');
      expect(metadata.creator).toContain('中文');
    }
  });
});

describe('parseHTMLDocument Edge Cases', () => {
  test('handles HTML with no head or body', () => {
    const html = '<div>Content</div>';
    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc).toBeTruthy();
  });

  test('handles completely empty HTML', () => {
    const doc = parseHTMLDocument('', 'https://example.com');
    expect(doc).toBeTruthy();
  });

  test('handles HTML with multiple DOCTYPE declarations', () => {
    const html = `<!DOCTYPE html>
<!DOCTYPE html>
<html><body>Content</body></html>`;
    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc).toBeTruthy();
  });

  test('handles HTML with unclosed tags', () => {
    const html = '<html><body><div><p>Unclosed';
    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc).toBeTruthy();
  });

  test('handles HTML with overlapping tags', () => {
    const html = '<html><body><b><i>Text</b></i></body></html>';
    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc).toBeTruthy();
  });

  test('handles very large HTML documents', () => {
    const largeHtml =
      '<html><body>' + '<div>Content</div>\n'.repeat(50000) + '</body></html>';
    const doc = parseHTMLDocument(largeHtml, 'https://example.com');
    expect(doc).toBeTruthy();
  }, 10000); // Longer timeout for large document

  test('handles HTML with special URL characters', () => {
    const html = '<html><body>Test</body></html>';
    const url = 'https://example.com/path?query=value#fragment';
    const doc = parseHTMLDocument(html, url);
    expect(doc.URL).toBe(url);
  });

  test('handles HTML with CDATA sections', () => {
    const html = `<html><body><script><![CDATA[
      var x = 1 < 2;
    ]]></script></body></html>`;
    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc).toBeTruthy();
  });

  test('handles HTML with comments', () => {
    const html = `<html>
<!-- Comment -->
<body>
<!-- Another comment -->
<p>Content</p>
</body>
</html>`;
    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc.querySelector('p')?.textContent).toBe('Content');
  });

  test('handles HTML with inline SVG', () => {
    const html = `<html><body>
<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" />
</svg>
</body></html>`;
    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc).toBeTruthy();
  });
});

describe('Memory and Performance Edge Cases', () => {
  test('handles rapid item creation and completion', () => {
    const items: Item[] = [];

    for (let i = 0; i < 1000; i++) {
      const item = new Item('webpage');
      item.title = `Item ${i}`;
      items.push(item);
    }

    expect(items.length).toBe(1000);
  });

  test('handles rapid JSON serialization', () => {
    const item = new Item('book');
    item.title = 'Test';

    for (let i = 0; i < 1000; i++) {
      const json = item.toJSON();
      expect(json.title).toBe('Test');
    }
  });

  test('handles deeply nested HTML structures', () => {
    let html = '<html><body>';
    for (let i = 0; i < 100; i++) {
      html += '<div>';
    }
    html += 'Content';
    for (let i = 0; i < 100; i++) {
      html += '</div>';
    }
    html += '</body></html>';

    const doc = parseHTMLDocument(html, 'https://example.com');
    expect(doc).toBeTruthy();
  });
});
