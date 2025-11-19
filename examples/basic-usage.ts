/**
 * Basic usage example for Ztractor
 */

import { extractMetadata } from '../src/index';

async function main() {
  console.log('🔍 Ztractor - Extract metadata from websites\n');

  // Example 1: Extract from URL (will fetch HTML automatically)
  console.log('Example 1: ABC News Australia article');
  const result1 = await extractMetadata({
    url: 'https://www.abc.net.au/news/2020-05-22/nt-government-coronavirus-recovery-commission-michael-gunner/12276832',
  });

  if (result1.success && result1.items) {
    console.log(`✅ Success! Used translator: ${result1.translator}`);
    const item = result1.items[0];
    console.log(`   Title: ${item.title}`);
    console.log(`   Type: ${item.itemType}`);
    console.log(`   Date: ${item.date}`);
    console.log(`   Authors: ${item.creators?.map((c) => `${c.firstName} ${c.lastName}`).join(', ')}`);
    console.log(`   Publication: ${item.publicationTitle}`);
  } else {
    console.log(`❌ Failed: ${result1.error}`);
  }

  console.log('\n---\n');

  // Example 2: With pre-fetched HTML
  console.log('Example 2: With pre-fetched HTML');
  const url = 'https://example.com/article';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Example Article</title>
        <meta property="og:title" content="Example Article Title" />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content="2024-01-15" />
        <meta property="article:author" content="Jane Doe" />
      </head>
      <body>
        <article>
          <h1>Example Article Title</h1>
          <p>Article content here...</p>
        </article>
      </body>
    </html>
  `;

  const result2 = await extractMetadata({ url, html });

  if (result2.success && result2.items) {
    console.log(`✅ Success! Used translator: ${result2.translator}`);
    const item = result2.items[0];
    console.log(`   Title: ${item.title}`);
    console.log(`   Type: ${item.itemType}`);
  } else {
    console.log(`❌ Failed: ${result2.error}`);
  }

  console.log('\n---\n');

  // Example 3: Simple API - just pass URL string
  console.log('Example 3: Simple API with URL string');
  const result3 = await extractMetadata(
    'https://www.nytimes.com/2024/01/15/technology/example.html'
  );

  if (result3.success) {
    console.log(`✅ Found ${result3.items?.length} item(s)`);
  } else {
    console.log(`❌ Failed: ${result3.error}`);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
