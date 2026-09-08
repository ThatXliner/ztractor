import { parseHTML, DOMParser as LinkedomDOMParser } from 'linkedom';
import { selectWithResolver as xpathSelectWithResolver } from 'xpath';
import { DOMParser as XMLDOMParser } from '@xmldom/xmldom';

/**
 * Wrapped DOMParser that handles edge cases where linkedom fails
 */
export class SafeDOMParser {
  parseFromString(source: string, type: string): Document {
    const parser = new LinkedomDOMParser();
    const mimeType = type === 'image/svg+xml' ? 'image/svg+xml' : type.includes('xml') ? 'text/xml' : 'text/html';
    let doc = parser.parseFromString(source, mimeType) as unknown as Document;

    // If parsing plain text or invalid content results in no documentElement,
    // wrap it in a proper HTML structure to avoid linkedom errors
    if (!doc.documentElement && type === 'text/html') {
      const wrapped = `<html><body>${source}</body></html>`;
      doc = parser.parseFromString(wrapped, 'text/html') as unknown as Document;
    }

    installXPathSupport(doc as any, doc.toString(), type);
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
  installXPathSupport(document as any, document.toString(), 'text/html');

  return document as unknown as Document;
}

/**
 * Install XPath support on a linkedom document
 * Uses xmldom for XPath queries, then maps results back to linkedom nodes
 */
function installXPathSupport(linkedomDoc: any, source: string, contentType: string): void {
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
  const xmlDoc = xmlParser.parseFromString(
    source,
    contentType.toLowerCase().includes('xml') ? 'text/xml' : 'text/html',
  );
  const compatibilityXmlDoc = contentType.toLowerCase().includes('xml')
    ? xmlDoc
    : xmlParser.parseFromString(source, 'text/xml');

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
      const useCompatibilityDocument = !contentType.toLowerCase().includes('xml') && !resolver;
      let selectedDoc = useCompatibilityDocument ? compatibilityXmlDoc : xmlDocRef;
      let xmlContextNode = mapLinkedomNodeToXmlNode(selectedDoc, linkedomDoc, contextNode)
        || selectedDoc;
      let xpathResult = xpathSelectWithResolver(
        expression,
        xmlContextNode,
        toXPathResolver(resolver, xmlContextNode),
      );
      if (typeof xpathResult === 'string') return createXPathResult([], { stringValue: xpathResult }, type);
      if (typeof xpathResult === 'number') return createXPathResult([], { numberValue: xpathResult }, type);
      if (typeof xpathResult === 'boolean') return createXPathResult([], { booleanValue: xpathResult }, type);
      const nodeArray = Array.isArray(xpathResult) ? xpathResult : [xpathResult];

      // Map xmldom nodes to linkedom nodes by path
      const linkedomNodes = nodeArray
        .map((xmlNode: any) => mapXmlNodeToLinkedomNode(linkedomDoc, xmlNode))
        .filter(Boolean) as Node[];

      return createXPathResult(linkedomNodes, {}, type);
    } catch (e) {
      console.error('XPath evaluation error:', e);
      return createXPathResult([], {}, type);
    }
  };

  // Note: createNSResolver is deprecated, but some old translators may call it.
  if (!linkedomDoc.createNSResolver) {
    linkedomDoc.createNSResolver = function(nodeResolver: Node): any {
      const xmlNode = mapLinkedomNodeToXmlNode(xmlDocRef, linkedomDoc, nodeResolver) || xmlDocRef;
      return (prefix: string) => xmlNode.lookupNamespaceURI?.(prefix) ?? null;
    };
  }
}

function toXPathResolver(resolver: any, contextNode: any): { lookupNamespaceURI(prefix: string): string | null } {
  return {
    lookupNamespaceURI(prefix: string): string | null {
      if (resolver != null) {
        return typeof resolver === 'function'
          ? resolver(prefix) ?? null
          : resolver.lookupNamespaceURI?.(prefix) ?? resolver[prefix] ?? null;
      }
      return contextNode.lookupNamespaceURI?.(prefix) ?? null;
    },
  };
}

