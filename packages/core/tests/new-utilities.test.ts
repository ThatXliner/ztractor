import { describe, expect, test } from 'bun:test';
import { ZU } from '../src/translator-sandbox';

describe('New Zotero Utilities', () => {
  // Text processing utilities
  describe('Text Processing', () => {
    test('trim() removes leading and trailing whitespace', () => {
      expect(ZU.trim('  hello world  ')).toBe('hello world');
      expect(ZU.trim('\n\ttest\n\t')).toBe('test');
    });

    test('removeDiacritics() removes accents', () => {
      expect(ZU.removeDiacritics('café')).toBe('cafe');
      expect(ZU.removeDiacritics('naïve')).toBe('naive');
      expect(ZU.removeDiacritics('Zürich')).toBe('Zurich');
    });

    test('capitalizeName() handles hyphens and apostrophes', () => {
      expect(ZU.capitalizeName('jean-paul sartre')).toBe('Jean-Paul Sartre');
      expect(ZU.capitalizeName("o'brien")).toBe("O'Brien");
      expect(ZU.capitalizeName('mary kate smith')).toBe('Mary Kate Smith');
    });

    test('capitalize() capitalizes first letter only', () => {
      expect(ZU.capitalize('hello')).toBe('Hello');
      expect(ZU.capitalize('WORLD')).toBe('WORLD');
    });

    test('superCleanString() removes zero-width chars', () => {
      expect(ZU.superCleanString('hello\u200Bworld')).toBe('helloworld');
      expect(ZU.superCleanString('test   spaces')).toBe('test spaces');
      expect(ZU.superCleanString('hello \u200B world')).toBe('hello world');
    });

    test('ellipsize() truncates strings', () => {
      expect(ZU.ellipsize('hello world', 8)).toBe('hello wo...');
      expect(ZU.ellipsize('hello world', 8, true)).toBe('hello...');
      expect(ZU.ellipsize('short', 10)).toBe('short');
    });

    test('lpad() pads strings', () => {
      expect(ZU.lpad('42', '0', 5)).toBe('00042');
      expect(ZU.lpad('test', ' ', 8)).toBe('    test');
    });

    test('getPageRange() extracts page ranges', () => {
      expect(ZU.getPageRange('123-456')).toEqual([123, 456]);
      expect(ZU.getPageRange('42')).toEqual([42, 42]);
      expect(ZU.getPageRange('100–200')).toEqual([100, 200]);
    });
  });

  // Array utilities
  describe('Array Utilities', () => {
    test('arrayDiff() finds differences', () => {
      expect(ZU.arrayDiff([1, 2, 3], [2, 3, 4])).toEqual([1]);
      expect(ZU.arrayDiff(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual(['a']);
    });

    test('arrayEquals() checks equality', () => {
      expect(ZU.arrayEquals([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(ZU.arrayEquals([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(ZU.arrayEquals([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true);
    });

    test('arrayShuffle() returns shuffled array', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = ZU.arrayShuffle(arr);
      expect(shuffled.length).toBe(arr.length);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    test('arrayUnique() removes duplicates', () => {
      expect(ZU.arrayUnique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(ZU.arrayUnique(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });
  });

  // Object utilities
  describe('Object Utilities', () => {
    test('isEmpty() checks for empty objects', () => {
      expect(ZU.isEmpty({})).toBe(true);
      expect(ZU.isEmpty({ a: 1 })).toBe(false);
      expect(ZU.isEmpty(null)).toBe(true);
      expect(ZU.isEmpty(undefined)).toBe(true);
    });

    test('deepCopy() creates deep copies', () => {
      const obj = { a: 1, b: { c: 2 } };
      const copy = ZU.deepCopy(obj);
      expect(copy).toEqual(obj);
      expect(copy).not.toBe(obj);
      expect(copy.b).not.toBe(obj.b);
    });
  });

  // String utilities
  describe('String Utilities', () => {
    test('levenshtein() calculates edit distance', () => {
      expect(ZU.levenshtein('kitten', 'sitting')).toBe(3);
      expect(ZU.levenshtein('hello', 'hello')).toBe(0);
      expect(ZU.levenshtein('', 'test')).toBe(4);
    });

    test('quotemeta() escapes regex characters', () => {
      expect(ZU.quotemeta('a.b*c?')).toBe('a\\.b\\*c\\?');
      expect(ZU.quotemeta('[test]')).toBe('\\[test\\]');
    });

    test('pluralize() handles plurals', () => {
      expect(ZU.pluralize(1, ['item', 'items'])).toBe('item');
      expect(ZU.pluralize(2, ['item', 'items'])).toBe('items');
      expect(ZU.pluralize(0, ['item', 'items'])).toBe('items');
    });

    test('numberFormat() formats numbers', () => {
      expect(ZU.numberFormat(1234567, 0, '.', ',')).toBe('1,234,567');
      expect(ZU.numberFormat(1234.56, 2, '.', ',')).toBe('1,234.56');
    });

    test('randomString() generates random strings', () => {
      const str1 = ZU.randomString(10);
      const str2 = ZU.randomString(10);
      expect(str1.length).toBe(10);
      expect(str2.length).toBe(10);
      expect(str1).not.toBe(str2);
    });
  });

  // URL utilities
  describe('URL Utilities', () => {
    test('isHTTPURL() validates URLs', () => {
      expect(ZU.isHTTPURL('https://example.com')).toBe(true);
      expect(ZU.isHTTPURL('http://test.org')).toBe(true);
      expect(ZU.isHTTPURL('ftp://test.org')).toBe(false);
      expect(ZU.isHTTPURL('example.com', true)).toBe(true);
    });

    test('cleanURL() validates and cleans URLs', () => {
      expect(ZU.cleanURL('https://example.com')).toBe('https://example.com/');
      expect(ZU.cleanURL('  https://test.org  ')).toBe('https://test.org/');
      expect(ZU.cleanURL('example.com', true)).toBe('http://example.com/');
    });

    test('autoLink() creates HTML links', () => {
      const result = ZU.autoLink('Visit https://example.com for more');
      expect(result).toContain('<a href="https://example.com">');
    });
  });

  // Identifier utilities
  describe('Identifier Utilities', () => {
    test('extractIdentifiers() extracts multiple identifiers', () => {
      const text = 'DOI: 10.1234/test ISBN: 9780123456789 arXiv:2101.12345 PMID:12345678';
      const ids = ZU.extractIdentifiers(text);
      expect(ids.DOI).toContain('10.1234/test');
      expect(ids.ISBN).toContain('9780123456789');
      expect(ids.arXiv).toContain('2101.12345');
      expect(ids.PMID).toContain('12345678');
    });

    test('toISBN13() converts ISBN-10 to ISBN-13', () => {
      expect(ZU.toISBN13('0123456789')).toBe('9780123456786');
      expect(ZU.toISBN13('9780123456789')).toBe('9780123456789');
    });
  });

  // HTML utilities
  describe('HTML Utilities', () => {
    test('htmlSpecialChars() encodes special characters', () => {
      expect(ZU.htmlSpecialChars('<div>Test & "quotes"</div>'))
        .toBe('&lt;div&gt;Test &amp; &quot;quotes&quot;&lt;/div&gt;');
    });

    test('text2html() converts text to HTML', () => {
      const result = ZU.text2html('Line 1\nLine 2');
      expect(result).toContain('<p>');
      expect(result).toContain('<br>');
    });

    test('parseMarkup() extracts links', () => {
      const html = 'Visit <a href="https://example.com">Example</a> site';
      const parsed = ZU.parseMarkup(html);
      expect(parsed).toEqual([
        { text: 'Visit ' },
        { text: 'Example', href: 'https://example.com' },
        { text: ' site' }
      ]);
    });
  });

  // Date utilities
  describe('Date Utilities', () => {
    test('strToDate() converts string to Date', () => {
      const date = ZU.strToDate('2024-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
    });

    test('formatDate() formats dates', () => {
      const date = new Date('2024-01-15');
      expect(ZU.formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15');
    });
  });

  // Schema validation utilities
  describe('Schema Validation', () => {
    test('fieldIsValidForType() validates fields', () => {
      expect(ZU.fieldIsValidForType('title', 'journalArticle')).toBe(true);
      expect(ZU.fieldIsValidForType('publicationTitle', 'journalArticle')).toBe(true);
      expect(ZU.fieldIsValidForType('invalidField', 'journalArticle')).toBe(false);
    });

    test('getCreatorsForType() returns valid creator types', () => {
      const creators = ZU.getCreatorsForType('journalArticle');
      expect(creators).toContain('author');
      expect(creators).toContain('editor');
    });

    test('itemTypeExists() checks item type existence', () => {
      expect(ZU.itemTypeExists('journalArticle')).toBe(true);
      expect(ZU.itemTypeExists('book')).toBe(true);
      expect(ZU.itemTypeExists('invalidType')).toBe(false);
    });

    test('getAllItemTypes() returns all types', () => {
      const types = ZU.getAllItemTypes();
      expect(types).toContain('journalArticle');
      expect(types).toContain('book');
      expect(types).toContain('webpage');
    });

    test('getFieldsForType() returns all valid fields', () => {
      const fields = ZU.getFieldsForType('journalArticle');
      expect(fields).toContain('title');
      expect(fields).toContain('publicationTitle');
      expect(fields).toContain('DOI');
    });
  });

  // XRegExp polyfill
  describe('XRegExp Polyfill', () => {
    test('XRegExp() creates regex with Unicode support', () => {
      const regex = ZU.XRegExp('\\p{L}+', 'g');
      expect(regex).toBeInstanceOf(RegExp);
    });

    test('XRegExp.escape() escapes special characters', () => {
      expect(ZU.XRegExp.escape('a.b*c')).toBe('a\\.b\\*c');
    });

    test('XRegExp.test() tests regex', () => {
      const regex = /test/;
      expect(ZU.XRegExp.test('testing', regex)).toBe(true);
      expect(ZU.XRegExp.test('hello', regex)).toBe(false);
    });
  });

  // Performance utilities
  describe('Performance Utilities', () => {
    test('debounce() debounces function calls', async () => {
      let count = 0;
      const fn = ZU.debounce(() => count++, 10);

      fn();
      fn();
      fn();

      expect(count).toBe(0);

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(count).toBe(1);
    });

    test('throttle() throttles function calls', async () => {
      let count = 0;
      const fn = ZU.throttle(() => count++, 50);

      fn(); // Should execute immediately
      fn(); // Should be throttled
      fn(); // Should be throttled

      expect(count).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 60));
      expect(count).toBe(2); // Trailing call should execute
    });
  });
});
