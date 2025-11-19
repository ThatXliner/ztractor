/**
 * Zotero Utilities (ZU) - Essential helper functions for translators
 */

import type { Creator } from './types';

export const ZU = {
  /**
   * Extract text content using XPath
   */
  xpathText(node: Node | Document, xpath: string, index?: number): string | null {
    const results = this.xpath(node, xpath);
    if (!results || results.length === 0) return null;

    const idx = index !== undefined ? index : 0;
    const result = results[idx];
    if (!result) return null;

    return result.textContent ? this.trimInternal(result.textContent) : null;
  },

  /**
   * Execute XPath query and return nodes
   */
  xpath(node: Node | Document, xpath: string): Node[] {
    const doc = node.nodeType === 9 ? (node as Document) : node.ownerDocument;
    if (!doc) return [];

    try {
      const nsResolver = doc.createNSResolver?.(
        doc.documentElement || (doc as any)
      );
      const result = doc.evaluate(
        xpath,
        node,
        nsResolver,
        XPathResult.ANY_TYPE,
        null
      );

      const nodes: Node[] = [];
      let item = result.iterateNext();
      while (item) {
        nodes.push(item);
        item = result.iterateNext();
      }
      return nodes;
    } catch (e) {
      console.error('XPath error:', e);
      return [];
    }
  },

  /**
   * Trim internal whitespace (collapse multiple spaces)
   */
  trimInternal(str: string): string {
    return str.replace(/\s+/g, ' ').trim();
  },

  /**
   * Clean author name and parse into first/last name
   */
  cleanAuthor(
    author: string | { firstName?: string; lastName?: string; name?: string },
    creatorType: string = 'author',
    useComma: boolean = false
  ): Creator {
    if (typeof author === 'object') {
      return {
        ...author,
        creatorType: creatorType as any,
      };
    }

    author = this.trimInternal(author);

    const creator: Creator = {
      creatorType: creatorType as any,
    };

    // Check if comma-separated (Last, First)
    if (useComma || author.includes(',')) {
      const parts = author.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        creator.lastName = parts[0];
        creator.firstName = parts.slice(1).join(' ');
        return creator;
      }
    }

    // Check for single name
    const nameParts = author.split(/\s+/);
    if (nameParts.length === 1) {
      creator.lastName = author;
      creator.firstName = '';
      return creator;
    }

    // First Last format
    creator.firstName = nameParts.slice(0, -1).join(' ');
    creator.lastName = nameParts[nameParts.length - 1];

    return creator;
  },

  /**
   * Convert string to ISO date format
   */
  strToISO(str: string): string {
    if (!str) return '';

    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.split('T')[0];
    }

    try {
      const date = new Date(str);
      if (isNaN(date.getTime())) return str;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    } catch {
      return str;
    }
  },

  /**
   * Capitalize title according to style rules
   */
  capitalizeTitle(str: string, force: boolean = false): string {
    if (!str) return '';

    // Articles, conjunctions, and short prepositions
    const smallWords = new Set([
      'a',
      'an',
      'and',
      'as',
      'at',
      'but',
      'by',
      'for',
      'in',
      'nor',
      'of',
      'on',
      'or',
      'the',
      'to',
      'up',
      'yet',
      'with',
    ]);

    // Split into words
    const words = str.toLowerCase().split(/\s+/);

    return words
      .map((word, index) => {
        // Always capitalize first and last word
        if (index === 0 || index === words.length - 1) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        }

        // Don't capitalize small words
        if (smallWords.has(word)) {
          return word;
        }

        // Capitalize other words
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  },

  /**
   * Clean tags from HTML
   */
  cleanTags(str: string): string {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').trim();
  },

  /**
   * Get attribute value from element
   */
  attr(doc: Document | Element, selector: string, attr: string): string | null {
    const elem =
      'querySelector' in doc ? doc.querySelector(selector) : null;
    if (!elem) return null;
    return elem.getAttribute(attr);
  },

  /**
   * Get text content from element
   */
  text(doc: Document | Element, selector: string): string | null {
    const elem =
      'querySelector' in doc ? doc.querySelector(selector) : null;
    if (!elem) return null;
    return this.trimInternal(elem.textContent || '');
  },

  /**
   * Slugify string (for creating IDs)
   */
  slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  /**
   * Parse URL parameters
   */
  parseQueryString(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } catch {
      // Fallback for invalid URLs
      const queryString = url.split('?')[1];
      if (queryString) {
        queryString.split('&').forEach((param) => {
          const [key, value] = param.split('=');
          if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(
              value || ''
            );
          }
        });
      }
    }
    return params;
  },

  /**
   * Unescapes HTML entities
   */
  unescapeHTML(str: string): string {
    const htmlEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
    };

    return str.replace(
      /&[a-z]+;|&#\d+;/gi,
      (match) => htmlEntities[match] || match
    );
  },

  /**
   * Extract DOI from text or URL
   */
  cleanDOI(str: string): string | null {
    if (!str) return null;

    // Match DOI pattern
    const match = str.match(/10\.\d{4,}\/[^\s<>"]+/);
    if (!match) return null;

    let doi = match[0];
    // Remove trailing punctuation
    doi = doi.replace(/[.,;]$/, '');

    return doi;
  },

  /**
   * Clean ISBN
   */
  cleanISBN(isbn: string): string {
    if (!isbn) return '';
    return isbn.replace(/[^0-9X]/gi, '');
  },

  /**
   * Clean ISSN
   */
  cleanISSN(issn: string): string {
    if (!issn) return '';
    return issn.replace(/[^0-9X-]/gi, '');
  },

  /**
   * Process documents - fetch and process URLs
   * NOTE: This is a simplified version. Translators should handle this differently.
   */
  async processDocuments(
    urls: string[],
    processor: (doc: Document, url: string) => void | Promise<void>
  ): Promise<void> {
    for (const url of urls) {
      try {
        const response = await fetch(url);
        const html = await response.text();

        // This would need DOM parsing - handled by the executor
        console.warn('processDocuments called - should be handled by executor');
      } catch (e) {
        console.error(`Error processing ${url}:`, e);
      }
    }
  },

  /**
   * HTTP GET request
   * NOTE: Modern translators should use requestText() instead
   */
  async doGet(url: string, done?: (text: string) => void): Promise<string> {
    try {
      const response = await fetch(url);
      const text = await response.text();
      if (done) done(text);
      return text;
    } catch (e) {
      console.error('doGet error:', e);
      throw e;
    }
  },

  /**
   * HTTP POST request
   * NOTE: Modern translators should use requestText() instead
   */
  async doPost(
    url: string,
    body: string,
    done?: (text: string) => void
  ): Promise<string> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const text = await response.text();
      if (done) done(text);
      return text;
    } catch (e) {
      console.error('doPost error:', e);
      throw e;
    }
  },
};

/**
 * Global helper functions for modern translators
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
 * Helper functions available in translator context
 */

export function attr(
  doc: Document | Element,
  selector: string,
  attribute: string
): string | null {
  return ZU.attr(doc, selector, attribute);
}

export function text(
  doc: Document | Element,
  selector: string
): string | null {
  return ZU.text(doc, selector);
}
