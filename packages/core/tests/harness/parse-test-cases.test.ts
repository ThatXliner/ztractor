import { describe, test, expect } from 'bun:test';
import { parseTestCases } from './parse-test-cases';
import { BundledRegistry } from '../../src/index';

function makeCode(json: string): string {
	return `function detectWeb() { return 'webpage'; }\n/** BEGIN TEST CASES **/\nvar testCases = ${json};\n/** END TEST CASES **/`;
}

describe('parseTestCases', () => {
	test('parses a minimal code string with one web test case', () => {
		const code = makeCode('[{"type":"web","url":"https://example.com","items":[{"itemType":"webpage","title":"Test"}]}]');
		const testCases = parseTestCases(code);
		expect(testCases).toHaveLength(1);
		expect(testCases[0].type).toBe('web');
		expect(testCases[0].url).toBe('https://example.com');
	});

	test('returns empty array when code has no test case markers', () => {
		const code = 'function detectWeb() { return \'webpage\'; }';
		expect(parseTestCases(code)).toEqual([]);
	});

	test('returns empty array when JSON between markers is malformed', () => {
		const code = `function detectWeb() {}\n/** BEGIN TEST CASES **/\nvar testCases = [invalid json];\n/** END TEST CASES **/`;
		expect(parseTestCases(code)).toEqual([]);
	});

	test('handles multiple test cases', () => {
		const code = makeCode('[{"type":"web","url":"https://a.com","items":[]},{"type":"web","url":"https://b.com","items":[]},{"type":"web","url":"https://c.com","items":[]}]');
		const testCases = parseTestCases(code);
		expect(testCases).toHaveLength(3);
	});

	test('handles items: "multiple" test cases', () => {
		const code = makeCode('[{"type":"web","url":"https://example.com","items":"multiple"}]');
		const testCases = parseTestCases(code);
		expect(testCases[0].items).toBe('multiple');
	});

	test('reads real translator code from BundledRegistry', async () => {
		const registry = new BundledRegistry();
		const allMetadata = await registry.getAllTranslatorMetadata();
		// Find first web translator (translatorType 4)
		const webTranslator = allMetadata.find((m) => m.translatorType === 4);
		expect(webTranslator).toBeDefined();
		const code = await registry.getTranslatorCode(webTranslator!.translatorID);
		expect(code).toBeDefined();
		const testCases = parseTestCases(code!);
		expect(Array.isArray(testCases)).toBe(true);
		expect(testCases.length).toBeGreaterThan(0);
	});
});
