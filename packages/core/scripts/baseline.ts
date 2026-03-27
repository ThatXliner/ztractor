/**
 * Generate the baseline compatibility report.
 *
 * Usage:
 *   bun run baseline              # Test sample translators (SAMPLE_TRANSLATORS list)
 *   FULL_HARNESS=1 bun run baseline  # Test ALL translators with web tests (slow, hours)
 *   TRANSLATOR_FILTER="Wikipedia,DOI" bun run baseline  # Test specific translators
 */
import { join } from 'node:path';
import { BundledRegistry } from '../src/index';
import { parseTestCases } from '../tests/harness/parse-test-cases';
import { generateBaselineReport, printSummary, writeReportToFile, SAMPLE_TRANSLATORS } from '../tests/harness/report';

async function main() {
	const outputPath = join(import.meta.dir, '..', 'tests', 'baseline-report.json');
	const timeoutMs = Number(process.env.TIMEOUT) || 15000;

	let translatorLabels: string[] | undefined;

	if (process.env.TRANSLATOR_FILTER) {
		translatorLabels = process.env.TRANSLATOR_FILTER.split(',').map(s => s.trim());
	} else if (process.env.FULL_HARNESS) {
		// Run ALL translators with web tests
		const registry = new BundledRegistry();
		const allMetadata = await registry.getAllTranslatorMetadata();
		translatorLabels = [];
		for (const meta of allMetadata) {
			const code = await registry.getTranslatorCode(meta.translatorID);
			if (!code) continue;
			const tests = parseTestCases(code).filter(t => t.type === 'web');
			if (tests.length > 0) translatorLabels.push(meta.label);
		}
		console.log(`Full harness: testing ${translatorLabels.length} translators`);
	} else {
		translatorLabels = SAMPLE_TRANSLATORS;
		console.log(`Sample harness: testing ${translatorLabels.length} translators`);
	}

	const report = await generateBaselineReport(translatorLabels, timeoutMs);
	printSummary(report);
	writeReportToFile(report, outputPath);
}

main().catch(e => {
	console.error('Baseline generation failed:', e);
	process.exit(1);
});
