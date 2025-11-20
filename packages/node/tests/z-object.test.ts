/**
 * Tests for Z object API methods
 */

import { describe, test, expect } from 'bun:test';
import { executeDetectWeb, executeDoWeb } from '../../core/src/executor';
import { parseHTMLDocument } from '../src/dom-utils';
import type { Translator } from '../../core/src/types';

describe('Z object API', () => {
  test('Z.debug should work', async () => {
    const translator: Translator = {
      metadata: {
        translatorID: 'test-z-debug',
        label: 'Z.debug Test',
        target: 'test\\.com',
        translatorType: 4,
        priority: 100,
        minVersion: '5.0',
      },
      code: `
function detectWeb(doc, url) {
  Z.debug("Test debug message");
  Z.debug("Test with level", 5);
  return "webpage";
}
      `,
    };

    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'http://test.com');

    const result = await executeDetectWeb(translator, doc, 'http://test.com', {
      DOMParser: (global as any).DOMParser,
      parseHTMLDocument,
    });

    expect(result).toBe('webpage');
  });

  test('Z.getHiddenPref should return default values', async () => {
    const translator: Translator = {
      metadata: {
        translatorID: 'test-z-getHiddenPref',
        label: 'Z.getHiddenPref Test',
        target: 'test\\.com',
        translatorType: 4,
        priority: 100,
        minVersion: '5.0',
      },
      code: `
function detectWeb(doc, url) {
  var attachSupp = Z.getHiddenPref('attachSupplementary');
  var autoSnap = Z.getHiddenPref('automaticSnapshots');
  var autoPDF = Z.getHiddenPref('automaticPDFs');

  if (attachSupp === false && autoSnap === false && autoPDF === true) {
    return "webpage";
  }
  return null;
}
      `,
    };

    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'http://test.com');

    const result = await executeDetectWeb(translator, doc, 'http://test.com', {
      DOMParser: (global as any).DOMParser,
      parseHTMLDocument,
    });

    expect(result).toBe('webpage');
  });

  test('Z.getOption should return undefined for unset options', async () => {
    const translator: Translator = {
      metadata: {
        translatorID: 'test-z-getOption',
        label: 'Z.getOption Test',
        target: 'test\\.com',
        translatorType: 4,
        priority: 100,
        minVersion: '5.0',
      },
      code: `
function detectWeb(doc, url) {
  var option = Z.getOption('someOption');
  if (option === undefined) {
    return "webpage";
  }
  return null;
}
      `,
    };

    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'http://test.com');

    const result = await executeDetectWeb(translator, doc, 'http://test.com', {
      DOMParser: (global as any).DOMParser,
      parseHTMLDocument,
    });

    expect(result).toBe('webpage');
  });

  test('Z.selectItems should work with callback', async () => {
    const translator: Translator = {
      metadata: {
        translatorID: 'test-z-selectItems',
        label: 'Z.selectItems Test',
        target: 'test\\.com',
        translatorType: 4,
        priority: 100,
        minVersion: '5.0',
      },
      code: `
function doWeb(doc, url) {
  var items = {
    'url1': 'Item 1',
    'url2': 'Item 2'
  };

  Z.selectItems(items, function(selectedItems) {
    if (selectedItems && selectedItems.url1 === 'Item 1') {
      var item = new Z.Item('webpage');
      item.title = 'Test Item';
      item.complete();
    }
  });
}
      `,
    };

    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'http://test.com');

    const items = await executeDoWeb(translator, doc, 'http://test.com', {
      DOMParser: (global as any).DOMParser,
      parseHTMLDocument,
    });

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Test Item');
  });

  test('Z.selectItems should work with promise (async)', async () => {
    const translator: Translator = {
      metadata: {
        translatorID: 'test-z-selectItems-async',
        label: 'Z.selectItems Async Test',
        target: 'test\\.com',
        translatorType: 4,
        priority: 100,
        minVersion: '5.0',
      },
      code: `
async function doWeb(doc, url) {
  var items = {
    'url1': 'Item 1',
    'url2': 'Item 2'
  };

  var selectedItems = await Z.selectItems(items);
  if (selectedItems && selectedItems.url1 === 'Item 1') {
    var item = new Z.Item('webpage');
    item.title = 'Async Test Item';
    item.complete();
  }
}
      `,
    };

    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'http://test.com');

    const items = await executeDoWeb(translator, doc, 'http://test.com', {
      DOMParser: (global as any).DOMParser,
      parseHTMLDocument,
    });

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Async Test Item');
  });

  test('Z.done should not crash', async () => {
    const translator: Translator = {
      metadata: {
        translatorID: 'test-z-done',
        label: 'Z.done Test',
        target: 'test\\.com',
        translatorType: 4,
        priority: 100,
        minVersion: '5.0',
      },
      code: `
function detectWeb(doc, url) {
  Z.done("webpage");
  return "webpage";
}
      `,
    };

    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'http://test.com');

    const result = await executeDetectWeb(translator, doc, 'http://test.com', {
      DOMParser: (global as any).DOMParser,
      parseHTMLDocument,
    });

    expect(result).toBe('webpage');
  });

  test('Z.logError should not crash', async () => {
    const translator: Translator = {
      metadata: {
        translatorID: 'test-z-logError',
        label: 'Z.logError Test',
        target: 'test\\.com',
        translatorType: 4,
        priority: 100,
        minVersion: '5.0',
      },
      code: `
function detectWeb(doc, url) {
  try {
    throw new Error("Test error");
  } catch (e) {
    Z.logError(e);
  }
  return "webpage";
}
      `,
    };

    const html = '<html><body><h1>Test</h1></body></html>';
    const doc = parseHTMLDocument(html, 'http://test.com');

    const result = await executeDetectWeb(translator, doc, 'http://test.com', {
      DOMParser: (global as any).DOMParser,
      parseHTMLDocument,
    });

    expect(result).toBe('webpage');
  });
});
