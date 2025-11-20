/**
 * Translator Sandbox Utilities
 *
 * This module provides wrapped versions of utility functions for use in translator sandboxes.
 * All functions resolve relative URLs against the page URL and handle DOM parsing properly.
 */

import { request, requestText, requestJSON } from './utilities';
import { parseHTMLDocument } from './executor';
import type { ExtractMetadataOptions } from './types';

type ExecutorDependencies = NonNullable<ExtractMetadataOptions['dependencies']>;

/**
 * Create wrapped request functions that resolve relative URLs
 */
export function createSandboxRequestFunctions(
  pageUrl: string,
  dependencies: ExecutorDependencies
) {
  /**
   * Resolve relative URL against page URL
   */
  const resolveUrl = (requestUrl: string): string => {
    if (requestUrl.startsWith('/') || requestUrl.startsWith('./')) {
      return new URL(requestUrl, pageUrl).href;
    }
    return requestUrl;
  };

  /**
   * Wrapped request() - Returns response object with body, status, headers
   */
  const wrappedRequest = async (
    requestUrl: string,
    options?: RequestInit
  ): Promise<{ body: string; status: number; headers: Headers }> => {
    const absoluteUrl = resolveUrl(requestUrl);
    return request(absoluteUrl, options);
  };

  /**
   * Wrapped requestText() - Returns text response
   */
  const wrappedRequestText = async (
    requestUrl: string,
    options?: RequestInit
  ): Promise<string> => {
    const absoluteUrl = resolveUrl(requestUrl);
    return requestText(absoluteUrl, options);
  };

  /**
   * Wrapped requestJSON() - Returns parsed JSON response
   */
  const wrappedRequestJSON = async (
    requestUrl: string,
    options?: RequestInit
  ): Promise<any> => {
    const absoluteUrl = resolveUrl(requestUrl);
    return requestJSON(absoluteUrl, options);
  };

  /**
   * Wrapped requestDocument() - Fetches, parses, and returns Document
   * This is the critical function that requires proper DOM parsing
   */
  const wrappedRequestDocument = async (
    requestUrl: string,
    options?: RequestInit
  ): Promise<Document> => {
    const absoluteUrl = resolveUrl(requestUrl);

    // Fetch HTML
    const html = await fetch(absoluteUrl, options).then(r => r.text());

    // Parse with proper DOM support (linkedom in Node.js, native in browser)
    return parseHTMLDocument(html, absoluteUrl, dependencies);
  };

  /**
   * Wrapped processDocuments() - Fetches and processes multiple documents
   * This is critical for translators that handle "multiple" item types
   */
  const wrappedProcessDocuments = async (
    urls: string[],
    processor: (doc: Document, url: string) => void | Promise<void>,
    done?: () => void
  ): Promise<void> => {
    for (const docUrl of urls) {
      try {
        const absoluteUrl = resolveUrl(docUrl);

        // Fetch and parse document
        const html = await fetch(absoluteUrl).then(r => r.text());
        const doc = parseHTMLDocument(html, absoluteUrl, dependencies);

        // Call processor with document and URL
        await processor(doc, absoluteUrl);
      } catch (e) {
        console.error(`Error processing document ${docUrl}:`, e);
      }
    }

    // Call done callback if provided
    if (done) {
      done();
    }
  };

  return {
    request: wrappedRequest,
    requestText: wrappedRequestText,
    requestJSON: wrappedRequestJSON,
    requestDocument: wrappedRequestDocument,
    processDocuments: wrappedProcessDocuments,
  };
}
