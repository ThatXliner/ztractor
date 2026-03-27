import { normalizeItem } from './normalize-item';
import type { TestResult } from './types';

/**
 * Compare expected items against actual items using relaxed field equality.
 * Relaxed = every field in expected must be present and match in actual.
 * Extra fields in actual are allowed (not treated as failures).
 */
export function compareItems(
	expected: Record<string, unknown>[],
	actual: Record<string, unknown>[]
): TestResult {
	if (expected.length !== actual.length) {
		return {
			status: 'fail',
			reason: `Expected ${expected.length} item(s), got ${actual.length}`,
		};
	}

	const details: TestResult['details'] = [];

	for (let i = 0; i < expected.length; i++) {
		const exp = normalizeItem(expected[i]);
		const act = normalizeItem(actual[i]);

		for (const [key, expVal] of Object.entries(exp)) {
			const actVal = act[key];
			const expJSON = JSON.stringify(expVal);
			const actJSON = JSON.stringify(actVal);

			if (expJSON !== actJSON) {
				// abstractNote: Wikipedia (and some translators) always return the CURRENT intro text
				// from the live API, not the historical text stored in the test case. Accept any
				// non-empty actual value when expected is a long text block (> 80 chars).
				if (key === 'abstractNote' && typeof expVal === 'string' && expVal.length > 80
					&& typeof actVal === 'string' && actVal.length > 0) {
					continue;
				}
				details.push({ field: `items[${i}].${key}`, expected: expVal, actual: actVal });
			}
		}
	}

	if (details.length > 0) {
		return {
			status: 'fail',
			reason: `${details.length} field mismatch(es)`,
			details,
		};
	}

	return { status: 'pass' };
}
