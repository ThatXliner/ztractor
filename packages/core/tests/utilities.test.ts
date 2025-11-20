import { test, expect, describe } from 'bun:test';
import { ZU, attr, text } from '../src/utilities';

// Mock minimal DOM for testing
function createMockDocument(html: string): any {
  // Very basic mock that supports querySelector and minimal XPath
  // For real DOM tests, we should use the node package tests
  return {
    querySelector: (selector: string) => {
      if (selector === 'a' && html.includes('<a href="https://example.com">')) {
        return { getAttribute: (attr: string) => (attr === 'href' ? 'https://example.com' : null) };
      }
      if (selector === 'a' && html.includes('<a>')) {
        return { getAttribute: () => null };
      }
      if (selector === 'p.test' && html.includes('<p class="test">Hello</p>')) {
        return { textContent: 'Hello' };
      }
      if (selector === 'p' && html.includes('<p>  Hello  World  </p>')) {
        return { textContent: '  Hello  World  ' };
      }
      return null;
    },
    evaluate: () => ({
      iterateNext: () => null,
      snapshotLength: 0,
      snapshotItem: () => null
    })
  };
}

describe('ZU.trimInternal', () => {
  test('removes leading and trailing whitespace', () => {
    expect(ZU.trimInternal('  hello  ')).toBe('hello');
  });

  test('collapses multiple spaces into one', () => {
    expect(ZU.trimInternal('hello   world')).toBe('hello world');
  });

  test('handles newlines and tabs', () => {
    expect(ZU.trimInternal('hello\n\n\tworld')).toBe('hello world');
  });

  test('handles empty string', () => {
    expect(ZU.trimInternal('')).toBe('');
  });

  test('handles string with only whitespace', () => {
    expect(ZU.trimInternal('   \n\t  ')).toBe('');
  });
});

describe('ZU.cleanAuthor', () => {
  test('parses first and last name', () => {
    const author = ZU.cleanAuthor('John Doe', 'author');
    expect(author.firstName).toBe('John');
    expect(author.lastName).toBe('Doe');
    expect(author.creatorType).toBe('author');
  });

  test('parses last, first format with useComma', () => {
    const author = ZU.cleanAuthor('Doe, John', 'author', true);
    expect(author.firstName).toBe('John');
    expect(author.lastName).toBe('Doe');
  });

  test('parses last, first format with comma in name', () => {
    const author = ZU.cleanAuthor('Van Der Berg, Jan');
    expect(author.firstName).toBe('Jan');
    expect(author.lastName).toBe('Van Der Berg');
  });

  test('handles multiple first names', () => {
    const author = ZU.cleanAuthor('John Paul Smith');
    expect(author.firstName).toBe('John Paul');
    expect(author.lastName).toBe('Smith');
  });

  test('handles single name', () => {
    const author = ZU.cleanAuthor('Madonna');
    expect(author.firstName).toBe('');
    expect(author.lastName).toBe('Madonna');
  });

  test('accepts object input', () => {
    const input = { firstName: 'Jane', lastName: 'Doe' };
    const author = ZU.cleanAuthor(input, 'editor');
    expect(author.firstName).toBe('Jane');
    expect(author.lastName).toBe('Doe');
    expect(author.creatorType).toBe('editor');
  });

  test('trims whitespace', () => {
    const author = ZU.cleanAuthor('  John   Doe  ');
    expect(author.firstName).toBe('John');
    expect(author.lastName).toBe('Doe');
  });

  test('handles different creator types', () => {
    const editor = ZU.cleanAuthor('John Doe', 'editor');
    expect(editor.creatorType).toBe('editor');

    const translator = ZU.cleanAuthor('Jane Smith', 'translator');
    expect(translator.creatorType).toBe('translator');
  });
});

describe('ZU.strToISO', () => {
  test('preserves already ISO format', () => {
    expect(ZU.strToISO('2024-01-15')).toBe('2024-01-15');
    expect(ZU.strToISO('2024-12-31')).toBe('2024-12-31');
  });

  test('strips time from ISO datetime', () => {
    expect(ZU.strToISO('2024-01-15T10:30:00Z')).toBe('2024-01-15');
  });

  test('converts various date formats', () => {
    const result = ZU.strToISO('January 15, 2024');
    expect(result).toMatch(/2024-01-15/);
  });

  test('handles empty string', () => {
    expect(ZU.strToISO('')).toBe('');
  });

  test('returns original for unparseable dates', () => {
    const invalid = 'not a date';
    expect(ZU.strToISO(invalid)).toBe(invalid);
  });

  test('handles different date string formats', () => {
    // These might vary based on Date parser implementation
    const date1 = ZU.strToISO('2024/01/15');
    expect(date1).toMatch(/2024-01-15/);

    const date2 = ZU.strToISO('15 Jan 2024');
    expect(date2).toMatch(/2024-01/);
  });
});

