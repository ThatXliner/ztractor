import { test, expect, describe } from 'bun:test';
import {
  parseTranslatorMetadata,
  loadTranslator,
  matchesTarget,
  findMatchingTranslators,
  getTranslatorById,
} from '../src/translator-loader';
import type { Translator } from '../src/types';

const sampleTranslatorCode = `{
\t"translatorID": "abc-123",
\t"label": "Test Site",
\t"creator": "Test Author",
\t"target": "^https?://(www\\\\.)?example\\\\.com/",
\t"minVersion": "3.0",
\t"maxVersion": "",
\t"priority": 100,
\t"inRepository": true,
\t"translatorType": 4,
\t"browserSupport": "gcsibv",
\t"lastUpdated": "2024-01-01 12:00:00"
}

function detectWeb(doc, url) {
\treturn "webpage";
}

function doWeb(doc, url) {
\tvar item = new Zotero.Item("webpage");
\titem.title = "Test";
\titem.complete();
}`;

describe('parseTranslatorMetadata', () => {
  test('parses valid translator metadata', () => {
    const metadata = parseTranslatorMetadata(sampleTranslatorCode);

    expect(metadata).toBeTruthy();
    expect(metadata?.translatorID).toBe('abc-123');
    expect(metadata?.label).toBe('Test Site');
    expect(metadata?.creator).toBe('Test Author');
    expect(metadata?.target).toBe('^https?://(www\\.)?example\\.com/');
    expect(metadata?.translatorType).toBe(4);
    expect(metadata?.priority).toBe(100);
    expect(metadata?.inRepository).toBe(true);
  });

  test('returns null for invalid JSON', () => {
    const invalidCode = `not valid json
function detectWeb() {}`;

    const metadata = parseTranslatorMetadata(invalidCode);
    expect(metadata).toBeNull();
  });

  test('returns null for missing required fields', () => {
    const incompleteCode = `{
\t"translatorID": "abc-123",
\t"label": "Test"
}`;

    const metadata = parseTranslatorMetadata(incompleteCode);
    expect(metadata).toBeNull();
  });

  test('returns null for empty string', () => {
    const metadata = parseTranslatorMetadata('');
    expect(metadata).toBeNull();
  });

  test('handles metadata with extra whitespace', () => {
    const codeWithWhitespace = `

{
\t"translatorID": "abc-123",
\t"label": "Test Site",
\t"creator": "Test Author",
\t"target": "^https://test",
\t"minVersion": "3.0",
\t"maxVersion": "",
\t"priority": 100,
\t"inRepository": true,
\t"translatorType": 4,
\t"browserSupport": "gcsibv",
\t"lastUpdated": "2024-01-01"
}

function detectWeb() {}`;

    const metadata = parseTranslatorMetadata(codeWithWhitespace);
    expect(metadata).toBeTruthy();
    expect(metadata?.translatorID).toBe('abc-123');
  });

  test('validates translatorType is defined', () => {
    const noType = `{
\t"translatorID": "abc-123",
\t"label": "Test",
\t"creator": "Author",
\t"target": "^https://test",
\t"minVersion": "3.0",
\t"maxVersion": "",
\t"priority": 100,
\t"inRepository": true,
\t"browserSupport": "gcsibv",
\t"lastUpdated": "2024-01-01"
}`;

    const metadata = parseTranslatorMetadata(noType);
    expect(metadata).toBeNull();
  });
});

describe('loadTranslator', () => {
  test('loads valid translator', () => {
    const translator = loadTranslator(sampleTranslatorCode, 'test.js');

    expect(translator).toBeTruthy();
    expect(translator?.metadata.translatorID).toBe('abc-123');
    expect(translator?.code).toBe(sampleTranslatorCode);
  });

  test('returns null for invalid code', () => {
    const translator = loadTranslator('invalid code', 'invalid.js');
    expect(translator).toBeNull();
  });

  test('stores filename in metadata check', () => {
    const translator = loadTranslator(sampleTranslatorCode, 'my-translator.js');
    expect(translator).toBeTruthy();
  });

  test('works without filename', () => {
    const translator = loadTranslator(sampleTranslatorCode);
    expect(translator).toBeTruthy();
    expect(translator?.metadata.label).toBe('Test Site');
  });
});

describe('matchesTarget', () => {
  test('matches simple URL pattern', () => {
    const pattern = '^https?://example\\.com/';
    expect(matchesTarget('https://example.com/', pattern)).toBe(true);
    expect(matchesTarget('http://example.com/', pattern)).toBe(true);
  });

  test('does not match different domain', () => {
    const pattern = '^https?://example\\.com/';
    expect(matchesTarget('https://other.com/', pattern)).toBe(false);
  });

  test('handles optional www', () => {
    const pattern = '^https?://(www\\.)?example\\.com/';
    expect(matchesTarget('https://example.com/', pattern)).toBe(true);
    expect(matchesTarget('https://www.example.com/', pattern)).toBe(true);
  });

  test('matches specific paths', () => {
    const pattern = '^https?://example\\.com/articles/';
    expect(matchesTarget('https://example.com/articles/123', pattern)).toBe(true);
    expect(matchesTarget('https://example.com/blog/123', pattern)).toBe(false);
  });

  test('handles complex regex patterns', () => {
    const pattern = '^https?://[^/]+\\.example\\.com/';
    expect(matchesTarget('https://subdomain.example.com/', pattern)).toBe(true);
    expect(matchesTarget('https://example.com/', pattern)).toBe(false);
  });

  test('returns false for invalid regex', () => {
    const pattern = '[invalid(regex';
    expect(matchesTarget('https://example.com/', pattern)).toBe(false);
  });

  test('matches query parameters', () => {
    const pattern = '^https?://example\\.com/.*\\?id=';
    expect(matchesTarget('https://example.com/page?id=123', pattern)).toBe(true);
    expect(matchesTarget('https://example.com/page', pattern)).toBe(false);
  });
});

