/**
 * Translator executor - browser version using native DOM APIs
 */

import { Item } from './item';
import { ZU, attr, text } from './utilities';
import { createSandboxRequestFunctions } from './translator-sandbox';
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

    const fn = new Function(
      'doc',
      'url',
      'Zotero',
      'Z',
      'ZU',
      'attr',
      'text',
      'request',
      'requestText',
      'requestJSON',
      'requestDocument',
      'DOMParser',
      code
    );
    const result = fn(
      doc,
      url,
      sandbox.Zotero,
      sandbox.Zotero,
      sandbox.ZU,
      attr,
      text,
      sandbox.request,
      sandbox.requestText,
      sandbox.requestJSON,
      sandbox.requestDocument,
      dependencies.DOMParser
    );

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
        'Z',
        'ZU',
        'attr',
        'text',
        'request',
        'requestText',
        'requestJSON',
        'requestDocument',
        'DOMParser',
        code
      );

      fn(
        doc,
        url,
        sandbox.Zotero,
        sandbox.Zotero,
        sandbox.ZU,
        attr,
        text,
        sandbox.request,
        sandbox.requestText,
        sandbox.requestJSON,
        sandbox.requestDocument,
        dependencies.DOMParser
      );

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

  // Create wrapped request functions from centralized module
  const sandboxRequests = createSandboxRequestFunctions(url, dependencies);

  // Create a wrapped ZU that resolves relative URLs
  const wrappedZU = {
    ...ZU,
    // Inject processDocuments from sandbox utilities
    processDocuments: sandboxRequests.processDocuments,
    // Wrap legacy doGet/doPost for relative URL resolution
    async doGet(requestUrl: string, done?: (text: string) => void): Promise<string> {
      const absoluteUrl = requestUrl.startsWith('/') || requestUrl.startsWith('./')
        ? new URL(requestUrl, url).href
        : requestUrl;
      return ZU.doGet(absoluteUrl, done);
    },
    async doPost(requestUrl: string, body: string, done?: (text: string) => void): Promise<string> {
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
       * Returns a promise if no callback is provided
       */
      selectItems(
        itemList: Record<string, string>,
        callback?: (selectedItems: Record<string, string> | null) => void
      ) {
        // In a real browser extension, this would show a dialog
        // For our purposes, we'll select all items
        if (callback) {
          callback(itemList);
        } else {
          return Promise.resolve(itemList);
        }
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
      debug(message: string, level?: number) {
        // Check if we're in a debug mode (browser doesn't have process.env)
        if (typeof process !== 'undefined' && process.env?.DEBUG_TRANSLATORS) {
          const logLevel = level !== undefined ? level : 3;
          console.log(`[Translator Debug:${logLevel}]`, message);
        }
      },

      /**
       * Get hidden preference value
       */
      getHiddenPref(pref: string): any {
        // Hidden preferences can be used for translator-specific configuration
        // For now, return sensible defaults
        const prefs: Record<string, any> = {
          'attachSupplementary': false, // Don't attach supplementary materials by default
          'supplementaryAsLink': false, // Don't use links for supplementary materials
          'automaticSnapshots': false, // Don't create automatic snapshots
          'automaticPDFs': true, // Do download PDFs when available
        };
        return prefs[pref];
      },

      /**
       * Get translator option value
       */
      getOption(option: string): any {
        // Translator options would be set via displayOptions in translator metadata
        // For now, return undefined (no options set)
        return undefined;
      },

      /**
       * Set detection return value for async detection
       */
      done(returnValue?: any) {
        // This is used in async detectWeb implementations
        // For our synchronous approach, this is a no-op
        return returnValue;
      },

      /**
       * Log an error
       */
      logError(err: Error) {
        console.error('[Translator Error]', err);
      },

      /**
       * Get items array
       */
      getItems() {
        return items;
      },
    },
  };

  // Create wrapped request functions with relative URL resolution
  const wrappedRequest = async (requestUrl: string, options?: RequestInit) => {
    const absoluteUrl = requestUrl.startsWith('/') || requestUrl.startsWith('./')
      ? new URL(requestUrl, url).href
      : requestUrl;
    return request(absoluteUrl, options);
  };

  const wrappedRequestText = async (requestUrl: string, options?: RequestInit) => {
    const absoluteUrl = requestUrl.startsWith('/') || requestUrl.startsWith('./')
      ? new URL(requestUrl, url).href
      : requestUrl;
    return requestText(absoluteUrl, options);
  };

  const wrappedRequestJSON = async (requestUrl: string, options?: RequestInit) => {
    const absoluteUrl = requestUrl.startsWith('/') || requestUrl.startsWith('./')
      ? new URL(requestUrl, url).href
      : requestUrl;
    return requestJSON(absoluteUrl, options);
  };

  const wrappedRequestDocument = async (requestUrl: string, options?: RequestInit): Promise<Document> => {
    // Resolve relative URLs
    const absoluteUrl = requestUrl.startsWith('/') || requestUrl.startsWith('./')
      ? new URL(requestUrl, url).href
      : requestUrl;

    // Fetch and parse
    const html = await fetch(absoluteUrl, options).then(r => r.text());
    return parseHTMLDocument(html, absoluteUrl, dependencies);
  };

  return {
    Zotero: sandbox.Zotero,
    ZU: wrappedZU,
    attr,
    text,
    request: wrappedRequest,
    requestText: wrappedRequestText,
    requestJSON: wrappedRequestJSON,
    requestDocument: wrappedRequestDocument,
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
