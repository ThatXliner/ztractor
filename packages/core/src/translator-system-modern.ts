/**
 * Modern Translator Execution System
 *
 * A clean, complete implementation of the Zotero translator system including:
 * - Sandbox management for secure code execution
 * - Translator loading and registry integration
 * - Full Zotero API (Item, Utilities, helper functions)
 * - Execution orchestration (detectWeb, doWeb)
 * - HTTP request handling
 * - Embedded translator support
 */

import type { ItemType, Translator } from './types';
import { Zotero } from './utilities-translate-bundle';

// ============================================================================
// SANDBOX MANAGER
// ============================================================================

interface SandboxGlobals {
  Zotero: Record<string, any>;
  Promise: PromiseConstructor;
  [key: string]: any;
}

export class SandboxManager {
  public sandbox: SandboxGlobals;

  constructor() {
    this.sandbox = {
      Zotero: {},
      Promise,
    };
  }

  /**
   * Evaluates code in the sandbox with controlled variable access
   */
  eval(code: string, functionNames: string[] = [], sourcePath?: string): void {
    // Clear any previously extracted functions
    functionNames.forEach(name => delete this.sandbox[name]);

    // Build the augmented code
    let augmentedCode = this.injectSandboxVariables(code);
    augmentedCode = this.addFunctionExtraction(augmentedCode, functionNames);
    augmentedCode = this.addSourceMapping(augmentedCode, sourcePath);

    // Execute in a closure bound to this sandbox manager
    this.executeInContext(augmentedCode);
  }

  /**
   * Inject sandbox properties as local variables
   */
  private injectSandboxVariables(code: string): string {
    const declarations = Object.keys(this.sandbox)
      .map(prop => `var ${prop} = this.sandbox.${prop};`)
      .join('');
    return declarations + code;
  }

  /**
   * Extract inner functions back into sandbox
   */
  private addFunctionExtraction(code: string, functionNames: string[]): string {
    const extractions = functionNames
      .filter(name => name !== 'detectExport') // Legacy filter
      .map(name => `this.sandbox.${name} = ${name};`)
      .join('\n');
    return extractions ? `${code}\n${extractions}` : code;
  }

  /**
   * Add source mapping for debugging
   */
  private addSourceMapping(code: string, sourcePath?: string): string {
    if (!sourcePath) return code;
    return `${code}\n//# sourceURL=${encodeURI(sourcePath)}\n`;
  }

  /**
   * Execute code in a closure bound to this sandbox manager
   */
  private executeInContext(code: string): void {
    const executor = function(this: SandboxManager) {
      eval(code);
    };
    executor.call(this);
  }

  /**
   * Import external object into sandbox with context preservation
   */
  importObject(
    object: Record<string, any>,
    contextArgument?: any,
    attachTo?: Record<string, any>
  ): void {
    const target = attachTo ?? this.sandbox.Zotero;

    // Collect all keys: own properties + prototype methods (excluding Object/Function builtins)
    const keys = new Set<string>();
    let proto = object;
    while (proto && proto !== Object.prototype && proto !== Function.prototype) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key !== 'constructor') keys.add(key);
      }
      proto = Object.getPrototypeOf(proto);
    }

    for (const key of keys) {
      const value = object[key];
      const valueType = typeof value;

      if (valueType === 'function') {
        target[key] = this.createWrapper(object, value, contextArgument);
      } else if (valueType === 'object' && value !== null) {
        target[key] = value;
      } else {
        target[key] = value;
      }
    }
  }

  /**
   * Create wrapper that preserves context and prepends arguments
   */
  private createWrapper(
    originalContext: any,
    fn: Function,
    prependedArg?: any
  ): Function {
    return function(...args: any[]) {
      const finalArgs = prependedArg !== undefined ? [prependedArg, ...args] : args;
      return fn.apply(originalContext, finalArgs);
    };
  }

  get<T = any>(key: string): T | undefined {
    return this.sandbox[key];
  }

  set(key: string, value: any): void {
    this.sandbox[key] = value;
  }

  reset(): void {
    const keysToKeep = new Set(['Zotero', 'Promise']);
    for (const key in this.sandbox) {
      if (!keysToKeep.has(key)) {
        delete this.sandbox[key];
      }
    }
    this.sandbox.Zotero = {};
  }
}

// ============================================================================
// ZOTERO API IMPLEMENTATION
// ============================================================================

/**
 * Zotero Item class that translators use to create metadata
 */
export class ZoteroItem {
  itemType: ItemType;
  [key: string]: any;

