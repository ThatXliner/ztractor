/**
 * Translator executor - browser version using native DOM APIs
 */

import { Item } from './item';
import { ZU, attr, text, request, requestText, requestJSON } from './utilities';
import type { Translator, ZoteroItem, ItemType, ExtractMetadataOptions } from './types';

type ExecutorDependencies = NonNullable<ExtractMetadataOptions['dependencies']>;

/**
 * Execute a translator's detectWeb function
 */
export async function executeDetectWeb(
  translator: Translator,
  doc: Document,
  url: string,
  dependencies: ExecutorDependencies = { DOMParser: (globalThis as any).DOMParser }
): Promise<ItemType | false | null> {
  try {
    // Create sandbox environment
    const sandbox = createSandbox(doc, url, undefined, dependencies);

    // Execute translator code to define detectWeb
    const translatorCode = translator.code;

    // Use Function constructor to execute in controlled scope
    const code = `
      ${translatorCode}

      // Return detectWeb function
      if (typeof detectWeb === 'function') {
        return detectWeb(doc, url);
      }
      return null;
    `;

    const fn = new Function('doc', 'url', 'Zotero', 'ZU', 'attr', 'text', 'DOMParser', code);
    const result = fn(doc, url, sandbox.Zotero, sandbox.ZU, attr, text, dependencies.DOMParser);

    return result;
  } catch (e) {
    console.error(`Error executing detectWeb for ${translator.metadata.label}:`, e);
    return null;
  }
}

/**
 * Execute a translator's doWeb function
 */
export async function executeDoWeb(
  translator: Translator,
  doc: Document,
  url: string,
  dependencies: ExecutorDependencies = { DOMParser: (globalThis as any).DOMParser }
): Promise<ZoteroItem[]> {
  return new Promise((resolve, reject) => {
    const items: ZoteroItem[] = [];

    try {
      // Create sandbox environment
      const sandbox = createSandbox(doc, url, (item) => {
        items.push(item);
      }, dependencies);

      // Execute translator code
      const translatorCode = translator.code;

      const code = `
        ${translatorCode}

        // Execute doWeb
        if (typeof doWeb === 'function') {
          doWeb(doc, url);
        }
      `;

      const fn = new Function(
        'doc',
        'url',
        'Zotero',
        'ZU',
        'attr',
        'text',
        'request',
        'requestText',
        'requestJSON',
        'DOMParser',
        code
      );

      fn(doc, url, sandbox.Zotero, sandbox.ZU, attr, text, request, requestText, requestJSON, dependencies.DOMParser);

      // Give translators a moment to complete async operations
      setTimeout(() => {
        resolve(items);
      }, 100);
    } catch (e) {
      console.error(`Error executing doWeb for ${translator.metadata.label}:`, e);
      // Return empty array on error instead of rejecting
      resolve([]);
    }
  });
}

/**
 * Create a sandboxed Zotero environment for translator execution
 */
function createSandbox(
  doc: Document,
  url: string,
  onItemComplete?: (item: ZoteroItem) => void,
  dependencies: ExecutorDependencies = { DOMParser: (globalThis as any).DOMParser }
) {
  const items: Item[] = [];
  let selectItemsCallback: ((items: Record<string, string>) => void) | null = null;

  // Create a wrapped ZU that resolves relative URLs
  const wrappedZU = {
    ...ZU,
    async doGet(requestUrl: string, done?: (text: string) => void): Promise<string> {
      // Resolve relative URLs against the page URL
      const absoluteUrl = requestUrl.startsWith('/') || requestUrl.startsWith('./')
        ? new URL(requestUrl, url).href
        : requestUrl;
      return ZU.doGet(absoluteUrl, done);
    },
    async doPost(requestUrl: string, body: string, done?: (text: string) => void): Promise<string> {
      // Resolve relative URLs against the page URL
      const absoluteUrl = requestUrl.startsWith('/') || requestUrl.startsWith('./')
        ? new URL(requestUrl, url).href
        : requestUrl;
      return ZU.doPost(absoluteUrl, body, done);
    },
  };

  const sandbox = {
    Zotero: {
      /**
       * Create a new item
       */
      Item: class extends Item {
        constructor(itemType: ItemType) {
          super(itemType);
          if (onItemComplete) {
            this.setComplete(onItemComplete);
          }
          items.push(this);
        }
      },

      /**
       * Select items (for 'multiple' type)
       */
      selectItems(
        itemList: Record<string, string>,
        callback: (selectedItems: Record<string, string> | null) => void
      ) {
        // In a real browser extension, this would show a dialog
        // For our purposes, we'll select all items
        callback(itemList);
      },

      /**
       * Load a translator by ID
       */
      loadTranslator(type: string) {
        return {
          setTranslator(id: string) {
            // Store translator ID for loading
          },
          setDocument(doc: Document) {
            // Store document
          },
          setHandler(event: string, handler: Function) {
            // Store event handler
          },
          getTranslatorObject(callback: Function) {
            // Return translator object
            callback({});
          },
          translate() {
            // Execute translation
          },
        };
      },

      /**
       * Debug logging
       */
      debug(message: string) {
        // Check if we're in a debug mode (browser doesn't have process.env)
        if (typeof process !== 'undefined' && process.env?.DEBUG_TRANSLATORS) {
          console.log('[Translator Debug]', message);
        }
      },

      /**
       * Get items array
       */
      getItems() {
        return items;
      },
    },
  };

  return {
    Zotero: sandbox.Zotero,
    ZU: wrappedZU,
    attr,
    text,
    request,
    requestText,
    requestJSON,
    doc,
    url,
  };
}

/**
 * Parse HTML string into a Document with XPath support
 * Browser version uses native DOMParser and document.evaluate
 */
export function parseHTMLDocument(html: string, url: string, dependencies: ExecutorDependencies = { DOMParser: (globalThis as any).DOMParser }): Document {
  if (dependencies.parseHTMLDocument) {
    return dependencies.parseHTMLDocument(html, url);
  }

  const parser = new dependencies.DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Create a location-like object
  const urlObj = new URL(url);
  const location = {
    href: url,
    protocol: urlObj.protocol,
    host: urlObj.host,
    hostname: urlObj.hostname,
    port: urlObj.port,
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
    origin: urlObj.origin,
  };

  // Add URL to document (browsers may already have this, but ensure it's set)
  try {
    Object.defineProperty(doc, 'URL', {
      value: url,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(doc, 'documentURI', {
      value: url,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(doc, 'location', {
      value: location,
      writable: false,
      configurable: true,
    });
  } catch (e) {
    // Properties may already exist in browser, ignore errors
  }

  // Browsers already have native document.evaluate() for XPath!
  // No need to install custom XPath support

  return doc;
}
