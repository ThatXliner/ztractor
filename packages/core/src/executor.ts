/**
 * Translator executor - browser version using native DOM APIs
 */

import { Item } from './item';
import type { Translator, ZoteroItem, ItemType, ExtractMetadataOptions } from './types';
import type { TranslatorRegistryEntry } from './translators-registry';

type ExecutorDependencies = NonNullable<ExtractMetadataOptions['dependencies']>;

/**
 * Lazy-loaded translator registry functions
 */
let getTranslatorByIdFn: ((id: string) => TranslatorRegistryEntry | null) | null = null;

/**
 * Load the translators registry
 */
async function loadTranslatorsRegistry(): Promise<void> {
  if (!getTranslatorByIdFn) {
    const module = await import('./translators-registry');
    getTranslatorByIdFn = module.getTranslatorById;
  }
}

/**
 * Get a translator by ID from the registry
 */
async function getTranslatorById(translatorId: string): Promise<Translator | null> {
  await loadTranslatorsRegistry();
  const entry = getTranslatorByIdFn!(translatorId);
  if (!entry) return null;
  return {
    metadata: entry.metadata,
    code: entry.code,
  };
}

/**
 * HTTP request functions for translators
 */
export async function request(
  url: string,
  options?: RequestInit
): Promise<{ body: string; status: number; headers: Headers }> {
  const response = await fetch(url, options);
  const body = await response.text();
  return {
    body,
    status: response.status,
    headers: response.headers,
  };
}

export async function requestText(
  url: string,
  options?: RequestInit
): Promise<string> {
  const response = await fetch(url, options);
  return response.text();
}

export async function requestJSON(
  url: string,
  options?: RequestInit
): Promise<any> {
  const response = await fetch(url, options);
  return response.json();
}

