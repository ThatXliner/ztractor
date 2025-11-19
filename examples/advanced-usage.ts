/**
 * Advanced usage examples for Ztractor
 */

import {
  extractMetadata,
  findTranslators,
  getAvailableTranslators,
} from '../src/index';

async function example1() {
  console.log('📋 Example 1: List all available translators\n');

  const translators = await getAvailableTranslators();
  console.log(`Total translators: ${translators.length}\n`);

  // Show first 10
  console.log('First 10 translators:');
  translators.slice(0, 10).forEach((t, i) => {
    console.log(`${i + 1}. ${t.label}`);
    console.log(`   Target: ${t.target.substring(0, 60)}...`);
    console.log(`   Priority: ${t.priority}\n`);
  });
}

async function example2() {
  console.log('\n🔎 Example 2: Find translators for specific URLs\n');

  const urls = [
    'https://www.nytimes.com/article',
    'https://arxiv.org/abs/1234.5678',
    'https://github.com/user/repo',
    'https://www.youtube.com/watch?v=abc123',
  ];

  for (const url of urls) {
    const translators = await findTranslators(url);
    console.log(`${url}`);
    if (translators.length > 0) {
      console.log(`  ✅ ${translators.length} translator(s) available:`);
      translators.forEach((t) => {
        console.log(`     - ${t.label} (priority: ${t.priority})`);
      });
    } else {
      console.log('  ❌ No translators found');
    }
    console.log();
  }
}

async function example3() {
  console.log('\n📊 Example 3: Extract and display full metadata\n');

  const url = 'https://www.abc.net.au/news/2020-05-22/example/12276832';

  const result = await extractMetadata({ url });

  if (result.success && result.items) {
    const item = result.items[0];

    console.log('Full metadata object:');
    console.log(JSON.stringify(item, null, 2));

    console.log('\n---\n');

    // Display in formatted way
    console.log('Formatted output:');
    console.log(`Type: ${item.itemType}`);
    console.log(`Title: ${item.title}`);

    if (item.creators && item.creators.length > 0) {
      console.log('Authors:');
      item.creators.forEach((creator) => {
        const name = creator.name || `${creator.firstName} ${creator.lastName}`;
        console.log(`  - ${name} (${creator.creatorType})`);
      });
    }

    if (item.date) console.log(`Date: ${item.date}`);
    if (item.publicationTitle)
      console.log(`Publication: ${item.publicationTitle}`);
    if (item.DOI) console.log(`DOI: ${item.DOI}`);
    if (item.url) console.log(`URL: ${item.url}`);
    if (item.abstractNote)
      console.log(`Abstract: ${item.abstractNote.substring(0, 200)}...`);

    if (item.tags && item.tags.length > 0) {
      console.log(`Tags: ${item.tags.map((t) => t.tag).join(', ')}`);
    }
  }
}

async function example4() {
  console.log('\n⚙️  Example 4: Custom headers and timeout\n');

  const result = await extractMetadata({
    url: 'https://example.com/article',
    headers: {
      'User-Agent': 'MyApp/1.0',
      Cookie: 'session=abc123',
    },
    timeout: 5000, // 5 seconds
  });

  if (result.success) {
    console.log('✅ Extracted with custom settings');
  } else {
    console.log(`❌ ${result.error}`);
  }
}

async function example5() {
  console.log('\n🔄 Example 5: Batch processing multiple URLs\n');

  const urls = [
    'https://www.abc.net.au/news/article1',
    'https://www.abc.net.au/news/article2',
    'https://www.abc.net.au/news/article3',
  ];

  const results = await Promise.all(
    urls.map((url) => extractMetadata({ url }))
  );

  results.forEach((result, i) => {
    console.log(`${urls[i]}`);
    if (result.success && result.items) {
      console.log(`  ✅ ${result.items[0].title}`);
    } else {
      console.log(`  ❌ ${result.error}`);
    }
  });
}

// Run all examples
async function main() {
  console.log('🚀 Ztractor Advanced Examples\n');
  console.log('='.repeat(60));

  await example1();
  console.log('='.repeat(60));

  await example2();
  console.log('='.repeat(60));

  // Uncomment to run examples that make real HTTP requests
  // await example3();
  // console.log('='.repeat(60));

  // await example4();
  // console.log('='.repeat(60));

  // await example5();
  // console.log('='.repeat(60));

  console.log('\n✨ Done!');
}

if (import.meta.main) {
  main().catch(console.error);
}
