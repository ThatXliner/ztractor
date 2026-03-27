import { BundledRegistry } from '../../src/index';
import { parseTestCases } from './parse-test-cases';
import { runTranslatorTests } from './run-test';
import type { BaselineReport } from './types';
import { writeFileSync } from 'node:fs';

/**
 * A curated list of well-known translators to test for the baseline.
 * These represent a cross-section of academic, news, and general sites.
 */
export const SAMPLE_TRANSLATORS = [
	'Wikipedia',
	'DOI',
	'arXiv.org',
	'Google Scholar',
	'PubMed',
	'JSTOR',
	'Semantic Scholar',
	'Library Catalog (PICA)',
	'Wikidata',
	'YouTube',
	'Internet Archive',
	'Hathi Trust',
	'Twitter',
	'The New York Times',
	'BBC',
	'Reuters',
	'GitHub',
	'HighWire 2.0',
	'Embedded Metadata',
	'COinS',
];

/**
 * Generate a baseline report for a list of translators.
 * If translatorLabels is empty/undefined, uses SAMPLE_TRANSLATORS.
 */
export async function generateBaselineReport(
	translatorLabels?: string[],
	timeoutMs: number = 15000,
): Promise<BaselineReport> {
	const registry = new BundledRegistry();
	const allMetadata = await registry.getAllTranslatorMetadata();
	const labels = translatorLabels ?? SAMPLE_TRANSLATORS;

	const report: BaselineReport = {
		generatedAt: new Date().toISOString(),
		totalTranslators: allMetadata.length,
		translatorsTested: 0,
		totalWebTests: 0,
		results: [],
		summary: { pass: 0, fail: 0, skip: 0, partial: 0 },
	};

	for (const label of labels) {
		const meta = allMetadata.find(m => m.label === label);
		if (!meta) {
			console.warn(`Translator "${label}" not found in registry, skipping`);
			continue;
		}

		const code = await registry.getTranslatorCode(meta.translatorID);
		if (!code) {
			console.warn(`No code found for translator "${label}", skipping`);
			continue;
		}

		const webTests = parseTestCases(code).filter(t => t.type === 'web');
		if (webTests.length === 0) continue;

		console.log(`Testing: ${label} (${webTests.length} web test(s))...`);

		const result = await runTranslatorTests(
			meta.translatorID,
			label,
			code,
			timeoutMs,
		);

		report.results.push(result);
		report.translatorsTested++;
		report.totalWebTests += result.testCount;
		report.summary.pass += result.pass;
		report.summary.fail += result.fail;
		report.summary.skip += result.skip;
		report.summary.partial += result.partial;
	}

	return report;
}

/**
 * Print a summary of the baseline report to stdout.
 */
export function printSummary(report: BaselineReport): void {
	console.log('\n=== Baseline Report ===');
	console.log(`Generated: ${report.generatedAt}`);
	console.log(`Translators tested: ${report.translatorsTested} / ${report.totalTranslators}`);
	console.log(`Total web tests: ${report.totalWebTests}`);
	console.log(`  Pass:    ${report.summary.pass}`);
	console.log(`  Fail:    ${report.summary.fail}`);
	console.log(`  Skip:    ${report.summary.skip}`);
	console.log(`  Partial: ${report.summary.partial}`);

	if (report.results.some(r => r.failures.length > 0)) {
		console.log('\n--- Failures ---');
		for (const r of report.results) {
			if (r.failures.length === 0) continue;
			console.log(`\n${r.label} (${r.fail}/${r.testCount} failed):`);
			for (const f of r.failures) {
				console.log(`  - ${f.url}: ${f.reason}`);
			}
		}
	}
	console.log('\n=== End Report ===\n');
}

/**
 * Write the baseline report to a JSON file.
 */
export function writeReportToFile(report: BaselineReport, outputPath: string): void {
	writeFileSync(outputPath, JSON.stringify(report, null, 2));
	console.log(`Baseline report written to: ${outputPath}`);
}
