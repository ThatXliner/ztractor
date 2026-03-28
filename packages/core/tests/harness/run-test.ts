import { extractMetadata } from '../../src/index';
import { parseTestCases } from './parse-test-cases';
import { compareItems } from './compare-items';
import type { ZoteroTestCase, TestResult, TranslatorResult } from './types';
import type { ExtractMetadataOptions } from '../../src/types';

/**
 * Run a single web test case against extractMetadata().
 * Returns a TestResult with pass/fail/skip/partial status.
 */
export async function runTranslatorWebTest(
	testCase: ZoteroTestCase,
	timeoutMs: number = 15000,
	dependencies?: ExtractMetadataOptions['dependencies'],
): Promise<TestResult> {
	const url = testCase.url ?? testCase.input;
	if (!url) {
		return { status: 'skip', reason: 'No URL in test case' };
	}

	// Skip deferred tests — they require JS rendering which ztractor cannot do
	if (testCase.defer) {
		return { status: 'skip', reason: 'Requires JS rendering (defer flag set)' };
	}

	try {
		const result = await extractMetadata({ url, timeout: timeoutMs, ...(dependencies ? { dependencies } : {}) });

		if (!result.success) {
			return { status: 'fail', reason: result.error ?? 'extractMetadata failed' };
		}

		// For "multiple" items tests, just verify something was extracted
		if (testCase.items === 'multiple') {
			return (result.items && result.items.length > 0)
				? { status: 'partial', reason: 'Multiple items test — verified items returned but cannot compare individual items' }
				: { status: 'fail', reason: 'Expected multiple items, got none' };
		}

		// Compare extracted items against expected items
		return compareItems(
			testCase.items,
			result.items as Record<string, unknown>[],
		);
	} catch (e) {
		return {
			status: 'fail',
			reason: e instanceof Error ? e.message : String(e),
		};
	}
}

/**
 * Run all web tests for a single translator.
 * Returns a TranslatorResult summarizing pass/fail/skip/partial.
 */
export async function runTranslatorTests(
	translatorId: string,
	label: string,
	code: string,
	timeoutMs: number = 15000,
): Promise<TranslatorResult> {
	const testCases = parseTestCases(code);
	const webTests = testCases.filter(t => t.type === 'web');

	const result: TranslatorResult = {
		id: translatorId,
		label,
		testCount: webTests.length,
		pass: 0,
		fail: 0,
		skip: 0,
		partial: 0,
		failures: [],
	};

	for (const tc of webTests) {
		const testResult = await runTranslatorWebTest(tc, timeoutMs);
		result[testResult.status]++;

		if (testResult.status === 'fail') {
			result.failures.push({
				url: tc.url ?? tc.input ?? 'unknown',
				reason: testResult.reason ?? 'unknown',
			});
		}
	}

	return result;
}
