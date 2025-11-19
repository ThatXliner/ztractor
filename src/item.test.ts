import { test, expect, describe } from 'bun:test';
import { Item } from './item';

describe('Item constructor', () => {
  test('creates item with correct type', () => {
    const item = new Item('journalArticle');
    expect(item.itemType).toBe('journalArticle');
  });

  test('initializes with empty arrays', () => {
    const item = new Item('book');
    expect(item.creators).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.notes).toEqual([]);
    expect(item.attachments).toEqual([]);
    expect(item.collections).toEqual([]);
  });

  test('initializes with empty relations object', () => {
    const item = new Item('webpage');
    expect(item.relations).toEqual({});
  });
});

describe('Item.complete', () => {
  test('calls completion callback', (done) => {
    const item = new Item('webpage');
    item.title = 'Test Page';

    item.setComplete((completedItem) => {
      expect(completedItem.title).toBe('Test Page');
      done();
    });

    item.complete();
  });

  test('sets accessDate automatically if url is present', (done) => {
    const item = new Item('webpage');
    item.url = 'https://example.com';

    item.setComplete((completedItem) => {
      expect(completedItem.accessDate).toBeTruthy();
      expect(completedItem.accessDate).toMatch(/\d{4}-\d{2}-\d{2}/);
      done();
    });

    item.complete();
  });

  test('does not override existing accessDate', (done) => {
    const item = new Item('webpage');
    item.url = 'https://example.com';
    item.accessDate = '2024-01-01';

    item.setComplete((completedItem) => {
      expect(completedItem.accessDate).toBe('2024-01-01');
      done();
    });

    item.complete();
  });

  test('only calls completion callback once', () => {
    let callCount = 0;
    const item = new Item('webpage');

    item.setComplete(() => {
      callCount++;
    });

    item.complete();
    item.complete();
    item.complete();

    expect(callCount).toBe(1);
  });

  test('works without callback', () => {
    const item = new Item('book');
    expect(() => item.complete()).not.toThrow();
  });
});

describe('Item properties', () => {
  test('can set all basic properties', () => {
    const item = new Item('journalArticle');

    item.title = 'Test Article';
    item.abstractNote = 'This is an abstract';
    item.publicationTitle = 'Journal of Testing';
    item.volume = '10';
    item.issue = '3';
    item.pages = '123-145';
    item.date = '2024-01-15';
    item.DOI = '10.1234/test.2024';
    item.ISSN = '1234-5678';
    item.url = 'https://example.com';
    item.language = 'en';

    expect(item.title).toBe('Test Article');
    expect(item.abstractNote).toBe('This is an abstract');
    expect(item.publicationTitle).toBe('Journal of Testing');
    expect(item.volume).toBe('10');
    expect(item.issue).toBe('3');
    expect(item.pages).toBe('123-145');
    expect(item.date).toBe('2024-01-15');
    expect(item.DOI).toBe('10.1234/test.2024');
    expect(item.ISSN).toBe('1234-5678');
    expect(item.url).toBe('https://example.com');
    expect(item.language).toBe('en');
  });

  test('can set book-specific properties', () => {
    const item = new Item('book');

    item.publisher = 'Test Publisher';
    item.place = 'New York';
    item.edition = '2nd';
    item.numPages = '350';
    item.ISBN = '978-0-123-45678-9';

    expect(item.publisher).toBe('Test Publisher');
    expect(item.place).toBe('New York');
    expect(item.edition).toBe('2nd');
    expect(item.numPages).toBe('350');
    expect(item.ISBN).toBe('978-0-123-45678-9');
  });

  test('can set video/audio properties', () => {
    const item = new Item('videoRecording');

    item.studio = 'Test Studio';
    item.runningTime = '120 min';
    item.medium = 'DVD';

    expect(item.studio).toBe('Test Studio');
    expect(item.runningTime).toBe('120 min');
    expect(item.medium).toBe('DVD');
  });

  test('can set thesis properties', () => {
    const item = new Item('thesis');

    item.university = 'Test University';
    item.thesisType = 'PhD dissertation';

    expect(item.university).toBe('Test University');
    expect(item.thesisType).toBe('PhD dissertation');
  });
});

describe('Item.addCreator', () => {
  test('adds creator to creators array', () => {
    const item = new Item('book');

    item.addCreator({
      firstName: 'John',
      lastName: 'Doe',
      creatorType: 'author',
    });

    expect(item.creators.length).toBe(1);
    expect(item.creators[0].firstName).toBe('John');
    expect(item.creators[0].lastName).toBe('Doe');
    expect(item.creators[0].creatorType).toBe('author');
  });

  test('adds multiple creators', () => {
    const item = new Item('book');

    item.addCreator({
      firstName: 'John',
      lastName: 'Doe',
      creatorType: 'author',
    });

    item.addCreator({
      firstName: 'Jane',
      lastName: 'Smith',
      creatorType: 'editor',
    });

    expect(item.creators.length).toBe(2);
    expect(item.creators[1].creatorType).toBe('editor');
  });

  test('handles single-field names', () => {
    const item = new Item('book');

    item.addCreator({
      name: 'Madonna',
      creatorType: 'author',
    });

    expect(item.creators.length).toBe(1);
    expect(item.creators[0].name).toBe('Madonna');
  });
});

describe('Item.addTag', () => {
  test('adds string tag', () => {
    const item = new Item('webpage');
    item.addTag('technology');

    expect(item.tags.length).toBe(1);
    expect(item.tags[0].tag).toBe('technology');
  });

  test('adds tag object', () => {
    const item = new Item('webpage');
    item.addTag({ tag: 'science', type: 1 });

    expect(item.tags.length).toBe(1);
    expect(item.tags[0].tag).toBe('science');
    expect(item.tags[0].type).toBe(1);
  });

  test('adds multiple tags', () => {
    const item = new Item('webpage');
    item.addTag('tag1');
    item.addTag('tag2');
    item.addTag('tag3');

    expect(item.tags.length).toBe(3);
  });
});

