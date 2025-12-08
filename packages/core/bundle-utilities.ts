#!/usr/bin/env bun

/**
 * Bundle Zotero utilities at build time
 * Converts CommonJS modules to browser-compatible ES modules
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

async function main() {
  const utilitiesDir = join(process.cwd(), 'utilities');
  const resourceDir = join(utilitiesDir, 'resource');
  const outputDir = join(process.cwd(), 'src');
  const outputFile = join(outputDir, 'utilities-bundle.ts');

  console.log('📦 Bundling Zotero utilities...');

  if (!existsSync(utilitiesDir)) {
    console.error('❌ Utilities directory not found. Run: git submodule update --init');
    process.exit(1);
  }

  // Read source files
  const utilitiesJs = readFileSync(join(utilitiesDir, 'utilities.js'), 'utf-8');
  const dateJs = readFileSync(join(utilitiesDir, 'date.js'), 'utf-8');
  const openUrlJs = readFileSync(join(utilitiesDir, 'openurl.js'), 'utf-8');
  const dateFormatsJson = readFileSync(join(resourceDir, 'dateFormats.json'), 'utf-8');

  console.log('✅ Read utilities.js, date.js, openurl.js, dateFormats.json');

  // Process utilities modules
  const processedUtilities = processUtilitiesModule(utilitiesJs);
  const processedDate = processDateModule(dateJs);
  const processedOpenUrl = processOpenUrlModule(openUrlJs);

  // Generate output
  const output = generateBundleOutput(
    processedUtilities,
    processedDate,
    processedOpenUrl,
    dateFormatsJson
  );

  writeFileSync(outputFile, output, 'utf-8');

  console.log(`✨ Generated ${outputFile}`);
  console.log(`   File size: ${(output.length / 1024).toFixed(2)} KB`);
  console.log(`✅ Done!`);
}

/**
 * Process utilities.js module
 */