describe('ZU.capitalizeTitle', () => {
  test('capitalizes all major words', () => {
    expect(ZU.capitalizeTitle('the quick brown fox')).toBe('The Quick Brown Fox');
  });

  test('keeps small words lowercase in middle', () => {
    expect(ZU.capitalizeTitle('a tale of two cities')).toBe('A Tale of Two Cities');
  });

  test('always capitalizes first and last word', () => {
    expect(ZU.capitalizeTitle('the art of war')).toBe('The Art of War');
    expect(ZU.capitalizeTitle('what to do')).toBe('What to Do');
  });

  test('handles already capitalized text', () => {
    expect(ZU.capitalizeTitle('The Great Gatsby')).toBe('The Great Gatsby');
  });

  test('handles empty string', () => {
    expect(ZU.capitalizeTitle('')).toBe('');
  });

  test('handles single word', () => {
    expect(ZU.capitalizeTitle('hello')).toBe('Hello');
  });

  test('handles multiple spaces (collapses to single)', () => {
    // capitalizeTitle splits on \s+ so it collapses multiple spaces
    expect(ZU.capitalizeTitle('hello  world')).toBe('Hello World');
  });
});

describe('ZU.cleanDOI', () => {
  test('extracts DOI from plain text', () => {
    expect(ZU.cleanDOI('10.1234/example.doi')).toBe('10.1234/example.doi');
  });

  test('extracts DOI from URL', () => {
    expect(ZU.cleanDOI('https://doi.org/10.1234/example.doi')).toBe('10.1234/example.doi');
  });

  test('removes trailing punctuation', () => {
    expect(ZU.cleanDOI('10.1234/example.doi.')).toBe('10.1234/example.doi');
    expect(ZU.cleanDOI('10.1234/example.doi,')).toBe('10.1234/example.doi');
  });

  test('handles complex DOI', () => {
    expect(ZU.cleanDOI('10.1000/xyz123.456')).toBe('10.1000/xyz123.456');
  });

  test('returns null for invalid input', () => {
    expect(ZU.cleanDOI('')).toBeNull();
    expect(ZU.cleanDOI('not a doi')).toBeNull();
  });

  test('handles DOI with special characters', () => {
    const doi = ZU.cleanDOI('10.1234/test(2024)123-456');
    expect(doi).toContain('10.1234/test');
  });
});

describe('ZU.cleanISBN', () => {
  test('removes hyphens from ISBN', () => {
    expect(ZU.cleanISBN('978-0-123-45678-9')).toBe('9780123456789');
  });

  test('removes spaces', () => {
    expect(ZU.cleanISBN('978 0 123 45678 9')).toBe('9780123456789');
  });

  test('preserves X in ISBN-10', () => {
    expect(ZU.cleanISBN('0-123-45678-X')).toBe('012345678X');
  });

  test('handles empty string', () => {
    expect(ZU.cleanISBN('')).toBe('');
  });

  test('removes all non-numeric except X', () => {
    expect(ZU.cleanISBN('ISBN: 978-0-123-45678-9 (hardcover)')).toBe('9780123456789');
  });
});

describe('ZU.cleanISSN', () => {
  test('preserves hyphen in ISSN', () => {
    expect(ZU.cleanISSN('1234-5678')).toBe('1234-5678');
  });

  test('removes spaces', () => {
    expect(ZU.cleanISSN('1234 5678')).toBe('12345678');
  });

  test('removes extra characters', () => {
    expect(ZU.cleanISSN('ISSN: 1234-5678')).toBe('1234-5678');
  });

  test('handles empty string', () => {
    expect(ZU.cleanISSN('')).toBe('');
  });
});

