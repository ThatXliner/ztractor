#!/usr/bin/env bun

/**
 * Bundle Zotero translate utilities at build time
 * Converts prototype-based global namespace code to clean ES modules
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

async function main() {
  const translateDir = join(process.cwd(), 'translate');
  const srcDir = join(translateDir, 'src');
  const outputFile = join(process.cwd(), 'src', 'utilities-translate-bundle.ts');

  console.log('📦 Bundling Zotero translate utilities...');

  if (!existsSync(translateDir)) {
    console.error('❌ Translate directory not found. Run: git submodule update --init');
    process.exit(1);
  }

  // Read source file
  const utilitiesTranslateJs = readFileSync(join(srcDir, 'utilities_translate.js'), 'utf-8');

  console.log('✅ Read utilities_translate.js');

  // Process module
  const processedUtilities = processUtilitiesTranslate(utilitiesTranslateJs);

  // Generate output
  const output = generateTranslateBundle(processedUtilities);

  writeFileSync(outputFile, output, 'utf-8');

  console.log(`✨ Generated ${outputFile}`);
  console.log(`   File size: ${(output.length / 1024).toFixed(2)} KB`);
  console.log(`✅ Done!`);
}

function processUtilitiesTranslate(code: string): string {
  // Remove license block
  code = code.replace(/\/\*[\s\S]*?\*\*\*\*\* END LICENSE BLOCK \*\*\*\*\*\s*\*\//m, '');

  // Remove constructor and prototype chain setup
  code = code.replace(/Zotero\.Utilities\.Translate\s*=\s*function\([^)]*\)\s*\{[\s\S]*?\};?\s*var tmp[\s\S]*?Zotero\.Utilities\.Translate\.prototype\s*=\s*new tmp\(\);/g, '');

  // Remove simple method assignments (formatDate, strToDate, etc.)
  code = code.replace(/Zotero\.Utilities\.Translate\.prototype\.\w+\s*=\s*Zotero\.(Date|OpenURL|Utilities\.Item)\.\w+;\s*/g, '');

  // Remove __exposedProps__ block and the for loop that populates it (as one unit)
  // This block includes:
  // 1. Zotero.Utilities.Translate.prototype.__exposedProps__ = {"HTTP":"r"};
  // 2. for(var j in Zotero.Utilities.Translate.prototype) { ... }
  code = code.replace(/Zotero\.Utilities\.Translate\.prototype\.__exposedProps__\s*=\s*\{[^}]*\};[\s\S]*?for\s*\([^)]*\)[\s\S]*?\n\}/g, '');

  // Remove module.exports block
  code = code.replace(/if\s*\([^)]*typeof[^)]*(?:process|module)[^)]*\)[^{]*\{[^}]*module\.exports[^;]*;[\s\S]*?\}/g, '');

  // Convert prototype methods to exports
  // Pattern: Zotero.Utilities.Translate.prototype.functionName = async function(...) {...}
  code = code.replace(
    /Zotero\.Utilities\.Translate\.prototype\.(\w+)\s*=\s*async\s+function\s*\(([^)]*)\)\s*\{/g,
    'export async function $1($2) {'
  );

  // Pattern: Zotero.Utilities.Translate.prototype.functionName = function(...) {...}
  code = code.replace(
    /Zotero\.Utilities\.Translate\.prototype\.(\w+)\s*=\s*function\s*\(([^)]*)\)\s*\{/g,
    'export function $1($2) {'
  );

  // Replace this._translate references with a stub (we won't use this in ztractor)
  code = code.replace(/this\._translate/g, '{ capitalizeTitles: undefined }');

  // Replace Zotero.HTTP calls with our implementations
  code = code.replace(/Zotero\.HTTP\.processDocuments/g, 'processDocumentsInternal');
  code = code.replace(/Zotero\.HTTP\.request/g, 'httpRequest');
  code = code.replace(/Zotero\.HTTP\.doGet/g, 'httpGet');
  code = code.replace(/Zotero\.HTTP\.doPost/g, 'httpPost');

  // Replace Zotero.Date and Zotero.OpenURL calls with ZU (from utilities-bundle)
  code = code.replace(/Zotero\.Date\.(\w+)/g, 'ZU.$1');
  code = code.replace(/Zotero\.OpenURL\.(\w+)/g, 'ZU.$1');
  code = code.replace(/Zotero\.Utilities\.Item\.(\w+)/g, 'ZU.$1');
  code = code.replace(/Zotero\.Utilities\.(\w+)/g, 'ZU.$1');

  // Replace Zotero.version
  code = code.replace(/Zotero\.version/g, '"6.0.0-ztractor"');

  return code;
}

function generateTranslateBundle(utilities: string): string {
  return `/**
 * Auto-generated Zotero translate utilities bundle
 * Generated at: ${new Date().toISOString()}
 * Source: https://github.com/zotero/translate
 *
 * WARNING: This is an auto-generated file. Do not edit manually!
 * Run 'bun run bundle-translate.ts' to regenerate.
 */

import { ZU } from './utilities-bundle';

// Internal HTTP helpers (replaced with fetch)
async function httpRequest(url: string, options?: any): Promise<any> {
  const response = await fetch(url, options);
  return {
    status: response.status,
    responseText: await response.text(),
    responseHeaders: Object.fromEntries(response.headers.entries()),
    responseJSON: async () => response.json()
  };
}

async function httpGet(url: string, done?: Function): Promise<string> {
  const response = await fetch(url);
  const text = await response.text();
  if (done) done(text);
  return text;
}

async function httpPost(url: string, body: string, done?: Function): Promise<string> {
  const response = await fetch(url, { method: 'POST', body });
  const text = await response.text();
  if (done) done(text);
  return text;
}

// Internal processDocuments implementation
async function processDocumentsInternal(
  urls: string | string[],
  processor: (doc: Document, url: string) => void | Promise<void>,
  onError?: Function,
  onDone?: Function
): Promise<void> {
  const urlArray = Array.isArray(urls) ? urls : [urls];

  for (const url of urlArray) {
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Parse HTML to Document
      // Note: parseHTMLDocument should be available from dependencies
      const doc = typeof DOMParser !== 'undefined'
        ? new DOMParser().parseFromString(html, 'text/html')
        : (() => { throw new Error('DOMParser not available'); })();

      // Set document URL properties
      Object.defineProperty(doc, 'URL', { value: url, writable: false });
      Object.defineProperty(doc, 'documentURI', { value: url, writable: false });

      await processor(doc, url);
    } catch (error) {
      console.error(\`Error processing document \${url}:\`, error);
      if (onError) {
        onError(error);
      } else {
        throw error;
      }
    }
  }

  if (onDone) {
    onDone();
  }
}

// ===== Translated utilities from utilities_translate.js =====
${utilities}

// ===== Re-export ZU for convenience =====
export { ZU };
`;
}

main().catch((err) => {
  console.error('Error bundling translate utilities:', err);
  process.exit(1);
});