  private onComplete?: (item: ZoteroItem) => void;

  constructor(itemType: ItemType) {
    this.itemType = itemType;
    this.creators = [];
    this.tags = [];
    this.notes = [];
    this.attachments = [];
    this.seeAlso = [];
  }

  /**
   * Called by translators to finalize the item
   */
  complete(): void {
    if (this.onComplete) {
      // Clone the item data to prevent mutations
      const itemData: ZoteroItem = {
        itemType: this.itemType,
        ...this,
      };
      delete itemData.onComplete;
      this.onComplete(itemData);
    }
  }

  /**
   * Internal method to set completion callback
   */
  _setComplete(callback: (item: ZoteroItem) => void): void {
    this.onComplete = callback;
  }

  /**
   * Set a field in the extra property (Zotero 6+ API)
   * Source: translate.js:2263-2274
   */
  setExtra(field: string, value: string): void {
    const lines = String(this.extra || "").split("\n").filter((l: string) => l !== "");
    const existingIndex = lines.findIndex((line: string) => line.startsWith(field + ": "));
    if (existingIndex !== -1) {
      lines[existingIndex] = `${field}: ${value}`;
    } else {
      lines.push(`${field}: ${value}`);
    }
    this.extra = lines.join("\n");
  }
}

/**
 * Zotero Utilities (ZU) - Imported from original Zotero code
 *
 * We create a translate instance wrapper to access Zotero.Utilities.Translate
 * which contains all the helper functions translators need.
 */
