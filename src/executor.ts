/**
 * Translator executor - runs translator code in a sandboxed environment
 */

import { parseHTML } from 'linkedom';
import { Item } from './item';
import { ZU, attr, text, request, requestText, requestJSON } from './utilities';
import type { Translator, ZoteroItem, ItemType } from './types';

/**
 * Execute a translator's detectWeb function
 */
export async function executeDetectWeb(
  translator: Translator,
  doc: Document,
  url: string
): Promise<ItemType | false | null> {
  try {
    // Create sandbox environment
    const sandbox = createSandbox(doc, url);

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

    const fn = new Function('doc', 'url', 'Zotero', 'ZU', 'attr', 'text', code);
    const result = fn(doc, url, sandbox.Zotero, ZU, attr, text);

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
  url: string
): Promise<ZoteroItem[]> {
  return new Promise((resolve, reject) => {
    const items: ZoteroItem[] = [];

    try {
      // Create sandbox environment
      const sandbox = createSandbox(doc, url, (item) => {
        items.push(item);
      });

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
        code
      );

      fn(doc, url, sandbox.Zotero, ZU, attr, text, request, requestText, requestJSON);

      // Give translators a moment to complete async operations
      setTimeout(() => {
        resolve(items);
      }, 100);
    } catch (e) {
      console.error(`Error executing doWeb for ${translator.metadata.label}:`, e);
      reject(e);
    }
  });
}

/**
 * Create a sandboxed Zotero environment for translator execution
 */
function createSandbox(
  doc: Document,
  url: string,
  onItemComplete?: (item: ZoteroItem) => void
) {
  const items: Item[] = [];
  let selectItemsCallback: ((items: Record<string, string>) => void) | null = null;

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
        if (process.env.DEBUG_TRANSLATORS) {
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

    // Zotero Utilities
    ZU,

    // Helper functions
    attr,
    text,

    // HTTP functions
    request,
    requestText,
    requestJSON,

    // Global document and URL
    doc,
    url,
  };

  return sandbox;
}

/**
 * Parse HTML string into a Document
 */
export function parseHTMLDocument(html: string, url: string): Document {
  const { document } = parseHTML(html);

  // Add URL to document
  Object.defineProperty(document, 'URL', {
    value: url,
    writable: false,
  });

  Object.defineProperty(document, 'documentURI', {
    value: url,
    writable: false,
  });

  return document as unknown as Document;
}
