import { test, expect, describe } from 'bun:test';
import { DOMParser, parseHTMLDocument } from '../src/dom-utils';
import { executeDetectWeb, executeDoWeb } from 'ztractor';

describe('Advanced XPath Support', () => {
  const html = `
    <html>
      <body>
        <div class="container">
          <article>
            <a href="/article1" class="link">Article 1</a>
            <span class="date">2024-01-01</span>
          </article>
          <article>
            <a href="/article2" class="link active">Article 2</a>
            <span class="date">2024-01-02</span>
          </article>
          <div class="sidebar">
            <p>Sidebar content</p>
          </div>
        </div>
        <dt class="author">John Doe</dt>
        <dd><a href="/author/john">Profile</a></dd>
      </body>
    </html>
  `;

  test('supports contains() function with attributes', () => {
    const doc = parseHTMLDocument(html, 'https://example.com');
    const result = doc.evaluate('//a[contains(@class, "link")]', doc, null, 0, null);

    const nodes = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node);
    }

    expect(nodes.length).toBe(2);
    expect(nodes[0].textContent).toBe('Article 1');
    expect(nodes[1].textContent).toBe('Article 2');
  });

  test('supports contains() function with text()', () => {
    const doc = parseHTMLDocument(html, 'https://example.com');
    const result = doc.evaluate('//dt[contains(text(), "John")]', doc, null, 0, null);

    const nodes = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node);
    }

    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('John Doe');
  });

  test('supports nested paths with //', () => {
    const doc = parseHTMLDocument(html, 'https://example.com');
    const result = doc.evaluate('//article//a[contains(@href, "article")]', doc, null, 0, null);

    const nodes = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node);
    }

    expect(nodes.length).toBe(2);
  });

  test('supports following-sibling axis', () => {
    const doc = parseHTMLDocument(html, 'https://example.com');
    const result = doc.evaluate('//dt/following-sibling::dd[1]/a', doc, null, 0, null);

    const nodes = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node);
    }

    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Profile');
    expect((nodes[0] as Element).getAttribute('href')).toBe('/author/john');
  });

  test('supports attribute predicates', () => {
    const doc = parseHTMLDocument(html, 'https://example.com');
    const result = doc.evaluate('//a[@class="link active"]', doc, null, 0, null);

    const nodes = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node);
    }

    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Article 2');
  });

  test('returns attribute nodes for attribute selections', () => {
    const doc = parseHTMLDocument(html, 'https://example.com');
    const result = doc.evaluate('//article[1]/a/@href', doc, null, 0, null);

    const node = result.iterateNext() as Attr | null;

    expect(node?.nodeType).toBe(2);
    expect(node?.value).toBe('/article1');
  });

  test('maps attributes in documents with doctypes', () => {
    const doc = parseHTMLDocument(
      '<!doctype html><html><body><a id="permalink" href="/stable">Stable</a></body></html>',
      'https://example.com'
    );
    const result = doc.evaluate('//a[@id="permalink"]/@href', doc, null, 0, null);

    expect((result.iterateNext() as Attr | null)?.value).toBe('/stable');
  });

  test('resolves XHTML namespaces and preserves attribute node values', () => {
    const doc = parseHTMLDocument(
      '<!doctype html><html><head><meta name="citation_author" content="Doe, Jane"></head><body></body></html>',
      'https://example.com'
    );
    const result = doc.evaluate(
      '/x:html/x:head/x:meta[@name="citation_author"]/@content',
      doc,
      (prefix: string) => prefix === 'x' ? 'http://www.w3.org/1999/xhtml' : null,
      0,
      null,
    );

    expect((result.iterateNext() as Attr | null)?.nodeValue).toBe('Doe, Jane');
  });

  test('returns scalar XPath results for unprefixed HTML queries', () => {
    const doc = parseHTMLDocument('<html><body><h1>A</h1></body></html>', 'https://example.com');

    expect(doc.evaluate('count(//h1)', doc, null, 1, null).numberValue).toBe(1);
    expect(doc.evaluate('string(//h1)', doc, null, 2, null).stringValue).toBe('A');
    expect(doc.evaluate('boolean(//h1)', doc, null, 3, null).booleanValue).toBe(true);
  });

  test('installs XPath support on DOMParser-created XML documents', () => {
    const doc = new DOMParser().parseFromString(
      '<root><article><title>Example</title></article></root>',
      'text/xml'
    );
    const result = doc.evaluate('/root/article/title', doc, null, 0, null);

    expect(result.iterateNext()?.textContent).toBe('Example');
  });

  test('evaluates relative XPath against the provided context node', () => {
    const doc = new DOMParser().parseFromString(
      '<root><article><title>First</title></article><article><title>Second</title></article></root>',
      'text/xml'
    );
    const article = doc.querySelectorAll('article')[1];
    const result = doc.evaluate('title', article, null, 0, null);

    expect(result.iterateNext()?.textContent).toBe('Second');
  });

  test('supports position predicates', () => {
    const doc = parseHTMLDocument(html, 'https://example.com');
    const result = doc.evaluate('//article[1]//a', doc, null, 0, null);

    const nodes = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node);
    }

    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Article 1');
  });
});
