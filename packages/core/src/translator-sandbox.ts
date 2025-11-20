/**
 * Translator Sandbox Utilities
 *
 * This module provides request functions for use in translator sandboxes.
 * All functions resolve relative URLs against the page URL and handle DOM parsing properly.
 *
 * NOTE: These are self-contained implementations, not wrappers around utilities.ts,
 * to avoid circular dependencies and keep sandbox utilities independent.
 */

import { parseHTMLDocument } from './executor';
import type { ExtractMetadataOptions } from './types';

type ExecutorDependencies = NonNullable<ExtractMetadataOptions['dependencies']>;

/**
 * Create sandbox request functions that resolve relative URLs
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
   * request() - Returns response object with body, status, headers
   * Resolves relative URLs and fetches content
   */
  const request = async (
    requestUrl: string,
    options?: RequestInit
  ): Promise<{ body: string; status: number; headers: Headers }> => {
    const absoluteUrl = resolveUrl(requestUrl);
    const response = await fetch(absoluteUrl, options);
    const body = await response.text();
    return {
      body,
      status: response.status,
      headers: response.headers,
    };
  };

  /**
   * requestText() - Returns text response
   * Resolves relative URLs and fetches text content
   */
  const requestText = async (
    requestUrl: string,
    options?: RequestInit
  ): Promise<string> => {
    const absoluteUrl = resolveUrl(requestUrl);
    const response = await fetch(absoluteUrl, options);
    return response.text();
  };

  /**
   * requestJSON() - Returns parsed JSON response
   * Resolves relative URLs and fetches/parses JSON
   */
  const requestJSON = async (
    requestUrl: string,
    options?: RequestInit
  ): Promise<any> => {
    const absoluteUrl = resolveUrl(requestUrl);
    const response = await fetch(absoluteUrl, options);
    return response.json();
  };

  /**
   * requestDocument() - Fetches, parses, and returns Document
   * This is the critical function that requires proper DOM parsing
   */
  const requestDocument = async (
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
   * processDocuments() - Fetches and processes multiple documents
   * This is critical for translators that handle "multiple" item types
   */
  const processDocuments = async (
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
    request,
    requestText,
    requestJSON,
    requestDocument,
    processDocuments,
  };
}
