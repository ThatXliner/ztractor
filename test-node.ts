import { extractMetadata, getAvailableTranslators } from './packages/node/src/index.ts';

console.log('Checking available translators...');
const translators = await getAvailableTranslators();
console.log(`Found ${translators.length} translators.`);

const url = 'https://www.example.com';
console.log(`\nExtracting metadata from ${url}...`);
const result = await extractMetadata(url);

console.log('Result success:', result.success);
if (!result.success) {
  console.log('Error:', result.error);
} else {
  console.log('Items:', result.items);
}
