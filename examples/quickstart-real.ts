/**
 * Quick start example - demonstrates basic usage of Ztractor
 */

import { extractMetadata, findTranslators } from '../src/index';

async function main() {
  console.log('🚀 Ztractor Quick Start\n');

  // Example 1: Check which translators are available for a URL
  const url = 'https://www.nytimes.com/article';
  console.log(`Example 1: Finding translators for ${url}`);

  const translators = await findTranslators(url);
  console.log(`Found ${translators.length} matching translator(s):`);

  translators.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.label} (priority: ${t.priority})`);
  });

  console.log('\n' + '='.repeat(60) + '\n');

  // Example 2: Extract metadata from a real URL (fetches HTML automatically)
  console.log('Example 2: Extracting metadata from Wikipedia...\n');

  const wikiUrl = 'https://en.wikipedia.org/wiki/TypeScript';
  console.log(`Fetching: ${wikiUrl}`);

  const result = await extractMetadata(wikiUrl);

  if (result.success && result.items) {
    console.log(`✅ Success! Used translator: ${result.translator}\n`);
    const item = result.items[0];

    console.log('Extracted metadata:');
    console.log(`  Title: ${item.title}`);
    if (item.creators && item.creators.length > 0) {
      console.log(`  Authors: ${item.creators.slice(0, 3).map(c =>
        c.lastName ? `${c.firstName} ${c.lastName}` : c.name
      ).join(', ')}${item.creators.length > 3 ? ` (and ${item.creators.length - 3} more)` : ''}`);
    }
    if (item.date) console.log(`  Date: ${item.date}`);
    if (item.DOI) console.log(`  DOI: ${item.DOI}`);
    if (item.abstractNote) {
      const abstract = item.abstractNote.substring(0, 150);
      console.log(`  Abstract: ${abstract}${item.abstractNote.length > 150 ? '...' : ''}`);
    }

    console.log('\n  Full metadata available in result.items[0]');
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
  console.log('💡 Tip: You can also provide pre-fetched HTML:');
  console.log('   const html = await fetch(url).then(r => r.text());');
  console.log('   await extractMetadata({ url, html });');
}

if (import.meta.main) {
  main().catch(console.error);
}
