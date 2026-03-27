# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Runner:**
- Bun test (built-in)
- Config: `packages/core/bunfig.toml`
- Preload setup: `preload = ["./tests/setup.ts"]` in bunfig.toml

**Assertion Library:**
- Bun's built-in test library (imported as `import { test, expect, describe } from "bun:test"`)
- expect() API similar to Jest

**Run Commands:**
```bash
bun test                                           # Run all tests
bun test packages/core/tests/utilities.test.ts    # Run single test file
bun test                                           # Watch mode via IDE
bun run test                                       # Through package.json script
```

## Test File Organization

**Location:**
- Co-located pattern: `packages/*/tests/` directory parallel to `src/`
- Core tests: `packages/core/tests/*.test.ts`
- Node tests: `packages/node/tests/*.test.ts`

**Naming:**
- `.test.ts` suffix: `utilities.test.ts`, `integration.test.ts`, `translator-system-modern.test.ts`
- Descriptive names: `integration.test.ts` for full extraction flow, `translator-system-modern.test.ts` for executor

**Structure:**
```
packages/core/
├── tests/
│   ├── setup.ts                               # Test environment setup
│   ├── utilities.test.ts                      # ZU utility function tests
│   ├── integration.test.ts                    # Full extraction flow
│   ├── translator-system-modern.test.ts       # Core executor & sandbox tests
│   └── (setup files)
├── src/
├── package.json
└── bunfig.toml
```

## Test Setup

**Global Setup (packages/core/tests/setup.ts):**

```typescript
import { DOMParser, parseHTML } from 'linkedom';

if (typeof globalThis.DOMParser === 'undefined') {
  (globalThis as any).DOMParser = DOMParser;
}

if (typeof globalThis.document === 'undefined') {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  (globalThis as any).document = document;
}
```

**What it does:**
- Provides DOM globals (DOMParser, document) for Bun's test environment
- Uses linkedom (already a project dependency) for DOM implementation
- Runs before all tests via `bunfig.toml` preload

## Test Structure

**Suite Organization:**

```typescript
describe("ZU.trimInternal", () => {
  test("removes leading and trailing whitespace", () => {
    expect(ZU.trimInternal("  hello  ")).toBe("hello");
  });

  test("collapses multiple spaces into one", () => {
    expect(ZU.trimInternal("hello   world")).toBe("hello world");
  });

  test("handles newlines and tabs", () => {
    expect(ZU.trimInternal("hello\n\n\tworld")).toBe("hello world");
  });
});
```

**Patterns:**
- Group tests by function/feature: Each `describe()` block tests one function
- Descriptive test names as sentences: `"removes leading and trailing whitespace"`
- One assertion per test typically, sometimes multiple related assertions
- Setup/teardown: Minimal; tests create what they need inline

## Test Types

**Unit Tests (`utilities.test.ts` excerpt):**
- **Scope:** Individual ZoteroUtilities (ZU) functions
- **Approach:** Direct function calls with inputs and assertions
- **Coverage:** Edge cases like empty strings, special characters, format variations
- **Mocking:** None; uses real functions with simple inputs
- **Examples:**
  - `ZU.trimInternal()` with whitespace patterns
  - `ZU.cleanAuthor()` with various name formats
  - `ZU.cleanDOI()` with DOI URL variations
  - `ZU.cleanISBN()` with formatted and unformatted ISBNs

**Integration Tests (`integration.test.ts` excerpt):**
- **Scope:** Full `extractMetadata()` flow with registry and translator matching
- **Approach:** Call main API with URLs and HTML, verify results
- **Coverage:** Translator discovery, URL matching, metadata extraction
- **Setup:** Uses real BundledRegistry and synthetic HTML
- **Examples:**
  - `getAvailableTranslators()` returns 100+ translators
  - `findTranslators()` matches known domains like nature.com, doi.org
  - `extractMetadata()` with Wikipedia-like HTML returns valid items

