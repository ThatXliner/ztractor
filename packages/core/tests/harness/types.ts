export interface ZoteroTestCase {
	type: 'web' | 'import' | 'export' | 'search';
	url?: string;
	input?: string;
	defer?: boolean | number;
	detectedItemType?: string | boolean;
	items: Record<string, unknown>[] | 'multiple';
}

export interface TestResult {
	status: 'pass' | 'fail' | 'skip' | 'partial';
	reason?: string;
	details?: {
		field: string;
		expected: unknown;
		actual: unknown;
	}[];
}

export interface TranslatorResult {
	id: string;
	label: string;
	testCount: number;
	pass: number;
	fail: number;
	skip: number;
	partial: number;
	failures: Array<{ url: string; reason: string }>;
}

export interface BaselineReport {
	generatedAt: string;
	totalTranslators: number;
	translatorsTested: number;
	totalWebTests: number;
	results: TranslatorResult[];
	summary: {
		pass: number;
		fail: number;
		skip: number;
		partial: number;
	};
}
