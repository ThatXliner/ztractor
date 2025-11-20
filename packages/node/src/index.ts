import { extractMetadata as coreExtractMetadata, type ExtractMetadataOptions, type ExtractMetadataResult } from 'ztractor';
import { DOMParser, parseHTMLDocument } from './dom-utils';

export * from 'ztractor';

/**
 * Extract metadata from a URL (Node.js version with injected dependencies)
 */
export async function extractMetadata(
  options: string | ExtractMetadataOptions
): Promise<ExtractMetadataResult> {
  const opts: ExtractMetadataOptions =
    typeof options === 'string' ? { url: options } : options;

  return coreExtractMetadata({
    ...opts,
    dependencies: {
      DOMParser: DOMParser as any,
      parseHTMLDocument,
    },
  });
}
