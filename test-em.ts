import { extractMetadata } from './packages/node/src/index';

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Test Article Title" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="2024-01-15" />
  <meta property="article:author" content="Jane Doe" />
</head>
<body>
  <h1>Test Article</h1>
</body>
</html>
`;

(async () => {
  console.log('Testing embedded translator support...\n');
  
  const result = await extractMetadata({
    url: 'https://www.abc.net.au/news/test',
    html,
  });

  if (result.success && result.items) {
    console.log('✅ SUCCESS!');
    console.log('Translator used:', result.translator);
    console.log('Items extracted:', result.items.length);
    console.log('Title:', result.items[0].title);
  } else {
    console.log('❌ FAILED:', result.error);
  }
})();
