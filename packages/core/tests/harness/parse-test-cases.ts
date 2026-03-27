import type { ZoteroTestCase } from './types';

export function parseTestCases(code: string): ZoteroTestCase[] {
	const testStart = code.indexOf('/** BEGIN TEST CASES **/');
	const testEnd = code.indexOf('/** END TEST CASES **/');
	if (testStart === -1 || testEnd === -1) return [];

	const testsJSON = code
		.substring(testStart + 24, testEnd)
		.replace(/^[\s\r\n]*var testCases\s*=\s*/, '')
		.replace(/;[\s\r\n]*$/, '');

	try {
		const tests = JSON.parse(testsJSON);
		return Array.isArray(tests) ? tests : [];
	} catch {
		return [];
	}
}
