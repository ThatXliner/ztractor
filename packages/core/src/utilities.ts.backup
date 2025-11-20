/**
 * Zotero Utilities (ZU) - Essential helper functions for translators
 */

import type { Creator, ItemType, CreatorType } from './types';
import {
  initializeSchema,
  fieldIsValidForType as schemaFieldIsValid,
  getCreatorsForType as schemaGetCreators,
  itemTypeExists as schemaItemTypeExists,
  getAllItemTypes,
  getFieldsForType
} from './schema/zotero-schema';
import XRegExpPolyfill from './xregexp-polyfill';

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
      // Use document.evaluate if available (installed by executor)
      if (doc.evaluate) {
        // Note: createNSResolver is deprecated, just pass null for namespace resolver
        // Most web translators don't use XML namespaces
        const result = doc.evaluate(
          xpath,
          node,
          null, // namespace resolver (deprecated createNSResolver)
          0, // ANY_TYPE
          null
        );

        const nodes: Node[] = [];
        let item = result.iterateNext ? result.iterateNext() : null;
        while (item) {
          nodes.push(item);
          item = result.iterateNext();
        }
        return nodes;
      }

      // Fallback to CSS selector conversion for simple cases
      const cssSelector = this.xpathToSelector(xpath);
      if (cssSelector) {
        const elements = doc.querySelectorAll(cssSelector);
        return Array.from(elements) as Node[];
      }

      console.warn('XPath not supported and no CSS fallback available:', xpath);
      return [];
    } catch (e) {
      console.error('XPath error:', e);
      return [];
    }
  },

  /**
   * Convert simple XPath expressions to CSS selectors
   */
  xpathToSelector(xpath: string): string | null {
    // Handle very simple cases
    if (xpath.startsWith('//')) {
      const simplified = xpath.slice(2);

      // //tagname
      if (/^[a-z]+$/i.test(simplified)) {
        return simplified;
      }

      // //tagname[@attr="value"]
      const attrMatch = simplified.match(/^([a-z]+)\[@([^=]+)="([^"]+)"\]$/i);
      if (attrMatch) {
        return `${attrMatch[1]}[${attrMatch[2]}="${attrMatch[3]}"]`;
      }

      // //tagname[@attr]
      const attrOnlyMatch = simplified.match(/^([a-z]+)\[@([^\]]+)\]$/i);
      if (attrOnlyMatch) {
        return `${attrOnlyMatch[1]}[${attrOnlyMatch[2]}]`;
      }
    }

    return null;
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
    return isbn.replace(/[^0-9X]/gi, '').toUpperCase();
  },

  /**
   * Clean ISSN
   */
  cleanISSN(issn: string): string {
    if (!issn) return '';
    return issn.replace(/[^0-9X-]/gi, '');
  },

  /**
   * Basic trim - remove leading and trailing whitespace
   */
  trim(s: string): string {
    return s ? s.replace(/^\s+|\s+$/g, '') : '';
  },

  /**
   * Deep copy an object
   */
  deepCopy<T>(obj: T): T {
    // Use structuredClone if available (modern environments)
    if (typeof structuredClone !== 'undefined') {
      try {
        return structuredClone(obj);
      } catch {
        // Fall through to JSON method
      }
    }

    // Fallback to JSON method for simple objects
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      // If all else fails, return the object as-is
      console.warn('deepCopy failed, returning original object');
      return obj;
    }
  },

  /**
   * Convert string to Date object
   */
  strToDate(str: string): Date | null {
    if (!str) return null;

    try {
      const date = new Date(str);
      if (isNaN(date.getTime())) return null;
      return date;
    } catch {
      return null;
    }
  },

  /**
   * Process documents - fetch and process URLs
   * This is injected by the executor to use proper DOM parsing
   */
  async processDocuments(
    urls: string[],
    processor: (doc: Document, url: string) => void | Promise<void>,
    done?: () => void
  ): Promise<void> {
    console.error('processDocuments must be injected by executor with proper DOM parsing');
    throw new Error('processDocuments must be injected by executor');
  },

  /**
   * Remove diacritics (accents) from characters
   */
  removeDiacritics(str: string, lowercaseOnly: boolean = false): string {
    if (!str) return '';

    const diacriticsMap: Record<string, string> = {
      'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
      'Ç': 'C', 'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
      'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
      'Ð': 'D', 'Ñ': 'N', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O',
      'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
      'Ý': 'Y', 'Þ': 'TH', 'ß': 'ss',
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
      'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
      'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
      'ð': 'd', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
      'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
      'ý': 'y', 'þ': 'th', 'ÿ': 'y',
      'Ā': 'A', 'ā': 'a', 'Ă': 'A', 'ă': 'a', 'Ą': 'A', 'ą': 'a',
      'Ć': 'C', 'ć': 'c', 'Ĉ': 'C', 'ĉ': 'c', 'Ċ': 'C', 'ċ': 'c', 'Č': 'C', 'č': 'c',
      'Ď': 'D', 'ď': 'd', 'Đ': 'D', 'đ': 'd',
      'Ē': 'E', 'ē': 'e', 'Ĕ': 'E', 'ĕ': 'e', 'Ė': 'E', 'ė': 'e', 'Ę': 'E', 'ę': 'e', 'Ě': 'E', 'ě': 'e',
      'Ĝ': 'G', 'ĝ': 'g', 'Ğ': 'G', 'ğ': 'g', 'Ġ': 'G', 'ġ': 'g', 'Ģ': 'G', 'ģ': 'g',
      'Ĥ': 'H', 'ĥ': 'h', 'Ħ': 'H', 'ħ': 'h',
      'Ĩ': 'I', 'ĩ': 'i', 'Ī': 'I', 'ī': 'i', 'Ĭ': 'I', 'ĭ': 'i', 'Į': 'I', 'į': 'i', 'İ': 'I', 'ı': 'i',
      'Ĵ': 'J', 'ĵ': 'j', 'Ķ': 'K', 'ķ': 'k', 'ĸ': 'k',
      'Ĺ': 'L', 'ĺ': 'l', 'Ļ': 'L', 'ļ': 'l', 'Ľ': 'L', 'ľ': 'l', 'Ŀ': 'L', 'ŀ': 'l', 'Ł': 'L', 'ł': 'l',
      'Ń': 'N', 'ń': 'n', 'Ņ': 'N', 'ņ': 'n', 'Ň': 'N', 'ň': 'n', 'ŉ': 'n', 'Ŋ': 'N', 'ŋ': 'n',
      'Ō': 'O', 'ō': 'o', 'Ŏ': 'O', 'ŏ': 'o', 'Ő': 'O', 'ő': 'o', 'Œ': 'OE', 'œ': 'oe',
      'Ŕ': 'R', 'ŕ': 'r', 'Ŗ': 'R', 'ŗ': 'r', 'Ř': 'R', 'ř': 'r',
      'Ś': 'S', 'ś': 's', 'Ŝ': 'S', 'ŝ': 's', 'Ş': 'S', 'ş': 's', 'Š': 'S', 'š': 's',
      'Ţ': 'T', 'ţ': 't', 'Ť': 'T', 'ť': 't', 'Ŧ': 'T', 'ŧ': 't',
      'Ũ': 'U', 'ũ': 'u', 'Ū': 'U', 'ū': 'u', 'Ŭ': 'U', 'ŭ': 'u', 'Ů': 'U', 'ů': 'u', 'Ű': 'U', 'ű': 'u', 'Ų': 'U', 'ų': 'u',
      'Ŵ': 'W', 'ŵ': 'w', 'Ŷ': 'Y', 'ŷ': 'y', 'Ÿ': 'Y',
      'Ź': 'Z', 'ź': 'z', 'Ż': 'Z', 'ż': 'z', 'Ž': 'Z', 'ž': 'z'
    };

    let result = '';
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const replacement = diacriticsMap[char];

      if (replacement) {
        if (lowercaseOnly && char === char.toLowerCase()) {
          result += replacement.toLowerCase();
        } else if (lowercaseOnly) {
          result += char;
        } else {
          result += replacement;
        }
      } else {
        result += char;
      }
    }

    return result;
  },

  /**
   * Capitalize a name (handles hyphens and apostrophes)
   */
  capitalizeName(str: string): string {
    if (!str) return '';

    return str
      .split(/(\s+|-|')/)
      .map((part) => {
        if (part.match(/\s+|-|'/)) return part;
        if (part.length === 0) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  },

  /**
   * Capitalize first character only
   */
  capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Sentence case conversion (preserves markup)
   */
  sentenceCase(text: string): string {
    if (!text) return '';

    // Simple implementation - capitalize first letter after sentence boundaries
    return text.replace(/(^|[.!?]\s+)([a-z])/g, (match, boundary, letter) => {
      return boundary + letter.toUpperCase();
    });
  },

  /**
   * Advanced string cleaning
   */
  superCleanString(str: string): string {
    if (!str) return '';

    // Remove multiple spaces, trim, remove zero-width characters
    str = str.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width chars
    str = str.replace(/\s+/g, ' '); // Collapse spaces
    str = str.trim();

    return str;
  },

  /**
   * Ellipsize string
   */
  ellipsize(str: string, len: number, wordBoundary: boolean = false, countChars: boolean = false): string {
    if (!str || str.length <= len) return str;

    if (wordBoundary) {
      // Find last space before len
      let truncated = str.substring(0, len);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 0) {
        truncated = truncated.substring(0, lastSpace);
      }
      return truncated + '...';
    }

    return str.substring(0, len) + '...';
  },

  /**
   * Left pad string
   */
  lpad(string: string, pad: string, length: number): string {
    string = String(string);
    while (string.length < length) {
      string = pad + string;
    }
    return string;
  },

  /**
   * Get page range from pages string
   */
  getPageRange(pages: string): [number, number] | null {
    if (!pages) return null;

    const match = pages.match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2])];
    }

    // Single page
    const single = pages.match(/(\d+)/);
    if (single) {
      const page = parseInt(single[1]);
      return [page, page];
    }

    return null;
  },

  /**
   * Array utilities
   */

  /**
   * Return elements in array1 not in array2
   */
  arrayDiff(array1: any[], array2: any[], useIndex: boolean = false): any[] {
    if (useIndex) {
      return array1.filter((val, idx) => array2[idx] !== val);
    }
    return array1.filter((val) => !array2.includes(val));
  },

  /**
   * Deep array equality check
   */
  arrayEquals(array1: any[], array2: any[]): boolean {
    if (!Array.isArray(array1) || !Array.isArray(array2)) return false;
    if (array1.length !== array2.length) return false;

    for (let i = 0; i < array1.length; i++) {
      if (Array.isArray(array1[i]) && Array.isArray(array2[i])) {
        if (!this.arrayEquals(array1[i], array2[i])) return false;
      } else if (array1[i] !== array2[i]) {
        return false;
      }
    }

    return true;
  },

  /**
   * Shuffle array (returns new array)
   */
  arrayShuffle(array: any[]): any[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * Remove duplicates from array
   */
  arrayUnique(arr: any[]): any[] {
    return Array.from(new Set(arr));
  },

  /**
   * Object utilities
   */

  /**
   * Check if object is empty (no enumerable properties)
   */
  isEmpty(obj: any): boolean {
    if (obj === null || obj === undefined) return true;
    if (typeof obj !== 'object') return false;
    return Object.keys(obj).length === 0;
  },

  /**
   * Variable dump for debugging
   */
  varDump(obj: any, level: number = 0, maxLevel: number = 3): string {
    if (level >= maxLevel) return '[Max depth reached]';

    const indent = '  '.repeat(level);

    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj !== 'object') return String(obj);

    if (Array.isArray(obj)) {
      const items = obj.map((item) => `${indent}  ${this.varDump(item, level + 1, maxLevel)}`);
      return `[\n${items.join(',\n')}\n${indent}]`;
    }

    const items = Object.entries(obj).map(
      ([key, value]) => `${indent}  ${key}: ${this.varDump(value, level + 1, maxLevel)}`
    );
    return `{\n${items.join(',\n')}\n${indent}}`;
  },

  /**
   * String utilities
   */

  /**
   * Levenshtein edit distance
   */
  levenshtein(a: string, b: string): number {
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  },

  /**
   * Escape regex metacharacters
   */
  quotemeta(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Pluralize string
   */
  pluralize(num: number, forms: string[]): string {
    if (forms.length === 0) return '';
    if (forms.length === 1) return forms[0];

    // Simple English pluralization
    if (num === 1) return forms[0];
    if (forms.length >= 2) return forms[1];

    return forms[0];
  },

  /**
   * Format number
   */
  numberFormat(number: number, decimals: number = 0, dec_point: string = '.', thousands_sep: string = ','): string {
    const parts = number.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands_sep);
    return parts.join(dec_point);
  },

  /**
   * Generate random string
   */
  randomString(len: number = 8, chars: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * URL utilities
   */

  /**
   * Check if string is a valid HTTP/HTTPS URL
   */
  isHTTPURL(url: string, allowNoScheme: boolean = false): boolean {
    if (!url) return false;

    if (allowNoScheme && !url.match(/^https?:\/\//i)) {
      url = 'http://' + url;
    }

    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Clean and validate URL
   */
  cleanURL(url: string, tryHttp: boolean = false): string | null {
    if (!url) return null;

    url = url.trim();

    if (tryHttp && !url.match(/^https?:\/\//i)) {
      url = 'http://' + url;
    }

    try {
      const urlObj = new URL(url);
      return urlObj.href;
    } catch {
      return null;
    }
  },

  /**
   * Auto-link URLs and DOIs in text
   */
  autoLink(str: string): string {
    if (!str) return '';

    // Link URLs
    str = str.replace(
      /https?:\/\/[^\s<>"]+/g,
      (url) => `<a href="${url}">${url}</a>`
    );

    // Link DOIs
    str = str.replace(
      /\b(10\.\d{4,}\/[^\s<>"]+)/g,
      (doi) => `<a href="https://doi.org/${doi}">${doi}</a>`
    );

    return str;
  },

  /**
   * Identifier extraction utilities
   */

  /**
   * Extract multiple identifiers from text
   */
  extractIdentifiers(text: string): {
    DOI: string[];
    ISBN: string[];
    arXiv: string[];
    PMID: string[];
    bibcode: string[];
  } {
    const identifiers = {
      DOI: [] as string[],
      ISBN: [] as string[],
      arXiv: [] as string[],
      PMID: [] as string[],
      bibcode: [] as string[]
    };

    // Extract DOIs
    const doiMatches = text.matchAll(/10\.\d{4,}\/[^\s<>"]+/g);
    for (const match of doiMatches) {
      const doi = match[0].replace(/[.,;]$/, '');
      identifiers.DOI.push(doi);
    }

    // Extract ISBNs (10 or 13 digits, possibly with hyphens)
    const isbnMatches = text.matchAll(/\b(?:ISBN[:\s]?)?(\d{9}[\dX]|\d{13})\b/gi);
    for (const match of isbnMatches) {
      identifiers.ISBN.push(match[1]);
    }

    // Extract arXiv IDs
    const arxivMatches = text.matchAll(/\barXiv:?\s*(\d{4}\.\d{4,5}(?:v\d+)?)\b/gi);
    for (const match of arxivMatches) {
      identifiers.arXiv.push(match[1]);
    }

    // Extract PMIDs
    const pmidMatches = text.matchAll(/\bPMID:?\s*(\d{7,8})\b/gi);
    for (const match of pmidMatches) {
      identifiers.PMID.push(match[1]);
    }

    // Extract ADS Bibcodes
    const bibcodeMatches = text.matchAll(/\b(\d{4}[A-Za-z\&]{5}[A-Za-z0-9\.]{4}[A-Z\.])/g);
    for (const match of bibcodeMatches) {
      identifiers.bibcode.push(match[1]);
    }

    return identifiers;
  },

  /**
   * Convert ISBN-10 to ISBN-13
   */
  toISBN13(isbnStr: string): string | null {
    const isbn = this.cleanISBN(isbnStr);
    if (!isbn) return null;

    // Already ISBN-13
    if (isbn.length === 13) {
      return isbn;
    }

    // Convert ISBN-10 to ISBN-13
    if (isbn.length === 10) {
      const isbn13 = '978' + isbn.substring(0, 9);

      // Calculate check digit
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(isbn13[i]);
        sum += digit * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;

      return isbn13 + checkDigit;
    }

    return null;
  },

  /**
   * HTML/Markup utilities
   */

  /**
   * Encode HTML special characters
   */
  htmlSpecialChars(str: string): string {
    if (!str) return '';

    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Convert plain text to HTML
   */
  text2html(str: string, singleNewlineIsParagraph: boolean = false): string {
    if (!str) return '';

    str = this.htmlSpecialChars(str);

    if (singleNewlineIsParagraph) {
      // Single newline creates paragraph
      str = str.replace(/\n/g, '</p><p>');
      return `<p>${str}</p>`;
    } else {
      // Double newline creates paragraph, single creates break
      str = str.replace(/\n\n+/g, '</p><p>');
      str = str.replace(/\n/g, '<br>');
      return `<p>${str}</p>`;
    }
  },

  /**
   * Parse markup and extract links
   */
  parseMarkup(str: string): { text: string; href?: string }[] {
    if (!str) return [];

    const results: { text: string; href?: string }[] = [];

    // Simple HTML link parsing
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(str)) !== null) {
      // Add text before link
      if (match.index > lastIndex) {
        const text = str.substring(lastIndex, match.index).replace(/<[^>]+>/g, '');
        if (text) results.push({ text });
      }

      // Add link
      results.push({
        text: match[2].replace(/<[^>]+>/g, ''),
        href: match[1]
      });

      lastIndex = linkRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < str.length) {
      const text = str.substring(lastIndex).replace(/<[^>]+>/g, '');
      if (text) results.push({ text });
    }

    return results;
  },

  /**
   * Date and formatting utilities
   */

  /**
   * Format date according to template
   */
  formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    if (!date || !(date instanceof Date)) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    format = format.replace('YYYY', String(year));
    format = format.replace('MM', month);
    format = format.replace('DD', day);

    return format;
  },

  /**
   * Performance utilities
   */

  /**
   * Debounce function execution
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function(...args: Parameters<T>) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Throttle function execution
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    options: { leading?: boolean; trailing?: boolean } = {}
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let previous = 0;
    const leading = options.leading !== false;
    const trailing = options.trailing !== false;

    return function(...args: Parameters<T>) {
      const now = Date.now();

      if (!previous && !leading) previous = now;

      const remaining = wait - (now - previous);

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func(...args);
      } else if (!timeout && trailing) {
        timeout = setTimeout(() => {
          previous = leading ? Date.now() : 0;
          timeout = null;
          func(...args);
        }, remaining);
      }
    };
  },

  /**
   * XRegExp polyfill for Unicode regex support
   */
  XRegExp: XRegExpPolyfill,

  /**
   * Schema validation utilities
   */

  /**
   * Check if a field is valid for an item type
   */
  fieldIsValidForType(field: string, itemType: ItemType): boolean {
    return schemaFieldIsValid(field, itemType);
  },

  /**
   * Get valid creator types for an item type
   */
  getCreatorsForType(itemType: ItemType): CreatorType[] {
    return schemaGetCreators(itemType);
  },

  /**
   * Check if an item type exists (deprecated but included for compatibility)
   */
  itemTypeExists(itemType: string): boolean {
    return schemaItemTypeExists(itemType);
  },

  /**
   * Get all item types
   */
  getAllItemTypes(): ItemType[] {
    return getAllItemTypes();
  },

  /**
   * Get all valid fields for an item type
   */
  getFieldsForType(itemType: ItemType): string[] {
    return getFieldsForType(itemType);
  },

  /**
   * HTTP GET request
   * NOTE: Modern translators should use requestText() instead
   */
  async doGet(url: string, done?: (text: string) => void): Promise<string> {
    try {
      if (!url || typeof url !== 'string') {
        console.error(`doGet called with invalid URL:`, url);
        throw new Error(`Invalid URL: ${url}`);
      }
      const response = await fetch(url);
      const text = await response.text();
      if (done) done(text);
      return text;
    } catch (e) {
      console.error(`doGet error for URL "${url}":`, e);
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

  /**
   * HTTP namespace (legacy compatibility)
   */
  HTTP: {
    async doGet(url: string, done?: (text: string) => void): Promise<string> {
      return ZU.doGet(url, done);
    },
    async doPost(url: string, body: string, done?: (text: string) => void): Promise<string> {
      return ZU.doPost(url, body, done);
    },
  },
};

/**
 * NOTE: Request functions (request, requestText, requestJSON, requestDocument)
 * are provided by the translator sandbox and are NOT exported from utilities.
 * They are created by createSandboxRequestFunctions() in translator-sandbox.ts
 * with proper URL resolution and DOM parsing support.
 */

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
