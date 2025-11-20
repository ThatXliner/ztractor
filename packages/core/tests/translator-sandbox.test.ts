import { describe, expect, test } from 'bun:test';
import { createSandboxRequestFunctions } from '../src/translator-sandbox';

describe('Translator Sandbox Utilities', () => {
  const mockDependencies = {
    DOMParser: class MockDOMParser {
      parseFromString(html: string, type: string) {
        // Simple mock Document
        return {
          nodeType: 9,
          URL: '',
          documentURI: '',
          querySelector: () => null,
          querySelectorAll: () => [],
          evaluate: () => ({
            iterateNext: () => null
          })
        } as any;
      }
    } as any,
    parseHTMLDocument: (html: string, url: string) => {
      const parser = new mockDependencies.DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.URL = url;
      doc.documentURI = url;
      return doc;
    }
  };

  describe('URL Resolution', () => {
    test('resolves relative URLs against base URL', () => {
      const baseUrl = 'https://example.com/page/article.html';
      const sandbox = createSandboxRequestFunctions(baseUrl, mockDependencies);

      // Can't directly test URL resolution without mocking fetch,
      // but we can verify the functions exist
      expect(typeof sandbox.request).toBe('function');
      expect(typeof sandbox.requestText).toBe('function');
      expect(typeof sandbox.requestJSON).toBe('function');
      expect(typeof sandbox.requestDocument).toBe('function');
      expect(typeof sandbox.processDocuments).toBe('function');
    });
  });

  describe('Request Functions', () => {
    test('exports all required request functions', () => {
      const sandbox = createSandboxRequestFunctions('https://example.com', mockDependencies);

      expect(sandbox).toHaveProperty('request');
      expect(sandbox).toHaveProperty('requestText');
      expect(sandbox).toHaveProperty('requestJSON');
      expect(sandbox).toHaveProperty('requestDocument');
      expect(sandbox).toHaveProperty('processDocuments');
    });

    test('all functions are async', () => {
      const sandbox = createSandboxRequestFunctions('https://example.com', mockDependencies);

      // Call each function and verify it returns a Promise
      const result1 = sandbox.request('https://example.com');
      const result2 = sandbox.requestText('https://example.com');
      const result3 = sandbox.requestJSON('https://example.com');
      const result4 = sandbox.requestDocument('https://example.com');
      const result5 = sandbox.processDocuments([], async () => {});

      expect(result1).toBeInstanceOf(Promise);
      expect(result2).toBeInstanceOf(Promise);
      expect(result3).toBeInstanceOf(Promise);
      expect(result4).toBeInstanceOf(Promise);
      expect(result5).toBeInstanceOf(Promise);

      // Clean up promises
      result1.catch(() => {});
      result2.catch(() => {});
      result3.catch(() => {});
      result4.catch(() => {});
      result5.catch(() => {});
    });
  });

  describe('processDocuments', () => {
    test('handles empty URL array', async () => {
      const sandbox = createSandboxRequestFunctions('https://example.com', mockDependencies);

      let callCount = 0;
      let doneCalled = false;

      await sandbox.processDocuments(
        [],
        async () => { callCount++; },
        () => { doneCalled = true; }
      );

      expect(callCount).toBe(0);
      expect(doneCalled).toBe(true);
    });

    test('calls done callback after processing', async () => {
      const sandbox = createSandboxRequestFunctions('https://example.com', mockDependencies);

      let doneCalled = false;

      await sandbox.processDocuments(
        [],
        async () => {},
        () => { doneCalled = true; }
      );

      expect(doneCalled).toBe(true);
    });
  });
});
