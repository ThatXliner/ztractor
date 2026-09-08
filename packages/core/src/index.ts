/**
 * Ztractor - Browser version
 * Use Zotero translators to extract metadata from websites
 */

import type {
  ExtractMetadataOptions,
  ExtractMetadataDiagnostic,
  ExtractMetadataResult,
  ZoteroItem,
} from './types';
import type { TranslatorRegistryEntry } from './translators-registry';
import { executeDetectWeb, executeDoWeb, parseHTMLDocument } from './executor';
import { ZoteroRuntimeExecutor } from './zotero-runtime-executor';

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

function sortByTranslatorPriority(entries: TranslatorRegistryEntry[]): TranslatorRegistryEntry[] {
  return [...entries].sort((a, b) => a.metadata.priority - b.metadata.priority);
}

function isWebTranslator(entry: TranslatorRegistryEntry): boolean {
  return (entry.metadata.translatorType & 4) !== 0;
}

class ExtractionTimeoutError extends Error {
  constructor(label: string, timeout: number) {
    super(`${label} timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

interface ExtractionDeadline {
  signal: AbortSignal;
  remaining: () => number;
  abort: (reason?: unknown) => void;
  dispose: () => void;
}

function createExtractionDeadline(timeout: number, parentSignal?: AbortSignal): ExtractionDeadline {
  const controller = new AbortController();
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeout;
  const timeoutId = setTimeout(() => {
    controller.abort(new ExtractionTimeoutError('Extraction', timeout));
  }, timeout);
  const onParentAbort = () => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted) {
    onParentAbort();
  } else {
    parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  }

  return {
    signal: controller.signal,
    remaining: () => Math.max(0, deadlineAt - Date.now()),
    abort: (reason) => {
      if (!controller.signal.aborted) controller.abort(reason);
    },
    dispose: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}

async function withRemainingDeadline<T>(
	operation: () => Promise<T> | T,
	deadline: ExtractionDeadline,
	label: string,
): Promise<T> {
  if (deadline.signal.aborted) {
    throw deadline.signal.reason ?? new Error('Extraction aborted');
  }

	const remaining = deadline.remaining();
	if (remaining <= 0) throw new ExtractionTimeoutError(label, 0);

	let onAbort: (() => void) | undefined;
	const aborted = new Promise<never>((_resolve, reject) => {
		onAbort = () => reject(deadline.signal.reason ?? new Error('Extraction aborted'));
		deadline.signal.addEventListener('abort', onAbort, { once: true });
	});

	try {
		return await Promise.race([Promise.resolve().then(operation), aborted]);
	} finally {
		if (onAbort) deadline.signal.removeEventListener('abort', onAbort);
	}
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

function isSuccessfulResponse(response: Response): boolean {
  if (typeof response.ok === 'boolean') return response.ok;
  return response.status >= 200 && response.status < 300;
}

function parseHttpUrl(url: string): URL {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`);
  }
  return parsedUrl;
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

  const {
    url,
    html,
    headers,
    network = 'allow',
    signal,
    document,
    timeout = 10000,
    dependencies = { DOMParser: (globalThis as any).DOMParser },
  } = opts;

  let deadline: ExtractionDeadline | undefined;
  const diagnostics: ExtractMetadataDiagnostic[] = [];

  try {
    try {
      parseHttpUrl(url);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Unsupported URL protocol:')) {
        return { success: false, error: error.message };
      }
      return { success: false, error: `Invalid URL: ${url}` };
    }
    if (!Number.isFinite(timeout) || timeout <= 0) {
      return { success: false, error: 'timeout must be a positive finite number' };
    }

    if (network === 'deny' && html === undefined && document === undefined) {
      return {
        success: false,
        error: `Network access denied for ${url}`,
      };
    }

    deadline = createExtractionDeadline(timeout, signal);

    // Load translators registry
    await loadRegistry();

