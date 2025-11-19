#!/usr/bin/env bun

/**
 * Bundle all Zotero translators at build time
 * This script reads all translator files and generates a registry
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

interface TranslatorEntry {
  metadata: TranslatorMetadata;
  filename: string;
}

function parseTranslatorMetadata(code: string): TranslatorMetadata | null {
  try {
    const match = code.match(/^\s*({[\s\S]*?})\s*\n/);
    if (!match) return null;

    const metadata = JSON.parse(match[1]) as TranslatorMetadata;

    // Validate required fields
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

async function main() {
  const translatorsDir = join(process.cwd(), 'translators');
  const outputDir = join(process.cwd(), 'src');
  const outputFile = join(outputDir, 'translators-registry.ts');

  console.log('📦 Bundling Zotero translators...');

  if (!existsSync(translatorsDir)) {
    console.error('❌ Translators directory not found. Run: git submodule update --init');
    process.exit(1);
  }

  // Read all .js files from translators directory
  const files = readdirSync(translatorsDir).filter((f) => f.endsWith('.js'));

  console.log(`📄 Found ${files.length} translator files`);

  const translators: TranslatorEntry[] = [];
  const translatorsByType: Record<number, number> = {};
  let skipped = 0;

  for (const file of files) {
    const filePath = join(translatorsDir, file);
    const code = readFileSync(filePath, 'utf-8');

    const metadata = parseTranslatorMetadata(code);

    if (!metadata) {
      skipped++;
      continue;
    }

    // Only include web translators (type 4) for now
    if (metadata.translatorType === 4) {
      translators.push({
        metadata,
        filename: file,
      });
    }

    // Count by type
    translatorsByType[metadata.translatorType] =
      (translatorsByType[metadata.translatorType] || 0) + 1;
  }

  console.log(`✅ Parsed ${translators.length} web translators`);
  console.log(`⏭️  Skipped ${skipped} files (invalid or non-web)`);
  console.log('\n📊 Translators by type:');
  for (const [type, count] of Object.entries(translatorsByType)) {
    const typeName = {
      '1': 'Import',
      '2': 'Export',
      '4': 'Web',
      '8': 'Search',
    }[type] || `Type ${type}`;
    console.log(`   ${typeName}: ${count}`);
  }

  // Sort by priority (descending)
  translators.sort((a, b) => b.metadata.priority - a.metadata.priority);

  // Generate the registry file
  const registryCode = `/**
 * Auto-generated translator registry
 * Generated at: ${new Date().toISOString()}
 * Total web translators: ${translators.length}
 */

import type { TranslatorMetadata } from './types';

export interface TranslatorRegistryEntry {
  metadata: TranslatorMetadata;
  filename: string;
}

export const TRANSLATORS_REGISTRY: TranslatorRegistryEntry[] = ${JSON.stringify(
    translators,
    null,
    2
  )};

/**
 * Get translator code by filename
 */
export async function getTranslatorCode(filename: string): Promise<string> {
  // Use dynamic import to load translator code
  const module = await import(\`../translators/\${filename}\`);

  // Read the raw file content
  const file = Bun.file(\`translators/\${filename}\`);
  return file.text();
}

/**
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
  console.log(`   Total size: ${(registryCode.length / 1024).toFixed(2)} KB`);
}

main().catch((err) => {
  console.error('Error bundling translators:', err);
  process.exit(1);
});