**Executor Tests (`translator-system-modern.test.ts` excerpt):**
- **Scope:** SandboxManager, ZoteroItem, TranslatorExecutor classes
- **Approach:** Create test translators, execute them, verify output
- **Coverage:** Sandbox isolation, item completion, async execution, error handling
- **Setup:** Creates inline translator code with detectWeb/doWeb functions
- **Examples:**
  - SandboxManager evaluates code and extracts functions
  - ZoteroItem.complete() triggers callback with item data
  - TranslatorExecutor.detectWeb() returns item type
  - TranslatorExecutor.doWeb() collects items via Zotero.Item()
  - Full workflow test with HTML parsing and item collection

## Mocking

**Framework:** Native JavaScript/TypeScript (no mocking library)

**Patterns:**

```typescript
// Mock minimal DOM for testing (utilities.test.ts)
function createMockDocument(html: string): any {
  return {
    querySelector: (selector: string) => {
      if (selector === "a" && html.includes('<a href="https://example.com">')) {
        return {
          getAttribute: (attr: string) =>
            attr === "href" ? "https://example.com" : null,
        };
      }
      return null;
    },
    evaluate: () => ({
      iterateNext: () => null,
      snapshotLength: 0,
      snapshotItem: () => null,
    }),
  };
}
```

**Mock Translator Pattern (translator-system-modern.test.ts):**

```typescript
const translator = {
  metadata: {
    translatorID: 'test-id',
    label: 'Test Translator',
    translatorType: 4,
    target: '',
    priority: 100,
  },
  code: `
    function detectWeb(doc, url) {
      if (url.includes('article')) return 'article';
      return false;
    }
  `,
};
```

**What to Mock:**
- DOM operations: Use linkedom's real DOMParser via test setup
- Translators: Create minimal stub translator objects with metadata and code
- File systems: Not mocked; tests use synthetic data
- Network: Not mocked; integration tests use synthetic HTML instead of fetch

**What NOT to Mock:**
- Core ZoteroUtilities functions: Test real implementations
- SandboxManager execution: Test actual Function() evaluation
- TranslatorExecutor flow: Test real sandbox creation and item collection
- DOM operations in actual tests: Use real DOMParser provided by setup

## Fixtures and Factories

**Test Data:**

```typescript
// HTML fixture (integration.test.ts)
const html = `<!DOCTYPE html>
<html>
<head>
  <title>Fermat's Last Theorem - Wikipedia</title>
  <meta property="og:title" content="Fermat's Last Theorem" />
  <meta name="description" content="In number theory..." />
</head>
<body>
  <h1 id="firstHeading" class="firstHeading">Fermat's Last Theorem</h1>
  <div id="mw-content-text">
    <p>In number theory...</p>
  </div>
</body>
</html>`;
```

**Factory Pattern (translator-system-modern.test.ts):**

```typescript
// Translator factory creates test translators
const translator = {
  metadata: {
    translatorID: 'test-id',
    label: 'Test Translator',
    translatorType: 4,
    target: '',
    priority: 100,
  },
  code: `
    function doWeb(doc, url) {
      const item = new Zotero.Item('article');
      item.title = 'Test Article';
      item.complete();
    }
  `,
};
```

**Location:**
- Inline in test files: No separate fixtures directory
- Reusable HTML templates: Kept in the test function for visibility
- Simple objects: Created directly, not in factories

## Coverage

**Requirements:** None enforced (no coverage config in project)

**Observed Coverage:**
- All ZoteroUtilities functions tested
- Core executor functionality tested
- Integration flows tested
- Error cases tested (translator rejection, item creation)
- Edge cases tested (empty strings, special characters, missing elements)

**Gaps:**
- Browser-specific code path: Node.js setup used in tests
- Network failures: Minimal testing (one timeout test with localhost:1)
- Real translator execution: Minimal (uses synthetic translators)
- XPath operations: Skipped with TODO comment in utilities.test.ts