function processUtilitiesModule(code: string): string {
  // Remove IIFE wrapper
  code = code.replace(/^\(function\(\)\s*{\s*/m, '');
  code = code.replace(/\}\)\(\);?\s*$/m, '');

  // Remove CommonJS exports
  code = code.replace(/if\s*\(\s*typeof\s+module\s*!=\s*['"]undefined['"]\s*\)\s*{\s*module\.exports\s*=\s*Utilities;\s*}\s*else\s*if\s*\(\s*typeof\s+Zotero\s*!=\s*['"]undefined['"]\s*\)\s*{\s*Zotero\.Utilities\s*=\s*Utilities;\s*}/g, '');

  // Replace XRegExp require with placeholder
  code = code.replace(/Utilities\.XRegExp\s*=\s*require\(['"]\.\/xregexp-all['"]\);?/g, '// XRegExp not included in bundle');

  // Remove XRegExp initialization
  code = code.replace(/if\s*\(\s*!Utilities\.XRegExp\s*\)\s*{\s*if\s*\(\s*typeof\s+module\s*!=\s*['"]undefined['"]\s*\)\s*{\s*Utilities\.XRegExp\s*=\s*require\(['"]\.\/xregexp-all['"]\);\s*}\s*}/g, '');

  // Replace jsdom require with fallback (multiple patterns to catch all cases)
  code = code.replace(/let \{JSDOM\} = require\(['"]jsdom['"]\);/g, '// jsdom not available, will use browser DOM');
  code = code.replace(/let {JSDOM} = require\(['"]jsdom['"]\);/g, '// jsdom not available, will use browser DOM');
  code = code.replace(/let \{ JSDOM \} = require\(['"]jsdom['"]\);/g, '// jsdom not available, will use browser DOM');

  // Replace JSDOM usage with fallback
  code = code.replace(/let document = \(new JSDOM\(str\)\)\.window\.document;/g, 'throw new Error("JSDOM not available in browser environment");');
  code = code.replace(/let document = \(new JSDOM\(wrappedNote\)\)\.window\.document;/g, 'throw new Error("JSDOM not available in browser environment");');

  return code;
}

/**
 * Process date.js module
 */
function processDateModule(code: string): string {
  // Remove IIFE wrapper
  code = code.replace(/^\(function\(\)\s*{\s*/m, '');
  code = code.replace(/\}\)\(\);?\s*$/m, '');

  // Remove CommonJS exports
  code = code.replace(/if\s*\(\s*typeof\s+module\s*!=\s*['"]undefined['"]\s*\)\s*{\s*module\.exports\s*=\s*Utilities_Date;\s*}\s*else\s*if\s*\(\s*typeof\s+Zotero\s*!=\s*['"]undefined['"]\s*\)\s*{\s*Zotero\.Date\s*=\s*Utilities_Date;\s*}/g, '');

  return code;
}

/**
 * Process openurl.js module
 */
function processOpenUrlModule(code: string): string {
  // Remove IIFE wrapper
  code = code.replace(/^\(function\(\)\s*{\s*/m, '');
  code = code.replace(/\}\)\(\);?\s*$/m, '');

  // Remove CommonJS exports
  code = code.replace(/if\s*\(\s*typeof\s+module\s*!=\s*['"]undefined['"]\s*\)\s*{\s*module\.exports\s*=\s*OpenURL;\s*}\s*else\s*if\s*\(\s*typeof\s+Zotero\s*!=\s*['"]undefined['"]\s*\)\s*{\s*Zotero\.OpenURL\s*=\s*OpenURL;\s*}/g, '');

  return code;
}

/**
 * Generate the final bundle output
 */
function generateBundleOutput(
  utilities: string,
  date: string,
  openUrl: string,
  dateFormatsJson: string
): string {
  return `/**
 * Auto-generated Zotero utilities bundle
 * Generated at: ${new Date().toISOString()}
 * Source: https://github.com/zotero/utilities
 *
 * WARNING: This is an auto-generated file. Do not edit manually!
 * Run 'bun run build' to regenerate.
 */

import type { Creator } from './types';

// ===== Global Zotero object stub for utilities =====
const Zotero = {
  locale: 'en-US',
  isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
  isServer: false,
  isFx: false,
  isElectron: false,
  debug: function(msg: string) {
    if (typeof process !== 'undefined' && process.env && process.env.DEBUG_TRANSLATORS) {
      console.log('[Zotero]', msg);
    }
  },
  Utilities: {
    // XRegExp fallback - use native RegExp for basic functionality
    XRegExp: function(pattern: string, flags?: string) {
      // Remove XRegExp-specific patterns that aren't supported in native RegExp
      // Replace \\p{L} (Unicode letter) with a simpler pattern
      let nativePattern = pattern.replace(/\\\\p\\{L\\}/g, 'a-zA-Z');
      return new RegExp(nativePattern, flags);
    }
  }
};

// ===== Date Formats Data =====
const dateFormatsData = ${dateFormatsJson};

// ===== Core Utilities =====
${utilities}

// Add XRegExp fallback to Utilities object
Utilities.XRegExp = function(pattern, flags) {
  // Simple XRegExp fallback using native RegExp
  // Replace Unicode property escapes with simpler patterns
  let nativePattern = pattern.replace(/\\pL/g, '[a-zA-Z]');
  return new RegExp(nativePattern, flags);
};

// Assign Utilities to Zotero.Utilities so internal references work
Zotero.Utilities = Utilities;

// ===== Date Utilities =====
${date}

// Initialize date utilities with formats
Utilities_Date.init(dateFormatsData);

// ===== OpenURL =====
${openUrl}

// ===== Merge utilities into ZU namespace =====

/**
 * Zotero Utilities namespace (ZU)
 * Contains 80+ helper functions for translators
 */
export const ZU = {
  ...Utilities,
  ...Utilities_Date,
  ...OpenURL,

  // Custom utilities not in official Zotero utilities
  // These are ztractor-specific helpers

  /**
   * Slugify string (for creating IDs)
   */
  slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\\w\\s-]/g, '')
      .replace(/[\\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  /**
   * Parse URL query parameters
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
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
          }
        });
      }
    }
    return params;
  },

  /**
   * Convert simple XPath expressions to CSS selectors (fallback)
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
      const attrMatch = simplified.match(/^([a-z]+)\\[@([^=]+)="([^"]+)"\\]$/i);
      if (attrMatch) {
        return \`\${attrMatch[1]}[\${attrMatch[2]}="\${attrMatch[3]}"]\`;
      }

      // //tagname[@attr]
      const attrOnlyMatch = simplified.match(/^([a-z]+)\\[@([^\\]]+)\\]$/i);
      if (attrOnlyMatch) {
        return \`\${attrOnlyMatch[1]}[\${attrOnlyMatch[2]}]\`;
      }
    }

    return null;
  }
};

/**
 * Individual helper exports for modern translators
 */

/**
 * Get attribute value from element
 */
export function attr(docOrElem: Document | Element, selector: string, attribute?: string): string | null {
  let elem: Element | null;

  if ('querySelector' in docOrElem && typeof selector === 'string' && attribute) {
    // Two-argument form: attr(doc, selector, attribute)
    elem = docOrElem.querySelector(selector);
    if (!elem) return null;
    return elem.getAttribute(attribute);
  } else if ('getAttribute' in docOrElem && typeof selector === 'string') {
    // Two-argument form: attr(elem, attribute)
    return docOrElem.getAttribute(selector);
  }

  return null;
}

/**
 * Get text content from element
 */
export function text(docOrElem: Document | Element, selector?: string): string | null {
  let elem: Element | null;

  if ('querySelector' in docOrElem && typeof selector === 'string') {
    // Two-argument form: text(doc, selector)
    elem = docOrElem.querySelector(selector);
    if (!elem) return null;
    return ZU.trimInternal(elem.textContent || '');
  } else if ('textContent' in docOrElem) {
    // One-argument form: text(elem)
    return ZU.trimInternal((docOrElem as Element).textContent || '');
  }

  return null;
}
`;
}

main().catch((err) => {
  console.error('Error bundling utilities:', err);
  process.exit(1);
});
