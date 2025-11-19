/**
 * Simple example - shows basic library functionality
 */

import { extractMetadata, findTranslators, getAvailableTranslators } from '../src/index';

async function main() {
  console.log('🚀 Ztractor - Simple Example\n');

  // Example 1: List some available translators
  console.log('Example 1: Available translators\n');
  const allTranslators = await getAvailableTranslators();
  console.log(`Total translators available: ${allTranslators.length}`);
  console.log('\nSome examples:');
  allTranslators.slice(0, 10).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.label} (priority: ${t.priority})`);
  });

  console.log('\n' + '='.repeat(60) + '\n');

  // Example 2: Find translators for specific URLs
  console.log('Example 2: Finding translators for URLs\n');

  const testUrls = [
    'https://www.nytimes.com/article',
    'https://en.wikipedia.org/wiki/Test',
    'https://github.com/user/repo',
    'https://www.youtube.com/watch?v=test',
  ];

  for (const url of testUrls) {
    const translators = await findTranslators(url);
    if (translators.length > 0) {
      console.log(`  ${url}`);
      console.log(`    → ${translators[0].label}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Example 3: How to extract metadata
  console.log('Example 3: Extracting metadata\n');
  console.log('To extract metadata from a real website:');
  console.log('');
  console.log('  // Automatically fetches HTML');
  console.log('  const result = await extractMetadata("https://example.com/article");');
  console.log('');
  console.log('  // Or provide HTML yourself');
  console.log('  const html = await fetch(url).then(r => r.text());');
  console.log('  const result = await extractMetadata({ url, html });');
  console.log('');
  console.log('  if (result.success && result.items) {');
  console.log('    console.log(result.items[0].title);');
  console.log('    console.log(result.items[0].creators);');
  console.log('    console.log(result.items[0].date);');
  console.log('  }');

  console.log('\n✅ All 682 translators bundled at build time - no runtime file I/O!');
}

if (import.meta.main) {
  main().catch(console.error);
}