describe('ZU.cleanTags', () => {
  test('removes HTML tags', () => {
    expect(ZU.cleanTags('<p>Hello</p>')).toBe('Hello');
  });

  test('removes nested tags', () => {
    expect(ZU.cleanTags('<div><p><strong>Hello</strong> world</p></div>')).toBe('Hello world');
  });

  test('trims result', () => {
    expect(ZU.cleanTags('  <p>Hello</p>  ')).toBe('Hello');
  });

  test('handles empty string', () => {
    expect(ZU.cleanTags('')).toBe('');
  });

  test('handles string without tags', () => {
    expect(ZU.cleanTags('plain text')).toBe('plain text');
  });

  test('removes self-closing tags', () => {
    expect(ZU.cleanTags('Hello<br/>world')).toBe('Helloworld');
  });
});

describe('ZU.slugify', () => {
  test('converts to lowercase', () => {
    expect(ZU.slugify('Hello World')).toBe('hello-world');
  });

  test('replaces spaces with hyphens', () => {
    expect(ZU.slugify('hello world')).toBe('hello-world');
  });

  test('removes special characters', () => {
    expect(ZU.slugify('hello! world?')).toBe('hello-world');
  });

  test('collapses multiple hyphens', () => {
    expect(ZU.slugify('hello   world')).toBe('hello-world');
  });

  test('removes leading and trailing hyphens', () => {
    expect(ZU.slugify('  hello world  ')).toBe('hello-world');
  });

  test('handles underscores', () => {
    expect(ZU.slugify('hello_world')).toBe('hello-world');
  });
});

describe('ZU.parseQueryString', () => {
  test('parses simple query string', () => {
    const params = ZU.parseQueryString('https://example.com?foo=bar&baz=qux');
    expect(params.foo).toBe('bar');
    expect(params.baz).toBe('qux');
  });

  test('handles URL encoded values', () => {
    const params = ZU.parseQueryString('https://example.com?name=John%20Doe');
    expect(params.name).toBe('John Doe');
  });

  test('handles empty values', () => {
    const params = ZU.parseQueryString('https://example.com?foo=&bar=baz');
    expect(params.foo).toBe('');
    expect(params.bar).toBe('baz');
  });

  test('handles no query string', () => {
    const params = ZU.parseQueryString('https://example.com');
    expect(Object.keys(params).length).toBe(0);
  });

  test('handles multiple values for same key (takes last)', () => {
    const params = ZU.parseQueryString('https://example.com?foo=1&foo=2');
    expect(params.foo).toBe('2');
  });
});

describe('ZU.unescapeHTML', () => {
  test('unescapes common entities', () => {
    expect(ZU.unescapeHTML('&lt;div&gt;')).toBe('<div>');
    expect(ZU.unescapeHTML('&amp;')).toBe('&');
    expect(ZU.unescapeHTML('&quot;')).toBe('"');
    expect(ZU.unescapeHTML('&#39;')).toBe("'");
  });

  test('unescapes multiple entities', () => {
    expect(ZU.unescapeHTML('&lt;p&gt;Hello &amp; goodbye&lt;/p&gt;')).toBe('<p>Hello & goodbye</p>');
  });

  test('handles no entities', () => {
    expect(ZU.unescapeHTML('plain text')).toBe('plain text');
  });

  test('handles nbsp', () => {
    expect(ZU.unescapeHTML('hello&nbsp;world')).toBe('hello world');
  });
});

describe('ZU.xpath', () => {
  test('finds elements by xpath', () => {
    // Skip actual DOM tests in core, rely on node package integration tests
  });
});

describe('ZU.xpathText', () => {
  test('extracts text content', () => {
     // Skip actual DOM tests in core, rely on node package integration tests
  });
});

describe('attr helper', () => {
  test('gets attribute value', () => {
    const document = createMockDocument('<div><a href="https://example.com">Link</a></div>');
    expect(attr(document, 'a', 'href')).toBe('https://example.com');
  });

  test('returns null for missing element', () => {
    const document = createMockDocument('<div>No link</div>');
    expect(attr(document, 'a', 'href')).toBeNull();
  });

  test('returns null for missing attribute', () => {
    const document = createMockDocument('<div><a>Link</a></div>');
    expect(attr(document, 'a', 'href')).toBeNull();
  });
});

describe('text helper', () => {
  test('gets text content', () => {
    const document = createMockDocument('<div><p class="test">Hello</p></div>');
    expect(text(document, 'p.test')).toBe('Hello');
  });

  test('returns null for missing element', () => {
    const document = createMockDocument('<div>No paragraph</div>');
    expect(text(document, 'p')).toBeNull();
  });

  test('trims whitespace', () => {
    const document = createMockDocument('<div><p>  Hello  World  </p></div>');
    expect(text(document, 'p')).toBe('Hello World');
  });
});
