/**
 * Tests for Z object API methods
 */

import { describe, test, expect } from 'bun:test';
import { executeDetectWeb, executeDoWeb, extractMetadata } from '../../node/src';

describe('Realworld examples', () => {
  test('ScienceDirect', async () => {
    const html = Bun.file(new URL("./examples/sciencedirect.html",import.meta.url));
    const metadata =await extractMetadata({url:"https://www.sciencedirect.com/science/article/pii/S0006320723003440", html: await html.text()})
    console.log(metadata);
    expect(metadata.success).toBeTrue();
  });
});
