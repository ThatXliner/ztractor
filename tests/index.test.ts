import { test, expect, describe } from 'bun:test';
import { ZU } from '../src/utilities';
import { Item } from '../src/item';
import { parseTranslatorMetadata } from '../src/translator-loader';

describe('Zotero Utilities', () => {
  test('trimInternal removes extra whitespace', () => {
    expect(ZU.trimInternal('  hello   world  ')).toBe('hello world');
    expect(ZU.trimInternal('foo\n\nbar')).toBe('foo bar');
  });

  test('cleanAuthor parses names correctly', () => {
    const author1 = ZU.cleanAuthor('John Doe', 'author');
    expect(author1.firstName).toBe('John');
    expect(author1.lastName).toBe('Doe');
    expect(author1.creatorType).toBe('author');

    const author2 = ZU.cleanAuthor('Doe, John', 'author', true);
    expect(author2.firstName).toBe('John');
    expect(author2.lastName).toBe('Doe');
  });

  test('strToISO converts dates', () => {
    expect(ZU.strToISO('2024-01-15')).toBe('2024-01-15');
    expect(ZU.strToISO('January 15, 2024')).toMatch(/2024-01-15/);
  });

  test('cleanDOI extracts DOI', () => {
    expect(ZU.cleanDOI('10.1234/example.doi')).toBe('10.1234/example.doi');
    expect(ZU.cleanDOI('https://doi.org/10.1234/example.doi')).toBe(
      '10.1234/example.doi'
    );
    expect(ZU.cleanDOI('10.1234/example.doi.')).toBe('10.1234/example.doi');
  });

  test('capitalizeTitle capitalizes correctly', () => {
    expect(ZU.capitalizeTitle('the quick brown fox')).toBe(
      'The Quick Brown Fox'
    );
    expect(ZU.capitalizeTitle('a tale of two cities')).toBe(
      'A Tale of Two Cities'
    );
  });
});

describe('Item class', () => {
  test('creates item with correct type', () => {
    const item = new Item('journalArticle');
    expect(item.itemType).toBe('journalArticle');
  });

  test('can set properties', () => {
    const item = new Item('book');
    item.title = 'Test Book';
    item.creators.push({
      firstName: 'Jane',
      lastName: 'Smith',
      creatorType: 'author',
    });

    expect(item.title).toBe('Test Book');
    expect(item.creators.length).toBe(1);
    expect(item.creators[0].lastName).toBe('Smith');
  });

  test('complete() triggers callback', (done) => {
    const item = new Item('webpage');
    item.title = 'Test Page';
    item.url = 'https://example.com';

    item.setComplete((completedItem) => {
      expect(completedItem.title).toBe('Test Page');
      expect(completedItem.accessDate).toBeTruthy();
      done();
    });

    item.complete();
  });

  test('toJSON returns plain object', () => {
    const item = new Item('blogPost');
    item.title = 'Blog Post';
    item.tags.push({ tag: 'technology' });

    const json = item.toJSON();
    expect(json.itemType).toBe('blogPost');
    expect(json.title).toBe('Blog Post');
    expect(json.tags?.length).toBe(1);
  });
});

describe('Translator metadata parser', () => {
  test('parses valid metadata', () => {
    const code = `{
  "translatorID": "test-id",
  "label": "Test Translator",
  "creator": "Test Author",
  "target": "^https://example\\\\.com",
  "minVersion": "3.0",
  "maxVersion": "",
  "priority": 100,
  "inRepository": true,
  "translatorType": 4,
  "browserSupport": "gcsibv",
  "lastUpdated": "2024-01-01"
}

function detectWeb(doc, url) {
  return "webpage";
}`;

    const metadata = parseTranslatorMetadata(code);
    expect(metadata).toBeTruthy();
    expect(metadata?.translatorID).toBe('test-id');
    expect(metadata?.label).toBe('Test Translator');
    expect(metadata?.translatorType).toBe(4);
  });

  test('returns null for invalid metadata', () => {
    const invalidCode = 'not valid translator code';
    const metadata = parseTranslatorMetadata(invalidCode);
    expect(metadata).toBeNull();
  });
});