function createZoteroUtilities() {
  // Create a minimal translate object to satisfy Zotero.Utilities.Translate constructor
  const mockTranslate = {
    _sandboxManager: null,
    _debug: (msg: string) => {
      if (typeof process !== 'undefined' && process.env?.DEBUG_TRANSLATORS) {
        console.log('[ZU]', msg);
      }
    }
  };

  // Create the utilities instance (has HTTP methods like request, doGet, etc.)
  const translateUtils = new (Zotero.Utilities as any).Translate(mockTranslate);

  // Mix in base Zotero.Utilities methods (cleanISBN, unescapeHTML, cleanDOI, etc.)
  // as own enumerable properties so object spread picks them up
  const baseUtils = Zotero.Utilities as any;
  for (const key of Object.getOwnPropertyNames(baseUtils)) {
    if (!Object.prototype.hasOwnProperty.call(translateUtils, key) && typeof baseUtils[key] === 'function') {
      translateUtils[key] = baseUtils[key].bind(baseUtils);
    }
  }

  // cleanTitle: collapse whitespace and strip trailing periods
  translateUtils.cleanTitle = function(title: string): string {
    return title.replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  };

  // cleanISBN: strip hyphens/spaces; return null (not false) for invalid, "" for empty
  const _baseCleanISBN = baseUtils.cleanISBN?.bind(baseUtils);
  if (_baseCleanISBN) {
    translateUtils.cleanISBN = function(isbnStr: string, dontValidate = true) {
      if (!isbnStr) return '';
      const result = _baseCleanISBN(isbnStr, dontValidate);
      return result === false ? null : result;
    };
  }

  // cleanISSN: return "" for empty; extract digits and format as ####-#### without checksum validation
  translateUtils.cleanISSN = function(issnStr: string): string | null {
    if (!issnStr) return '';
    // Extract 8 consecutive digits (ignoring separators and prefix text)
    const match = issnStr.replace(/[^0-9X]/gi, '').match(/^([0-9]{4})([0-9]{4})$/);
    if (!match) {
      // Try to find 8-digit sequence in the string
      const digits = issnStr.replace(/\s/g, '').match(/\d{4}-?\d{4}/);
      if (digits) {
        const clean = digits[0].replace('-', '');
        return clean.substring(0, 4) + '-' + clean.substring(4);
      }
      return null;
    }
    return match[1] + '-' + match[2];
  };

  // strToISO: return "" for empty; catch errors from uninitialized date formats
  const _baseStrToISO = (translateUtils.strToISO ?? baseUtils.strToISO)?.bind(translateUtils);
  if (_baseStrToISO) {
    translateUtils.strToISO = function(str: string) {
      if (!str) return '';
      try {
        const result = _baseStrToISO(str);
        return (result === false || result == null) ? false : result;
      } catch (_e) {
        return false;
      }
    };
  }

  // capitalizeTitle: force=true so it always capitalizes regardless of prefs
  const _baseCapitalizeTitle = translateUtils.capitalizeTitle?.bind(translateUtils);
  if (_baseCapitalizeTitle) {
    translateUtils.capitalizeTitle = function(title: string) {
      return _baseCapitalizeTitle(title, true);
    };
  }

  // cleanTags: strip HTML tags including self-closing ones, normalize whitespace, trim
  translateUtils.cleanTags = function(str: string): string {
    if (typeof str !== 'string') throw new Error('cleanTags: argument must be a string');
    if (!str) return '';
    return str
      .replace(/<[^>]+>/g, '')  // remove all tags (including self-closing)
      .replace(/\s+/g, ' ')
      .trim();
  };

  // slugify: not in Zotero, add as utility
  translateUtils.slugify = function(str: string): string {
    return str
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // parseQueryString: not in Zotero, add as utility
  translateUtils.parseQueryString = function(url: string): Record<string, string> {
    const result: Record<string, string> = {};
    try {
      const u = new URL(url);
      u.searchParams.forEach((value, key) => { result[key] = value; });
    } catch (_e) {
      // not a valid URL, try raw query string
      const qs = url.includes('?') ? url.split('?')[1] : url;
      for (const pair of qs.split('&')) {
        const [key, value] = pair.split('=');
        if (key) result[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
      }
    }
    return result;
  };

  return translateUtils;
}

// Export the utilities instance
export const ZoteroUtilities = createZoteroUtilities();

/**
 * XPath result type constants
 */
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

/**
 * Helper functions exposed to translators
 */
/**
 * attr(docOrElem, selector, attrName, index?) — Zotero-compatible 3/4-arg form
 * attr(element, attrName) — simplified 2-arg form
 */
function attr(docOrElem: Element | Document | null, selectorOrAttr: string, attrNameOrUndef?: string | number, index?: number): string | null {
  if (!docOrElem) return null;

  let elem: Element | null;
  let attrName: string;

  if (typeof attrNameOrUndef === 'string') {
    // 3/4-arg form: attr(doc, selector, attrName, index?)
    const selector = selectorOrAttr;
    attrName = attrNameOrUndef;
    if (typeof index === 'number') {
      elem = (docOrElem as Element).querySelectorAll(selector).item(index) as Element | null;
    } else {
      elem = (docOrElem as Element).querySelector(selector);
    }
  } else {
    // 2-arg form: attr(element, attrName)
    elem = docOrElem as Element;
    attrName = selectorOrAttr;
    if (typeof attrNameOrUndef === 'number') {
      // attr(node, attrName, index) — select nth element matching attrName
      const nodes = Array.from((docOrElem as Element).querySelectorAll(`[${attrName}]`));
      elem = nodes[attrNameOrUndef] ?? null;
    }
  }

  if (!elem) return null;
  return elem.getAttribute(attrName) ?? null;
}

/**
 * text(docOrElem, selector?, index?) — returns trimmed, whitespace-collapsed text content
 */
function text(node: Element | Document | null, selector?: string, index?: number): string | null {
  if (!node) return null;

  let elem: Element | null;
  if (selector) {
    if (typeof index === 'number') {
      elem = (node as Element).querySelectorAll(selector).item(index) as Element | null;
    } else {
      elem = (node as Element).querySelector(selector);
    }
  } else {
    elem = node as Element;
  }

  if (!elem) return null;
  const content = elem.textContent ?? '';
  return content.replace(/\s+/g, ' ').trim() || null;
}

/**
 * innerText(docOrElem, selector?, index?) — returns innerText with whitespace normalization
 * Mirrors Zotero's _innerText (translate.js:2199)
 */
function innerText(
  node: Element | Document | null,
  selector?: string,
  index?: number
): string | null {
  if (!node) return null;
  let elem: Element | null;
  if (selector) {
    if (typeof index === 'number') {
      elem = (node as Element).querySelectorAll(selector).item(index) as Element | null;
    } else {
      elem = (node as Element).querySelector(selector);
    }
  } else {
    elem = node as Element;
  }
  if (!elem) return null;
  const content = (elem as any).innerText ?? elem.textContent ?? '';
  return content.replace(/\s+/g, ' ').trim() || null;
}

// ============================================================================
// TRANSLATOR EXECUTOR
// ============================================================================

export interface TranslatorExecutorOptions {
  /**
   * Optional translator registry for loading embedded translators
   */
  getTranslatorById?: (id: string) => Promise<Translator | null>;

  /**
   * Optional DOM dependencies (for Node.js environment)
   */
  dependencies?: {
    DOMParser: any;
    parseHTMLDocument?: (html: string, url: string) => Document;
  };
}

/**
 * Main translator executor class
 */
export class TranslatorExecutor {
  private options: TranslatorExecutorOptions;

  constructor(options: TranslatorExecutorOptions = {}) {
    this.options = {
      ...options,
      dependencies: options.dependencies ?? {
        DOMParser: (globalThis as any).DOMParser,
      },
    };
  }

  /**
   * Execute detectWeb to check if translator can handle the page
   */
  async detectWeb(
    translator: Translator,
    doc: Document,
    url: string
  ): Promise<ItemType | false | null> {
    try {
      const sandbox = this.createSandbox(doc, url);

      // Execute translator code using Function constructor
      const fn = new Function(
        'doc',
        'url',
        'Zotero',
        'ZU',
        'Z',
        'attr',
        'text',
        'innerText',
        'request',
        'requestText',
        'requestJSON',
        'requestDocument',
        'XPathResult',
        'DOMParser',
        `
          ${translator.code}

          if (typeof detectWeb === 'function') {
            return detectWeb(doc, url);
          }
          return null;
        `
      );

      const dependencies = this.options.dependencies;
      const result = fn(
        doc,
        url,
        sandbox.Zotero,
        sandbox.ZU,
        sandbox.Zotero,  // Z = Zotero
        attr,
        text,
        innerText,
        sandbox.ZU.request?.bind(sandbox.ZU),
        sandbox.ZU.requestText?.bind(sandbox.ZU),
        sandbox.ZU.requestJSON?.bind(sandbox.ZU),
        sandbox.ZU.requestDocument?.bind(sandbox.ZU),
        XPathResult,
        dependencies?.DOMParser ?? (globalThis as any).DOMParser
      );

      return result;
    } catch (e) {
      console.error(`Error in detectWeb for ${translator.metadata.label}:`, e);
      return null;
    }
  }

  /**
   * Execute doWeb to extract metadata
   */
  async doWeb(
    translator: Translator,
    doc: Document,
    url: string
  ): Promise<ZoteroItem[]> {
    return new Promise((resolve) => {
      const items: ZoteroItem[] = [];
      const pendingWork: Promise<any>[] = [];

      try {
        const sandbox = this.createSandbox(doc, url, (item) => {
          items.push(item);
        }, pendingWork);

        // Execute translator code
        const fn = new Function(
          'doc',
          'url',
          'Zotero',
          'ZU',
          'Z',
          'attr',
          'text',
          'innerText',
          'request',
          'requestText',
          'requestJSON',
          'requestDocument',
          'XPathResult',
          'DOMParser',
          `
            ${translator.code}

            if (typeof doWeb === 'function') {
              const result = doWeb(doc, url);
              // If doWeb returns a promise, return it
              if (result && typeof result.then === 'function') {
                return result;
              }
            }
          `
        );

        const dependencies = this.options.dependencies;
        const result = fn(
          doc,
          url,
          sandbox.Zotero,
          sandbox.ZU,
          sandbox.Zotero,  // Z = Zotero
          attr,
          text,
          innerText,
          sandbox.ZU.request?.bind(sandbox.ZU),
          sandbox.ZU.requestText?.bind(sandbox.ZU),
          sandbox.ZU.requestJSON?.bind(sandbox.ZU),
          sandbox.ZU.requestDocument?.bind(sandbox.ZU),
          XPathResult,
          dependencies?.DOMParser ?? (globalThis as any).DOMParser
        );

        // Drain all pending work (async HTTP sub-requests, processDocuments, etc.)
        const settle = async () => {
          if (result && typeof result.then === 'function') await result;
          let prev = -1;
          while (pendingWork.length !== prev) {
            prev = pendingWork.length;
            await Promise.all(pendingWork);
          }
          resolve(items);
        };
        settle().catch((e: any) => {
          console.error(`Error in doWeb for ${translator.metadata.label}:`, e);
          resolve(items);
        });
      } catch (e) {
        console.error(`Error in doWeb for ${translator.metadata.label}:`, e);
        resolve([]);
      }
    });
  }

  /**
   * Create a sandboxed Zotero environment
   */
  private createSandbox(
    doc: Document,
    url: string,
    onItemComplete?: (item: ZoteroItem) => void,
    pendingWork?: Promise<any>[]
  ) {
    const dependencies = this.options.dependencies;

    // Create Item class with completion callback
    const ItemClass = class extends ZoteroItem {
      constructor(itemType: ItemType) {
        super(itemType);
        if (onItemComplete) {
          this._setComplete(onItemComplete);
        }
      }
    };

    // Wrap ZU to resolve relative URLs
    // Copy both own and prototype methods to ensure request*, doGet, doPost are accessible
    const wrappedZU: Record<string, any> = { ...ZoteroUtilities };
    // Copy prototype methods not already on the object (e.g. request, requestText, requestJSON, requestDocument)
    let proto = Object.getPrototypeOf(ZoteroUtilities);
    while (proto && proto !== Object.prototype) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key !== 'constructor' && !(key in wrappedZU)) {
          const val = (ZoteroUtilities as any)[key];
          if (typeof val === 'function') {
            wrappedZU[key] = val.bind(ZoteroUtilities);
          }
        }
      }
      proto = Object.getPrototypeOf(proto);
    }

    // Override doGet with proper callback-based implementation and pending-work tracking
    wrappedZU.doGet = function(
      urls: string | string[],
      processor?: (text: string, xmlhttp: any, url: string) => void,
      done?: () => void,
      _responseCharset?: string,
      _requestHeaders?: Record<string, string>,
      _successCodes?: number[]
    ): void {
      const urlList = typeof urls === 'string' ? [urls] : [...urls];
      const p = (async () => {
        for (const rawUrl of urlList) {
          let fetchUrl: string;
          try { fetchUrl = new URL(rawUrl, url).href; } catch (_e) { fetchUrl = rawUrl; }
          const resp = await fetch(fetchUrl);
          const responseText = await resp.text();
          const fakeXhr = { responseText, status: resp.status, responseURL: fetchUrl, getAllResponseHeaders: () => '' };
          if (processor) processor(responseText, fakeXhr, fetchUrl);
        }
        if (done) done();
      })();
      if (pendingWork) pendingWork.push(p);
    };

    // Override doPost with proper callback-based implementation and pending-work tracking
    wrappedZU.doPost = function(
      postUrl: string,
      body: string,
      onDone?: (text: string, xmlhttp: any) => void,
      headers?: Record<string, string>,
      _responseCharset?: string,
      _successCodes?: number[]
    ): void {
      let fetchUrl: string;
      try { fetchUrl = new URL(postUrl, url).href; } catch (_e) { fetchUrl = postUrl; }
      const p = (async () => {
        const resp = await fetch(fetchUrl, { method: 'POST', body, headers });
        const responseText = await resp.text();
        const fakeXhr = { responseText, status: resp.status, responseURL: fetchUrl, getAllResponseHeaders: () => '' };
        if (onDone) onDone(responseText, fakeXhr);
      })();
      if (pendingWork) pendingWork.push(p);
    };

    // Implement processDocuments with pending-work tracking
    wrappedZU.processDocuments = function(
      urls: string | string[],
      processor: (doc: Document, url: string) => void | Promise<void>,
      _noCompleteOnError?: boolean
    ): void {
      const urlList = typeof urls === 'string' ? [urls] : [...urls];
      const p = (async () => {
        for (const rawUrl of urlList) {
          let fetchUrl: string;
          try { fetchUrl = new URL(rawUrl, url).href; } catch (_e) { fetchUrl = rawUrl; }
          const resp = await fetch(fetchUrl);
          const html = await resp.text();
          let fetchedDoc: Document;
          if (dependencies?.parseHTMLDocument) {
            fetchedDoc = dependencies.parseHTMLDocument(html, fetchUrl);
          } else {
            const parser = new (dependencies?.DOMParser ?? globalThis.DOMParser)();
            fetchedDoc = parser.parseFromString(html, 'text/html');
            // Attach mock location for translators that read doc.location.href
            try { Object.defineProperty(fetchedDoc, 'location', { value: { href: fetchUrl }, configurable: true }); } catch(_e) {}
          }
          await processor(fetchedDoc, fetchUrl);
        }
      })();
      if (pendingWork) pendingWork.push(p);
    };

    const Zotero = {
      Item: ItemClass,
      Utilities: wrappedZU,
      isConnector: false,
      isServer: false,
      isBookmarklet: false,
      parentTranslator: null,

      /**
       * Select items for 'multiple' type
       */
      selectItems(
        itemList: Record<string, string>,
        callback: (selected: Record<string, string> | null) => void
      ) {
        // Auto-select all items (in real browser extension, this shows a dialog)
        callback(itemList);
      },

      /**
       * Load embedded translator
       */
      loadTranslator: (type: string) => {
        return this.createTranslatorLoader(doc, url, onItemComplete, pendingWork);
      },

      /**
       * Debug logging
       */
      debug(message: string) {
        if (typeof process !== 'undefined' && process.env?.DEBUG_TRANSLATORS) {
          console.log('[Translator]', message);
        }
      },

      // No-op compatibility stubs
      done() {},
      wait() {},
    };

    // ZU.HTTP alias (translate.js:2143)
    (wrappedZU as any).HTTP = wrappedZU;

    return {
      Zotero,
      ZU: wrappedZU,
    };
  }

  /**
   * Create a translator loader for embedded translators
   */
  private createTranslatorLoader(
    doc: Document,
    url: string,
    onItemComplete?: (item: ZoteroItem) => void,
    pendingWork?: Promise<any>[]
  ) {
    const executor = this;  // Capture before returning object literal
    let translatorId: string | null = null;
    let translatorDoc: Document = doc;
    const handlers: Record<string, Function> = {};

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

      async getTranslatorObject(callback: Function) {
        if (!translatorId || !executor.options.getTranslatorById) {
          try { callback({}); } catch (_e) {}
          return;
        }

        try {
          const embeddedTranslator = await executor.options.getTranslatorById(translatorId);
          if (!embeddedTranslator) {
            console.warn(`Embedded translator ${translatorId} not found`);
            try { callback({}); } catch (_e) {}
            return;
          }

          // Create sandbox for embedded translator
          const embeddedSandbox = executor.createSandbox(translatorDoc, url, (item) => {
            if (handlers.itemDone) {
              // Attach no-op complete() so itemDone handlers can safely call item.complete()
              // (matches Zotero translate.js line 393-395 behavior)
              if (typeof item.complete !== 'function') item.complete = () => {};
              handlers.itemDone(null, item);
            }
            if (onItemComplete) {
              onItemComplete(item);
            }
          }, pendingWork);  // Thread pendingWork through

          // Build function with full parameter list matching doWeb sandbox
          const fn = new Function(
            'Zotero', 'ZU', 'Z', 'attr', 'text', 'innerText',
            'request', 'requestText', 'requestJSON', 'requestDocument',
            'XPathResult', 'DOMParser',
            embeddedTranslator.code + '\nreturn { detectWeb: (typeof detectWeb !== "undefined" ? detectWeb : undefined), doWeb: (typeof doWeb !== "undefined" ? doWeb : undefined) };'
          );

          const embeddedDeps = executor.options.dependencies;
          const transObj = fn(
            embeddedSandbox.Zotero, embeddedSandbox.ZU, embeddedSandbox.Zotero,
            attr, text, innerText,
            embeddedSandbox.ZU.request?.bind(embeddedSandbox.ZU),
            embeddedSandbox.ZU.requestText?.bind(embeddedSandbox.ZU),
            embeddedSandbox.ZU.requestJSON?.bind(embeddedSandbox.ZU),
            embeddedSandbox.ZU.requestDocument?.bind(embeddedSandbox.ZU),
            XPathResult,
            embeddedDeps?.DOMParser ?? (globalThis as any).DOMParser
          );

          try { callback(transObj); } catch (_e) {}
        } catch (e) {
          console.error('Error in getTranslatorObject:', e);
          try { callback({}); } catch (_e) {}
        }
      },

      async translate() {
        if (!translatorId || !executor.options.getTranslatorById) return;
        try {
          const embeddedTranslator = await executor.options.getTranslatorById(translatorId);
          if (!embeddedTranslator) return;
          const p = executor.doWeb(embeddedTranslator, translatorDoc, url)
            .then(subItems => {
              for (const item of subItems) {
                if (handlers.itemDone) {
                  // Attach no-op complete() so itemDone handlers can safely call item.complete()
                  // (matches Zotero translate.js line 393-395 behavior)
                  if (typeof item.complete !== 'function') item.complete = () => {};
                  handlers.itemDone(null, item);
                }
                if (onItemComplete) onItemComplete(item);
              }
            });
          if (pendingWork) pendingWork.push(p);
          // Note: we both push to pendingWork (so the outer doWeb drain loop
          // waits for completion) AND await here (so translate() callers who
          // await the result get correct sequencing). The double-track is
          // intentional — pendingWork handles fire-and-forget callers,
          // await handles callers who chain on translate().
          await p;
        } catch (e) {
          console.error('Error in translate() for embedded translator:', e);
        }
      },
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { attr, text, innerText, ZoteroUtilities as ZU, XPathResult };