export async function requestDocument(
  url: string,
  options?: RequestInit
): Promise<Document> {
  const html = await requestText(url, options);
  // This will be handled by the executor with proper DOM parsing
  throw new Error('requestDocument must be handled by executor');
}

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

    // Create XPathResult constant
    const XPathResult = {
      ANY_TYPE: 0,
      NUMBER_TYPE: 1,
      STRING_TYPE: 2,
      BOOLEAN_TYPE: 3,
      UNORDERED_NODE_ITERATOR_TYPE: 4,
      ORDERED_NODE_ITERATOR_TYPE: 5,
      UNORDERED_NODE_SNAPSHOT_TYPE: 6,
      ORDERED_NODE_SNAPSHOT_TYPE: 7,
      ANY_UNORDERED_NODE_TYPE: 8,
      FIRST_ORDERED_NODE_TYPE: 9,
    };

    const exports = {};
    const Z = sandbox.Zotero;

    // Use Function constructor to execute in controlled scope
    const code = `
      ${translatorCode}

      // Return detectWeb function
      if (typeof detectWeb === 'function') {
        return detectWeb(doc, url);
      }
      return null;
    `;

    const fn = new Function('doc', 'url', 'Zotero', 'ZU', 'attr', 'text', 'DOMParser', 'XPathResult', 'exports', 'Z', code);
    const result = fn(doc, url, sandbox.Zotero, sandbox.ZU, attr, text, dependencies.DOMParser, XPathResult, exports, Z);

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

      // Create XPathResult constant
      const XPathResult = {
        ANY_TYPE: 0,
        NUMBER_TYPE: 1,
        STRING_TYPE: 2,
        BOOLEAN_TYPE: 3,
        UNORDERED_NODE_ITERATOR_TYPE: 4,
        ORDERED_NODE_ITERATOR_TYPE: 5,
        UNORDERED_NODE_SNAPSHOT_TYPE: 6,
        ORDERED_NODE_SNAPSHOT_TYPE: 7,
        ANY_UNORDERED_NODE_TYPE: 8,
        FIRST_ORDERED_NODE_TYPE: 9,
      };

      const exports = {};
      const Z = sandbox.Zotero;

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
        'XPathResult',
        'exports',
        'Z',
        code
      );

      fn(doc, url, sandbox.Zotero, sandbox.ZU, attr, text, request, requestText, requestJSON, dependencies.DOMParser, XPathResult, exports, Z);

      // Give translators time to complete async operations
      // TODO: Implement proper promise tracking instead of fixed timeout
      // Translators using processDocuments() or multiple async requests need more time
      setTimeout(() => {
        resolve(items);
      }, 30000); // 30 seconds timeout (increased from 100ms to support async operations)
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

  // Create a wrapped ZU that resolves relative URLs and includes translate utilities
  const wrappedZU = {
    ...ZU,
    ...TranslateUtils, // Add all translate-specific utilities (processDocuments, requestDocument, getItemArray, etc.)
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
       * Load a translator by ID (supports embedded translators)
       */
      loadTranslator(type: string) {
        let translatorId: string | null = null;
        let translatorDoc: Document = doc;
        let translatorUrl: string = url;
        const handlers: Record<string, Function> = {};
        let searchData: any = null;

        return {
          setTranslator(id: string) {
            translatorId = id;
          },
          setDocument(newDoc: Document) {
            translatorDoc = newDoc;
          },
          setHandler(event: string, handler: Function) {
            handlers[event] = handler;
          },
          setSearch(search: any) {
            // Store search data (used for search translators)
            // Search format: { itemType: "journalArticle", DOI: "10.1234/test" }
            searchData = search;
          },
          async getTranslatorObject(callback: Function) {
            if (!translatorId) {
              callback({});
              return;
            }

            try {
              // Load the embedded translator
              const embeddedTranslator = await getTranslatorById(translatorId);
              if (!embeddedTranslator) {
                console.warn(`Embedded translator ${translatorId} not found`);
                callback({});
                return;
              }

              // Create a sandbox for the embedded translator
              const embeddedSandbox = createSandbox(
                translatorDoc,
                translatorUrl,
                (item) => {
                  // Call itemDone handler if set
                  if (handlers.itemDone) {
                    handlers.itemDone(null, item);
                  }
                  // Also add to main items array
                  if (onItemComplete) {
                    onItemComplete(item);
                  }
                },
                dependencies
              );

              // Execute the embedded translator code to define its functions
              const embeddedCode = embeddedTranslator.code;

              // Create XPathResult constant for translators that use it
              const XPathResult = {
                ANY_TYPE: 0,
                NUMBER_TYPE: 1,
                STRING_TYPE: 2,
                BOOLEAN_TYPE: 3,
                UNORDERED_NODE_ITERATOR_TYPE: 4,
                ORDERED_NODE_ITERATOR_TYPE: 5,
                UNORDERED_NODE_SNAPSHOT_TYPE: 6,
                ORDERED_NODE_SNAPSHOT_TYPE: 7,
                ANY_UNORDERED_NODE_TYPE: 8,
                FIRST_ORDERED_NODE_TYPE: 9,
              };

              // Create exports object for translators that use it
              const exports = {};

              // Create Z object stub (Zotero internal object)
              const Z = embeddedSandbox.Zotero;

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
                'XPathResult',
                'exports',
                'Z',
                'searchData',
                `
                ${embeddedCode}

                // Return object with detectWeb and doWeb
                // For search translators, also include detectSearch
                return {
                  detectWeb: typeof detectWeb !== 'undefined' ? detectWeb : null,
                  doWeb: typeof doWeb !== 'undefined' ? doWeb : null,
                  detectSearch: typeof detectSearch !== 'undefined' ? detectSearch : null,
                  itemType: exports.itemType || null
                };
              `
              );

              const translatorObject = fn(
                translatorDoc,
                translatorUrl,
                embeddedSandbox.Zotero,
                embeddedSandbox.ZU,
                attr,
                text,
                request,
                requestText,
                requestJSON,
                dependencies.DOMParser,
                XPathResult,
                exports,
                Z,
                searchData
              );

              callback(translatorObject);
            } catch (e) {
              console.error('Error loading embedded translator:', e);
              callback({});
            }
          },
          translate() {
            // Legacy method, usually not needed when using getTranslatorObject
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