describe('Item.addNote', () => {
  test('adds string note', () => {
    const item = new Item('book');
    item.addNote('This is a note');

    expect(item.notes.length).toBe(1);
    expect(item.notes[0].note).toBe('This is a note');
  });

  test('adds note object', () => {
    const item = new Item('book');
    item.addNote({
      note: 'Tagged note',
      tags: [{ tag: 'important' }],
    });

    expect(item.notes.length).toBe(1);
    expect(item.notes[0].note).toBe('Tagged note');
    expect(item.notes[0].tags?.length).toBe(1);
  });

  test('adds multiple notes', () => {
    const item = new Item('book');
    item.addNote('Note 1');
    item.addNote('Note 2');

    expect(item.notes.length).toBe(2);
  });
});

describe('Item.addAttachment', () => {
  test('adds attachment', () => {
    const item = new Item('webpage');
    item.addAttachment({
      title: 'PDF',
      url: 'https://example.com/doc.pdf',
      mimeType: 'application/pdf',
    });

    expect(item.attachments.length).toBe(1);
    expect(item.attachments[0].title).toBe('PDF');
    expect(item.attachments[0].url).toBe('https://example.com/doc.pdf');
  });

  test('adds snapshot attachment', () => {
    const item = new Item('webpage');
    item.addAttachment({
      title: 'Snapshot',
      snapshot: true,
    });

    expect(item.attachments.length).toBe(1);
    expect(item.attachments[0].snapshot).toBe(true);
  });

  test('adds multiple attachments', () => {
    const item = new Item('webpage');
    item.addAttachment({ title: 'PDF' });
    item.addAttachment({ title: 'HTML' });

    expect(item.attachments.length).toBe(2);
  });
});

describe('Item.toJSON', () => {
  test('converts to plain object', () => {
    const item = new Item('book');
    item.title = 'Test Book';
    item.creators.push({
      firstName: 'John',
      lastName: 'Doe',
      creatorType: 'author',
    });

    const json = item.toJSON();

    expect(json.itemType).toBe('book');
    expect(json.title).toBe('Test Book');
    expect(json.creators?.length).toBe(1);
    expect(typeof json).toBe('object');
  });

  test('excludes internal properties', () => {
    const item = new Item('webpage');
    const json = item.toJSON();

    expect(json).not.toHaveProperty('completed');
    expect(json).not.toHaveProperty('_onComplete');
  });

  test('excludes undefined properties', () => {
    const item = new Item('book');
    item.title = 'Test';
    // Don't set abstract

    const json = item.toJSON();

    expect(json.title).toBe('Test');
    expect(json.abstractNote).toBeUndefined();
  });

  test('includes all set properties', () => {
    const item = new Item('journalArticle');
    item.title = 'Article';
    item.volume = '10';
    item.issue = '3';
    item.pages = '1-10';
    item.DOI = '10.1234/test';

    const json = item.toJSON();

    expect(json.title).toBe('Article');
    expect(json.volume).toBe('10');
    expect(json.issue).toBe('3');
    expect(json.pages).toBe('1-10');
    expect(json.DOI).toBe('10.1234/test');
  });

  test('includes empty arrays', () => {
    const item = new Item('book');
    const json = item.toJSON();

    expect(json.creators).toEqual([]);
    expect(json.tags).toEqual([]);
  });

  test('includes arrays with items', () => {
    const item = new Item('book');
    item.addTag('test');
    item.addCreator({ firstName: 'John', lastName: 'Doe', creatorType: 'author' });

    const json = item.toJSON();

    expect(json.tags?.length).toBe(1);
    expect(json.creators?.length).toBe(1);
  });
});

describe('Item integration tests', () => {
  test('complete workflow', (done) => {
    const item = new Item('journalArticle');

    // Set properties
    item.title = 'Complete Test Article';
    item.abstractNote = 'This is the abstract';
    item.publicationTitle = 'Test Journal';
    item.volume = '5';
    item.issue = '2';
    item.pages = '100-120';
    item.date = '2024-01-15';
    item.DOI = '10.1234/test.2024.01';
    item.url = 'https://example.com/article';

    // Add creators
    item.addCreator({ firstName: 'John', lastName: 'Doe', creatorType: 'author' });
    item.addCreator({ firstName: 'Jane', lastName: 'Smith', creatorType: 'author' });

    // Add tags
    item.addTag('research');
    item.addTag('testing');

    // Add note
    item.addNote('Important findings');

    // Complete
    item.setComplete((completedItem) => {
      expect(completedItem.title).toBe('Complete Test Article');
      expect(completedItem.creators?.length).toBe(2);
      expect(completedItem.tags?.length).toBe(2);
      expect(completedItem.notes?.length).toBe(1);
      expect(completedItem.accessDate).toBeTruthy();
      done();
    });

    item.complete();
  });

  test('serialization roundtrip', () => {
    const item = new Item('book');
    item.title = 'Test Book';
    item.ISBN = '978-0-123456-78-9';
    item.addCreator({ firstName: 'Author', lastName: 'Name', creatorType: 'author' });
    item.addTag('test');

    const json = item.toJSON();
    const serialized = JSON.stringify(json);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.itemType).toBe('book');
    expect(deserialized.title).toBe('Test Book');
    expect(deserialized.ISBN).toBe('978-0-123456-78-9');
    expect(deserialized.creators.length).toBe(1);
    expect(deserialized.tags.length).toBe(1);
  });
});
