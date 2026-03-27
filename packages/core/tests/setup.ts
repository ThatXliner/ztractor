/**
 * Test setup: provide DOM globals (DOMParser, document) for Bun's test environment
 * using linkedom, which is already a project dependency.
 */
import { DOMParser, parseHTML } from 'linkedom';

if (typeof globalThis.DOMParser === 'undefined') {
  (globalThis as any).DOMParser = DOMParser;
}

if (typeof globalThis.document === 'undefined') {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  (globalThis as any).document = document;
}
