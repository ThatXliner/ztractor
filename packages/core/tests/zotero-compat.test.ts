import { describe, test, expect } from 'bun:test';
import { BundledRegistry } from '../src/index';
import { parseTestCases } from './harness/parse-test-cases';
import { runTranslatorWebTest } from './harness/run-test';

describe('Zotero translator compatibility', { timeout: 30000 }, () => {
	test('harness can extract test cases from a real translator', async () => {
		const registry = new BundledRegistry();
		const allMetadata = await registry.getAllTranslatorMetadata();

		// Find Wikipedia translator
		const wikiMeta = allMetadata.find(m => m.label === 'Wikipedia');
		expect(wikiMeta).toBeDefined();

		const code = await registry.getTranslatorCode(wikiMeta!.translatorID);
		expect(code).toBeDefined();

		const testCases = parseTestCases(code!);
		const webTests = testCases.filter(t => t.type === 'web');

		expect(webTests.length).toBeGreaterThan(0);
	});

	test.skipIf(!process.env.TRANSLATOR_COMPAT)(
		'harness can run a single translator test',
		async () => {
			const registry = new BundledRegistry();
			const allMetadata = await registry.getAllTranslatorMetadata();

			// Try DOI translator first — DOI URLs are stable
			const doiMeta = allMetadata.find(m => m.label === 'DOI');
			expect(doiMeta).toBeDefined();

			const code = await registry.getTranslatorCode(doiMeta!.translatorID);
			expect(code).toBeDefined();

			const testCases = parseTestCases(code!);
			const webTests = testCases.filter(t => t.type === 'web' && !t.defer);

			expect(webTests.length).toBeGreaterThan(0);

			// Run the first non-deferred web test case
			const result = await runTranslatorWebTest(webTests[0], 15000);

			// Result should not be 'skip' — the harness actually ran the test
			expect(result.status).not.toBe('skip');
		},
	);
});
