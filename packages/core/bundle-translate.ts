#!/usr/bin/env bun

/**
 * Bundle Zotero translate utilities at build time
 * Converts prototype-based global namespace code to clean ES modules
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { readdir } from 'node:fs/promises';
import { join } from 'path';
const NEED_TO_REIMPL = ["translators.js", "http.js", "translation/translate_item.js", "proxy.js"]
async function main() {
  const translateDir = join(process.cwd(), 'translate');
  const srcDir = join(translateDir, 'src');
  const outputFile = join(process.cwd(), 'src', 'utilities-translate-bundle.ts');

  console.log('📦 Bundling Zotero translate utilities...');

  if (!existsSync(translateDir)) {
    console.error('❌ Translate directory not found. Run: git submodule update --init');
    process.exit(1);
  }


  const files = (await readdir(srcDir, { recursive: true, })).filter(x => x.endsWith('.js')).filter(x => !NEED_TO_REIMPL.includes(x)).map(x=>readFileSync(join(srcDir, x), 'utf-8'));

  console.log('✅ Read submodule');
  const translationBundlePatch = readFileSync(join(process.cwd(), 'translation-bundle-patch.js'), 'utf-8');
  // Generate output
  const output = generateTranslateBundle(files.map(processFile).join("\n") + "\n" + translationBundlePatch);

  writeFileSync(outputFile, output, 'utf-8');

  console.log(`✨ Generated ${outputFile}`);
  console.log(`   File size: ${(output.length / 1024).toFixed(2)} KB`);
  console.log(`✅ Done!`);
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

${utilities}

// ===== Re-export Zotero for convenience =====
export { Zotero };
`;
}
function processFile(file: string): string {
  // let processed = file.replace(/^.+?\(function\(\)\s*\{\s*"use strict";\s*(.+)}\)\(\);$/s, '$1');
  // processed = processed.replace(/}\)\(\);^(\s*)$/, '');
  return file;
}
main().catch((err) => {
  console.error('Error bundling translate utilities:', err);
  process.exit(1);
});
