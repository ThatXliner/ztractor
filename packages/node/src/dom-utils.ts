import { parseHTML, DOMParser as LinkedomDOMParser } from 'linkedom';
import { select as xpathSelect } from 'xpath';
import { DOMParser as XMLDOMParser } from '@xmldom/xmldom';

/**
 * Wrapped DOMParser that handles edge cases where linkedom fails
 */
export class SafeDOMParser {
  parseFromString(source: string, type: string): Document {
    const parser = new LinkedomDOMParser();
    const doc = parser.parseFromString(source, type);

    // If parsing plain text or invalid content results in no documentElement,
    // wrap it in a proper HTML structure to avoid linkedom errors
    if (!doc.documentElement && type === 'text/html') {
      const wrapped = `<html><body>${source}</body></html>`;
      return parser.parseFromString(wrapped, type);
    }

    return doc;
  }
}

export const DOMParser = SafeDOMParser;

/**
 * Parse HTML string into a Document with XPath support
 */
export function parseHTMLDocument(html: string, url: string): Document {
  const { document } = parseHTML(html);

  // Create a location-like object
  const urlObj = new URL(url);
  const location = {
    href: url,
    protocol: urlObj.protocol,
    host: urlObj.host,
    hostname: urlObj.hostname,
    port: urlObj.port,
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
    origin: urlObj.origin,
  };

  // Add URL to document
  Object.defineProperty(document, 'URL', {
    value: url,
    writable: false,
  });

  Object.defineProperty(document, 'documentURI', {
    value: url,
    writable: false,
  });

  Object.defineProperty(document, 'location', {
    value: location,
    writable: false,
  });

  // Add XPath support using xmldom for XPath queries
  installXPathSupport(document as any, html);

  return document as unknown as Document;
}

/**
 * Install XPath support on a linkedom document
 * Uses xmldom for XPath queries, then maps results back to linkedom nodes
 */
function installXPathSupport(linkedomDoc: any, html: string): void {
  // Create a silent error handler for xmldom to suppress HTML parsing warnings
  const silentErrorHandler = {
    warning: () => {}, // Suppress warnings about HTML syntax in XML mode
    error: (msg: string) => {
      // Only log actual errors, not warnings
      if (msg && !msg.includes('unclosed') && !msg.includes('warning')) {
        console.error('[xmldom]', msg);
      }
    },
    fatalError: (msg: string) => console.error('[xmldom fatal]', msg)
  };

  // Parse with xmldom for XPath support
  const xmlParser = new XMLDOMParser({ errorHandler: silentErrorHandler });
  const xmlDoc = xmlParser.parseFromString(html, 'text/xml');

  // Store xmldom document for XPath queries
  const xmlDocRef = xmlDoc;

  // Add document.evaluate method
  linkedomDoc.evaluate = function(
    expression: string,
    contextNode: Node,
    resolver: any,
    type: number,
    result: any
  ): XPathResult {
    try {
      // Execute XPath on xmldom document
      const xmlNodes = xpathSelect(expression, xmlDocRef);
      const nodeArray = Array.isArray(xmlNodes) ? xmlNodes : [xmlNodes];

      // Map xmldom nodes to linkedom nodes by path
      const linkedomNodes = nodeArray
        .map((xmlNode: any) => {
          if (!xmlNode || !xmlNode.nodeName) return null;
          return findMatchingLinkedomNode(linkedomDoc, xmlNode);
        })
        .filter(Boolean) as Node[];

      return createXPathResult(linkedomNodes);
    } catch (e) {
      console.error('XPath evaluation error:', e);
      return createXPathResult([]);
    }
  };

  // Note: createNSResolver is deprecated, but some old translators may call it
  // Provide a no-op implementation for compatibility
  if (!linkedomDoc.createNSResolver) {
    linkedomDoc.createNSResolver = function(nodeResolver: Node): any {
      return null; // Most translators don't use namespaces
    };
  }
}

/**
 * Find matching linkedom node for an xmldom node
 */
function findMatchingLinkedomNode(linkedomDoc: any, xmlNode: any): Node | null {
  try {
    // Get the node's path
    const path = getNodePath(xmlNode);

    // Navigate to the same path in linkedom document
    let currentNode: any = linkedomDoc.documentElement || linkedomDoc;

    for (const step of path) {
      if (!currentNode.children) return null;

      const children = Array.from(currentNode.children);
      let matchIndex = 0;

      for (const child of children) {
        if ((child as any).nodeName?.toLowerCase() === step.tagName.toLowerCase()) {
          if (matchIndex === step.index) {
            currentNode = child;
            break;
          }
          matchIndex++;
        }
      }
    }

    return currentNode as Node;
  } catch (e) {
    return null;
  }
}

/**
 * Get the path from root to a node
 */
function getNodePath(node: any): Array<{ tagName: string; index: number }> {
  const path: Array<{ tagName: string; index: number }> = [];
  let current = node;

  while (current && current.parentNode) {
    const parent = current.parentNode;
    const tagName = current.nodeName;

    // Find index among siblings with same tag name
    let index = 0;
    if (parent.childNodes) {
      for (const sibling of Array.from(parent.childNodes)) {
        if ((sibling as any).nodeName === tagName) {
          if (sibling === current) break;
          index++;
        }
      }
    }

    path.unshift({ tagName, index });
    current = parent;
  }

  return path;
}

/**
 * Create an XPathResult-like object
 */
function createXPathResult(nodes: Node[]): XPathResult {
  let currentIndex = 0;

  return {
    resultType: 4, // UNORDERED_NODE_ITERATOR_TYPE
    numberValue: NaN,
    stringValue: '',
    booleanValue: false,
    singleNodeValue: nodes[0] || null,
    invalidIteratorState: false,
    snapshotLength: nodes.length,

    iterateNext(): Node | null {
      if (currentIndex < nodes.length) {
        return nodes[currentIndex++];
      }
      return null;
    },

    snapshotItem(index: number): Node | null {
      return nodes[index] || null;
    }
  } as XPathResult;
}
