/**
 * Ztractor - Browser version
 * Use Zotero translators to extract metadata from websites
 */

import type {
  ExtractMetadataOptions,
  ExtractMetadataResult,
  ZoteroItem,
  Translator,
} from './types';
import type { TranslatorRegistryEntry } from './translators-registry';
import { executeDetectWeb, executeDoWeb, parseHTMLDocument } from './executor';

export { parseHTMLDocument, executeDetectWeb, executeDoWeb } from './executor';
export { Item } from './item';
export { ZU } from './utilities';
export { parseTranslatorMetadata } from './translator-loader';

// Will be generated at build time
let translatorsRegistry: TranslatorRegistryEntry[];
let findTranslatorsForUrl: (url: string) => TranslatorRegistryEntry[];

// Lazy load the registry
async function loadRegistry(): Promise<void> {
  if (!translatorsRegistry) {
    const module = await import('./translators-registry');
    translatorsRegistry = module.TRANSLATORS_REGISTRY;
    findTranslatorsForUrl = module.findTranslatorsForUrl;
  }
}

/**
 * Extract metadata from a URL
 *
 * @param url - The URL to extract metadata from
 * @param html - Optional HTML content. If not provided, will be fetched.
 * @returns Metadata extraction result
 *
 * @example
 * ```typescript
 * // With URL only (will fetch HTML)
 * const result = await extractMetadata({ url: 'https://example.com/article' });
 *
 * // With pre-fetched HTML
 * const html = await fetch('https://example.com/article').then(r => r.text());
 * const result = await extractMetadata({ url: 'https://example.com/article', html });
 *
 * if (result.success && result.items) {
 *   console.log(result.items[0].title);
 * }
 * ```
 */
export async function extractMetadata(
  options: string | ExtractMetadataOptions
): Promise<ExtractMetadataResult> {
  // Normalize options
  const opts: ExtractMetadataOptions =
    typeof options === 'string' ? { url: options } : options;

  const { url, html, headers, timeout = 10000, dependencies } = opts;

  try {
    // Load translators registry
    await loadRegistry();

    // Get HTML content
    let htmlContent = html;
    if (!htmlContent) {
      const response = await fetch(url, {
        headers: headers || {
          'User-Agent':
            'Mozilla/5.0 (compatible; Ztractor/1.0; +https://github.com/zotero/translators)',
        },
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      htmlContent = await response.text();
    }

    // Parse HTML into Document
    const doc = parseHTMLDocument(htmlContent, url, dependencies);

    // Find matching translators
    const matchingTranslators = findTranslatorsForUrl(url);

    if (matchingTranslators.length === 0) {
      return {
        success: false,
        error: 'No matching translator found for this URL',
      };
    }

    // Try translators in priority order
    for (const entry of matchingTranslators) {
      try {
        // Translator code is already bundled in the entry
        const translator: Translator = {
          metadata: entry.metadata,
          code: entry.code,
        };

        // Check if translator can handle this page
        const itemType = await executeDetectWeb(translator, doc, url, dependencies);

        if (!itemType) {
          continue; // Try next translator
        }

        // Extract metadata
        const items = await executeDoWeb(translator, doc, url, dependencies);

        if (items.length > 0) {
          return {
            success: true,
            items,
            translator: translator.metadata.label,
          };
        }
      } catch (e) {
        console.error(
          `Error with translator ${entry.metadata.label}:`,
          e
        );
        // Try next translator
        continue;
      }
    }

    return {
      success: false,
      error: 'No translator could extract metadata from this page',
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Get list of all available translators
 */
export async function getAvailableTranslators(): Promise<{
    id: string;
    label: string;
    target: string;
    priority: number;
}[]> {
  await loadRegistry();
  return translatorsRegistry.map((entry) => ({
    id: entry.metadata.translatorID,
    label: entry.metadata.label,
    target: entry.metadata.target,
    priority: entry.metadata.priority,
  }));
}

/**
 * Find translators that match a URL
 */
export async function findTranslators(url: string): Promise<{
    id: string;
    label: string;
    target: string;
    priority: number;
}[]> {
  await loadRegistry();
  return findTranslatorsForUrl(url).map((entry) => ({
    id: entry.metadata.translatorID,
    label: entry.metadata.label,
    target: entry.metadata.target,
    priority: entry.metadata.priority,
  }));
}

// Re-export types
export type {
  ExtractMetadataOptions,
  ExtractMetadataResult,
  ZoteroItem,
  ItemType,
  Creator,
  Tag,
  Note,
  Attachment,
} from './types';
