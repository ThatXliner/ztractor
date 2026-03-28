import { describe, test, expect } from 'bun:test';
import { BundledRegistry } from '../src/index';
import { parseTestCases } from './harness/parse-test-cases';
import { runTranslatorWebTest } from './harness/run-test';
import type { ZoteroTestCase } from './harness/types';
import { parseHTMLDocument } from '../../node/src/dom-utils';

describe('Zotero translator compatibility', { timeout: 30000 }, () => {
	async function runTranslatorTest(translatorLabel: string, caseFilter?: (c: ZoteroTestCase) => boolean) {
		const registry = new BundledRegistry();
		const meta = (await registry.getAllTranslatorMetadata()).find(m => m.label === translatorLabel);
		expect(meta).toBeDefined();
		const code = await registry.getTranslatorCode(meta!.translatorID);
		expect(code).toBeDefined();
		// Exclude deferred and 'multiple'-item cases so we always get a comparable single-item test
		const cases = parseTestCases(code!).filter(t => t.type === 'web' && !t.defer && t.items !== 'multiple');
		expect(cases.length).toBeGreaterThan(0);
		const testCase = caseFilter ? cases.find(caseFilter) ?? cases[0] : cases[0];
		// Inject XPath-capable parseHTMLDocument for translators that use XPath queries
		const result = await runTranslatorWebTest(testCase, 30000, { parseHTMLDocument });
		return result;
	}

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

	test.skipIf(!process.env.TRANSLATOR_COMPAT)(
		'Wikipedia: single article passes Zotero test case',
		async () => {
			// Use the English Zotero article (oldid=485342619) — stable pinned revision
			const result = await runTranslatorTest('Wikipedia', c => !!c.url?.includes('Zotero'));
			expect(result.status).toBe('pass');
		},
		{ timeout: 30000 }
	);

	test.skipIf(!process.env.TRANSLATOR_COMPAT)(
		'arXiv: single paper passes Zotero test case',
		async () => {
			// Use the BERT v2 case — stable preprint with a known-passing arxiv API response
			const result = await runTranslatorTest('arXiv.org', c => !!c.url?.includes('1810.04805v2'));
			expect(result.status).toBe('pass');
		},
		{ timeout: 30000 }
	);

	test.skipIf(!process.env.TRANSLATOR_COMPAT)(
		'reddit: forum post passes Zotero test case',
		async () => {
			// Filter for a single forumPost item (not a search/listing page with multiple items)
			const result = await runTranslatorTest('reddit', c => typeof c.items !== 'string' && (c.items as any)[0]?.itemType === 'forumPost');
			expect(result.status).toBe('pass');
		},
		{ timeout: 30000 }
	);

	test.skipIf(!process.env.TRANSLATOR_COMPAT)(
		'news site: article passes Zotero test case',
		async () => {
			// Use NPR — stable news translator with a known-passing test case
			const result = await runTranslatorTest('NPR');
			expect(result.status).toBe('pass');
		},
		{ timeout: 30000 }
	);

});
// ScienceDirect requires Playwright (JS-rendered page, bot detection on RIS endpoint).
// See .planning/seeds/SEED-001-playwright-browser-testing.md — deferred to v2.
