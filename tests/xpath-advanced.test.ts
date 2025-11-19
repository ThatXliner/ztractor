import { test, expect, describe } from 'bun:test';
import { parseHTMLDocument } from '../src/executor';

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