**View Coverage:**
No command available (no coverage setup)

## Common Patterns

**Async Testing:**

```typescript
// Integration test with async extraction
test("extracts metadata from Wikipedia-like HTML", async () => {
  const result = await extractMetadata({
    url: "https://en.wikipedia.org/wiki/Fermat%27s_Last_Theorem",
    html,
  });

  if (result.success) {
    expect(result.items).toBeDefined();
    expect(result.items!.length).toBeGreaterThan(0);
  } else {
    expect(result.error).toBeTruthy();
  }
});

// Executor test with async doWeb
test("doWeb executes and returns items", async () => {
  const items = await executor.doWeb(translator, doc, 'http://example.com');
  expect(items).toHaveLength(1);
});

// Async support testing
test("supports async translators", async () => {
  const code = `
    async function doWeb(doc, url) {
      await new Promise(resolve => setTimeout(resolve, 10));
      const item = new Zotero.Item('article');
      item.complete();
    }
  `;
  // Test and await execution
});
```

**Error Testing:**

```typescript
// Null/false returns
test("returns null for invalid input", () => {
  expect(ZU.cleanDOI("")).toBeNull();
  expect(ZU.cleanDOI("not a doi")).toBeNull();
});

// Empty results
test("handles translator errors gracefully", async () => {
  const translator = { /* throws error in doWeb */ };
  const items = await executor.doWeb(translator, doc, 'http://example.com');
  expect(items).toEqual([]); // Empty on error
});

// Result object pattern
test("returns failure for a page no translator can extract", async () => {
  const result = await extractMetadata({
    url: "https://unknown-site.example/",
    html: "<html><body><h1>Nothing</h1></body></html>",
  });
  expect(result.success).toBe(false);
});

// Conditional assertions
test("either no translators matched or none could extract", async () => {
  for (const t of translators) {
    expect(t.target === "" || "url".match(t.target)).toBeTruthy();
  }
});
```

**Data Transformation Testing:**

```typescript
// Test author parsing variations
test("parses last, first format with comma in name", () => {
  const author = ZU.cleanAuthor("Van Der Berg, Jan", "author", true);
  expect(author.firstName).toBe("Jan");
  expect(author.lastName).toBe("Van Der Berg");
});

// Test DOI extraction from various formats
test("extracts DOI from URL", () => {
  expect(ZU.cleanDOI("https://doi.org/10.1234/example.doi"))
    .toBe("10.1234/example.doi");
});

// Test item type detection
test("detectWeb executes and returns item type", async () => {
  const result1 = await executor.detectWeb(translator, doc, 'http://example.com/article');
  expect(result1).toBe('article');

  const result2 = await executor.detectWeb(translator, doc, 'http://example.com/page');
  expect(result2).toBe(false);
});
```

## Test Examples

**Full Translator Workflow Test:**

From `translator-system-modern.test.ts`:

```typescript
describe('Complete Translator Workflow', () => {
  test('full extraction workflow', async () => {
    const executor = new TranslatorExecutor();

    const translator = {
      metadata: {
        translatorID: 'full-test',
        label: 'Full Test Translator',
        translatorType: 4,
        target: 'example\\.com',
        priority: 100,
      },
      code: `
        function detectWeb(doc, url) {
          if (doc.querySelector('article')) {
            return 'article';
          }
          return false;
        }

        function doWeb(doc, url) {
          const item = new Zotero.Item('article');
          item.title = text(doc.querySelector('h1.title'));
          item.url = url;
          item.complete();
        }
      `,
    };

    const html = `<html><body>
      <article>
        <h1 class="title">Advanced JavaScript Techniques</h1>
      </article>
    </body></html>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const itemType = await executor.detectWeb(translator, doc, url);
    expect(itemType).toBe('article');

    const items = await executor.doWeb(translator, doc, url);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Advanced JavaScript Techniques');
  });
});
```

---

*Testing analysis: 2026-03-26*