describe('findMatchingTranslators', () => {
  const translators: Translator[] = [
    {
      metadata: {
        translatorID: '1',
        label: 'Example.com',
        creator: 'Author',
        target: '^https?://example\\.com/',
        minVersion: '3.0',
        maxVersion: '',
        priority: 100,
        inRepository: true,
        translatorType: 4,
        browserSupport: 'gcsibv',
        lastUpdated: '2024-01-01',
      },
      code: 'code1',
    },
    {
      metadata: {
        translatorID: '2',
        label: 'Example.com Articles',
        creator: 'Author',
        target: '^https?://example\\.com/articles/',
        minVersion: '3.0',
        maxVersion: '',
        priority: 200,
        inRepository: true,
        translatorType: 4,
        browserSupport: 'gcsibv',
        lastUpdated: '2024-01-01',
      },
      code: 'code2',
    },
    {
      metadata: {
        translatorID: '3',
        label: 'Other.com',
        creator: 'Author',
        target: '^https?://other\\.com/',
        minVersion: '3.0',
        maxVersion: '',
        priority: 100,
        inRepository: true,
        translatorType: 4,
        browserSupport: 'gcsibv',
        lastUpdated: '2024-01-01',
      },
      code: 'code3',
    },
  ];

  test('finds all matching translators', () => {
    const matches = findMatchingTranslators('https://example.com/articles/123', translators);

    expect(matches.length).toBe(2);
    expect(matches[0].metadata.label).toBe('Example.com Articles'); // Higher priority first
    expect(matches[1].metadata.label).toBe('Example.com');
  });

  test('sorts by priority (descending)', () => {
    const matches = findMatchingTranslators('https://example.com/', translators);

    // Both match, but priority 200 should come first
    if (matches.length > 1) {
      expect(matches[0].metadata.priority).toBeGreaterThanOrEqual(matches[1].metadata.priority);
    }
  });

  test('returns empty array for no matches', () => {
    const matches = findMatchingTranslators('https://nomatch.com/', translators);
    expect(matches.length).toBe(0);
  });

  test('returns single match', () => {
    const matches = findMatchingTranslators('https://other.com/', translators);
    expect(matches.length).toBe(1);
    expect(matches[0].metadata.label).toBe('Other.com');
  });

  test('handles empty translator list', () => {
    const matches = findMatchingTranslators('https://example.com/', []);
    expect(matches.length).toBe(0);
  });
});

describe('getTranslatorById', () => {
  const translators: Translator[] = [
    {
      metadata: {
        translatorID: 'abc-123',
        label: 'Translator 1',
        creator: 'Author',
        target: '^https://test1',
        minVersion: '3.0',
        maxVersion: '',
        priority: 100,
        inRepository: true,
        translatorType: 4,
        browserSupport: 'gcsibv',
        lastUpdated: '2024-01-01',
      },
      code: 'code1',
    },
    {
      metadata: {
        translatorID: 'def-456',
        label: 'Translator 2',
        creator: 'Author',
        target: '^https://test2',
        minVersion: '3.0',
        maxVersion: '',
        priority: 100,
        inRepository: true,
        translatorType: 4,
        browserSupport: 'gcsibv',
        lastUpdated: '2024-01-01',
      },
      code: 'code2',
    },
  ];

  test('finds translator by ID', () => {
    const translator = getTranslatorById('abc-123', translators);
    expect(translator).toBeTruthy();
    expect(translator?.metadata.label).toBe('Translator 1');
  });

  test('finds different translator by ID', () => {
    const translator = getTranslatorById('def-456', translators);
    expect(translator).toBeTruthy();
    expect(translator?.metadata.label).toBe('Translator 2');
  });

  test('returns null for non-existent ID', () => {
    const translator = getTranslatorById('xyz-999', translators);
    expect(translator).toBeNull();
  });

  test('returns null for empty list', () => {
    const translator = getTranslatorById('abc-123', []);
    expect(translator).toBeNull();
  });

  test('handles empty ID', () => {
    const translator = getTranslatorById('', translators);
    expect(translator).toBeNull();
  });
});

describe('Translator type validation', () => {
  test('accepts web translator (type 4)', () => {
    const code = `{
  "translatorID": "test",
  "label": "Test",
  "creator": "Author",
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
    expect(metadata?.translatorType).toBe(4);
  });

  test('accepts other translator types', () => {
    const importType = `{
  "translatorID": "test",
  "label": "Test",
  "creator": "Author",
  "target": "^https://test",
  "minVersion": "3.0",
  "maxVersion": "",
  "priority": 100,
  "inRepository": true,
  "translatorType": 1,
  "browserSupport": "gcsibv",
  "lastUpdated": "2024-01-01"
}`;

    const metadata = parseTranslatorMetadata(importType);
    expect(metadata?.translatorType).toBe(1);
  });
});