function mapXmlNodeToLinkedomNode(linkedomDoc: any, xmlNode: any): Node | null {
  if (!xmlNode || !xmlNode.nodeName) return null;

  if (xmlNode.nodeType === 2 && xmlNode.ownerElement) {
    const owner = findMatchingLinkedomNode(linkedomDoc, xmlNode.ownerElement) as Element | null;
    const attribute = owner?.getAttributeNode?.(xmlNode.nodeName) as Attr | null;
    if (attribute && attribute.nodeValue == null) {
      Object.defineProperty(attribute, 'nodeValue', {
        value: xmlNode.nodeValue,
        configurable: true,
      });
    }
    return attribute;
  }

  if (xmlNode.nodeType === 3 && xmlNode.parentNode) {
    const parent = findMatchingLinkedomNode(linkedomDoc, xmlNode.parentNode);
    if (!parent) return null;
    const xmlSiblings = Array.from(xmlNode.parentNode.childNodes || []).filter((node: any) => node.nodeType === 3);
    const index = xmlSiblings.indexOf(xmlNode);
    return Array.from(parent.childNodes || []).filter((node: any) => node.nodeType === 3)[index] as Node | null;
  }

  return findMatchingLinkedomNode(linkedomDoc, xmlNode);
}

function mapLinkedomNodeToXmlNode(xmlDoc: any, linkedomDoc: any, linkedomNode: any): any | null {
  if (!linkedomNode || linkedomNode === linkedomDoc) return xmlDoc;
  return findMatchingNodeByPath(xmlDoc, linkedomNode);
}

function getElementChildren(node: any): any[] {
  return Array.from(node.children || node.childNodes || [])
    .filter((child: any) => child?.nodeType === 1);
}

function findMatchingNodeByPath(rootDoc: any, sourceNode: any): any | null {
  try {
    const path = getNodePath(sourceNode);
    let currentNode: any = rootDoc;

    for (const step of path) {
      const children = getElementChildren(currentNode);
      let matchIndex = 0;
      let matchedNode: any = null;

      for (const child of children) {
        if (child.nodeName?.toLowerCase() === step.tagName.toLowerCase()) {
          if (matchIndex === step.index) {
            matchedNode = child;
            break;
          }
          matchIndex++;
        }
      }

      if (!matchedNode) return null;
      currentNode = matchedNode;
    }

    return currentNode;
  } catch (_e) {
    return null;
  }
}

/**
 * Find matching linkedom node for an xmldom node
 */
function findMatchingLinkedomNode(linkedomDoc: any, xmlNode: any): Node | null {
  return findMatchingNodeByPath(linkedomDoc, xmlNode) as Node | null;
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
        if ((sibling as any).nodeType === 1 && (sibling as any).nodeName === tagName) {
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
function createXPathResult(
  nodes: Node[],
  scalar: { stringValue?: string; numberValue?: number; booleanValue?: boolean } = {},
  requestedType = 0,
): XPathResult {
  let currentIndex = 0;
  const naturalType = scalar.stringValue !== undefined ? 2 : scalar.numberValue !== undefined ? 1 : scalar.booleanValue !== undefined ? 3 : 4;

  return {
    resultType: requestedType === 0 ? naturalType : requestedType,
    numberValue: scalar.numberValue ?? NaN,
    stringValue: scalar.stringValue ?? '',
    booleanValue: scalar.booleanValue ?? false,
    singleNodeValue: nodes[0] || null,
    invalidIteratorState: false,
    snapshotLength: nodes.length,

    iterateNext(): Node | null {
      if (currentIndex < nodes.length) {
        return nodes[currentIndex++] ?? null;
      }
      return null;
    },

    snapshotItem(index: number): Node | null {
      return nodes[index] || null;
    }
  } as XPathResult;
}