    // Get HTML content
    let htmlContent = html;
    let sourceUrl = url;
    if (htmlContent === undefined && document === undefined) {
      const response = await withRemainingDeadline(
        async () => {
          const response = await fetch(url, {
            ...(headers ? { headers } : {}),
            signal: deadline!.signal,
          });
          if (!isSuccessfulResponse(response)) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const finalUrl = response.url || url;
          parseHttpUrl(finalUrl);
          return {
            url: finalUrl,
            html: await response.text(),
          };
        },
        deadline,
        'Initial fetch',
      );
      sourceUrl = response.url;
      htmlContent = response.html;
    }

    // Parse HTML into Document
    const doc = document ?? parseHTMLDocument(htmlContent ?? '', sourceUrl, dependencies);

    // Find matching translators
    const matchingTranslators = sortByTranslatorPriority(findTranslatorsForUrl(sourceUrl));

    if (matchingTranslators.length === 0) {
      return {
        success: false,
        error: 'No matching translator found for this URL',
      };
    }

    // Try translators in priority order
    for (const entry of matchingTranslators) {
      if (deadline.signal.aborted || deadline.remaining() <= 0) break;

      const runtimeExecutor = new ZoteroRuntimeExecutor(translatorsRegistry, dependencies, {
        network,
        signal: deadline.signal,
        baseUrl: sourceUrl,
        timeout: deadline.remaining(),
      });

      let stage: 'detect' | 'extract' = 'detect';
      try {
        // Check if translator can handle this page
        const itemType = await withRemainingDeadline(
          () => runtimeExecutor.detectWeb(entry, doc, sourceUrl),
          deadline,
          `${entry.metadata.label} detectWeb`,
        );

        if (!itemType) {
          continue; // Try next translator
        }

        if (itemType === 'multiple') {
          diagnostics.push({
            translator: entry.metadata.label,
            stage: 'detect',
            message: 'Translator returned multiple items; interactive selection is unavailable',
          });
          if (entry.metadata.target !== '') {
            return {
              success: false,
              error: 'Open an individual article page; this page contains multiple items',
              diagnostics,
            };
          }
          continue;
        }

        // Extract metadata
        stage = 'extract';
        const items = await withRemainingDeadline(
          () => runtimeExecutor.doWeb(entry, doc, sourceUrl),
          deadline,
          `${entry.metadata.label} extract`,
        );

        if (items.length > 0) {
          return {
            success: true,
            items,
            translator: entry.metadata.label,
            source: 'translator',
            diagnostics,
          };
        }

        diagnostics.push({
          translator: entry.metadata.label,
          stage: 'extract',
          message: 'Translator returned no items',
        });
      } catch (e) {
        diagnostics.push({
          translator: entry.metadata.label,
          stage,
          message: errorMessage(e),
        });
        if (isTimeoutError(e)) deadline.abort(e);
        if (deadline.signal.aborted) break;
        // Try next translator
        continue;
      }
    }

    const result: ExtractMetadataResult = {
      success: false,
      error: deadline.signal.aborted && deadline.signal.reason
        ? errorMessage(deadline.signal.reason)
        : 'No translator could extract metadata from this page',
    };
    if (diagnostics.length > 0) result.diagnostics = diagnostics;
    return result;
  } catch (e) {
    const result: ExtractMetadataResult = {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
    if (diagnostics.length > 0) result.diagnostics = diagnostics;
    return result;
  } finally {
    deadline?.abort(new Error('Extraction finished'));
    deadline?.dispose();
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
  return translatorsRegistry.filter(isWebTranslator).map((entry) => ({
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
  return sortByTranslatorPriority(findTranslatorsForUrl(url))
    .filter((entry) => entry.metadata.target !== "")
    .map((entry) => ({
    id: entry.metadata.translatorID,
    label: entry.metadata.label,
    target: entry.metadata.target,
    priority: entry.metadata.priority,
  }));
}

// Re-export types
export type {
  ExtractMetadataOptions,
  ExtractMetadataDiagnostic,
  ExtractMetadataResult,
  ZoteroItem,
  ItemType,
  Creator,
  Tag,
  Note,
  Attachment,
} from './types';
