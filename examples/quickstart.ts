/**
 * Quick start example - demonstrates basic usage of Ztractor
 */

import { extractMetadata, findTranslators } from '../src/index';

async function main() {
  console.log('🚀 Ztractor Quick Start\n');

  // Example: Check which translators are available for a URL
  const url = 'https://www.nytimes.com/article';
  console.log(`Finding translators for: ${url}`);

  const translators = await findTranslators(url);
  console.log(`Found ${translators.length} matching translator(s):\n`);

  translators.forEach((t, i) => {
    console.log(`${i + 1}. ${t.label} (priority: ${t.priority})`);
  });

  console.log('\n' + '='.repeat(60) + '\n');

  // Example: Extract metadata with inline HTML
  const testUrl = 'https://example.com/test-article';
  const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Article</title>
        <meta name="author" content="Jane Doe">
        <meta name="description" content="This is a test article">
        <meta property="og:title" content="Test Article - Example Site">
        <meta property="og:type" content="article">
        <meta property="article:published_time" content="2024-01-15T10:00:00Z">
      </head>
      <body>
        <article>
          <h1>Test Article</h1>
          <p>Article content here...</p>
        </article>
      </body>
    </html>
  `;

  console.log('Extracting metadata from test HTML...\n');

  const result = await extractMetadata({
    url: testUrl,
    html: testHtml,
  });

  if (result.success && result.items) {
    console.log(`✅ Success! Used translator: ${result.translator}\n`);
    const item = result.items[0];
    console.log('Extracted metadata:');
    console.log(JSON.stringify(item, null, 2));
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
