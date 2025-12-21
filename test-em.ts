import { ZU } from './packages/core/src/utilities-bundle';

const testString = "J";
console.log('Testing XRegExp with "\\pL":');
try {
  const regex = ZU.XRegExp('\\pL');
  console.log('Regex created:', regex);
  console.log('Test result:', regex.test(testString));
} catch (e) {
  console.log('Error:', e);
}

console.log('\nTesting cleanAuthor:');
const result = ZU.cleanAuthor('John Doe', 'author');
console.log('Result:', JSON.stringify(result, null, 2));
