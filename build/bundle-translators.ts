#!/usr/bin/env bun

/**
 * Bundle all Zotero translators at build time
 * Bundles code as strings (requires Function at runtime, but no file I/O)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TranslatorMetadata {
  translatorID: string;
  label: string;
  creator: string;
  target: string;
  minVersion: string;
  maxVersion: string;
  priority: number;
  inRepository: boolean;
  translatorType: number;
  browserSupport: string;
  lastUpdated: string;
}

interface TranslatorBundle {
  metadata: TranslatorMetadata;
  code: string;
}

function parseTranslatorMetadata(code: string): TranslatorMetadata | null {
  try {
    const match = code.match(/^\s*({[\s\S]*?})(?:\s*\n|$)/);
    if (!match) return null;

    const metadata = JSON.parse(match[1]) as TranslatorMetadata;

    if (
      !metadata.translatorID ||
      !metadata.label ||
      !metadata.target ||
      metadata.translatorType === undefined
    ) {
      return null;
    }

    return metadata;
  } catch (e) {
    return null;
  }
}

function extractCodeWithoutMetadata(code: string): string {
  // Remove the JSON metadata at the beginning
  const match = code.match(/^\s*{[\s\S]*?}(?:\s*\n|$)/);
  if (!match) return code;

  // Return everything after the metadata
  return code.substring(match[0].length);
}

function escapeForTemplate(code: string): string {
  // Escape backticks and ${} for template literal
  return code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

async function main() {
  const translatorsDir = join(process.cwd(), 'translators');
  const outputDir = join(process.cwd(), 'packages/core/src');
  const outputFile = join(outputDir, 'translators-registry.ts');

  console.log('📦 Bundling Zotero translators...');

  if (!existsSync(translatorsDir)) {
    console.error('❌ Translators directory not found. Run: git submodule update --init');
    process.exit(1);
  }

  const files = readdirSync(translatorsDir).filter((f) => f.endsWith('.js'));
  console.log(`📄 Found ${files.length} translator files`);

  const translators: TranslatorBundle[] = [];
  const translatorsByType: Record<number, number> = {};
  let skipped = 0;
  let totalCodeSize = 0;

  for (const file of files) {
    const filePath = join(translatorsDir, file);
    const code = readFileSync(filePath, 'utf-8');

    const metadata = parseTranslatorMetadata(code);

    if (!metadata) {
      skipped++;
      continue;
    }

    // Only include web translators (type 4)
    if (metadata.translatorType === 4) {
      const jsCode = extractCodeWithoutMetadata(code);
      translators.push({
        metadata,
        code: jsCode,
      });
      totalCodeSize += jsCode.length;
    }

    translatorsByType[metadata.translatorType] =
      (translatorsByType[metadata.translatorType] || 0) + 1;
  }

  console.log(`✅ Parsed ${translators.length} web translators`);
  console.log(`⏭️  Skipped ${skipped} files (invalid or non-web)`);
  console.log(`📏 Total translator code size: ${(totalCodeSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('\n📊 Translators by type:');
  for (const [type, count] of Object.entries(translatorsByType)) {
    const typeName = { '1': 'Import', '2': 'Export', '4': 'Web', '8': 'Search' }[type] || `Type ${type}`;
    console.log(`   ${typeName}: ${count}`);
  }

  translators.sort((a, b) => b.metadata.priority - a.metadata.priority);

  // Generate the registry file with bundled code
  let registryCode = `/**
 * Auto-generated translator registry with bundled code
 * Generated at: ${new Date().toISOString()}
 * Total web translators: ${translators.length}
 *
 * WARNING: This is a large auto-generated file (~${(totalCodeSize / 1024 / 1024).toFixed(1)} MB)
 * Do not edit manually!
 */

import type { TranslatorMetadata } from './types';

export interface TranslatorRegistryEntry {
  metadata: TranslatorMetadata;
  code: string;
}

`;

  // Generate the bundled translators array
  registryCode += 'export const TRANSLATORS_REGISTRY: TranslatorRegistryEntry[] = [\n';

  for (let i = 0; i < translators.length; i++) {
    const t = translators[i];
    const escapedCode = escapeForTemplate(t.code);

    registryCode += '  {\n';
    registryCode += `    metadata: ${JSON.stringify(t.metadata, null, 6).replace(/\n/g, '\n    ')},\n`;
    registryCode += `    code: \`${escapedCode}\`,\n`;
    registryCode += '  }';

    if (i < translators.length - 1) {
      registryCode += ',\n';
    } else {
      registryCode += '\n';
    }

    if ((i + 1) % 100 === 0) {
      console.log(`   Bundled ${i + 1}/${translators.length} translators...`);
    }
  }

  registryCode += '];\n\n';

  // Add helper functions
  registryCode += `/**
 * Find translators matching a URL
 */
export function findTranslatorsForUrl(url: string): TranslatorRegistryEntry[] {
  return TRANSLATORS_REGISTRY.filter((entry) => {
    try {
      const regex = new RegExp(entry.metadata.target);
      return regex.test(url);
    } catch {
      return false;
    }
  });
}

/**
 * Get translator by ID
 */
export function getTranslatorById(translatorID: string): TranslatorRegistryEntry | null {
  return TRANSLATORS_REGISTRY.find((entry) => entry.metadata.translatorID === translatorID) || null;
}
`;

  writeFileSync(outputFile, registryCode, 'utf-8');

  console.log(`\n✨ Generated ${outputFile}`);
  console.log(`   Registry file size: ${(registryCode.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Average translator size: ${(totalCodeSize / translators.length / 1024).toFixed(2)} KB`);
  console.log(`\n✅ Done! All translators bundled as strings (no runtime file I/O)`);
}

main().catch((err) => {
  console.error('Error bundling translators:', err);
  process.exit(1);
});
