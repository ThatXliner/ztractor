import type { Translator, TranslatorMetadata } from "./types";

/**
 * Parse translator metadata from the header comment
 */
export function parseTranslatorMetadata(
	code: string,
): TranslatorMetadata | null {
	try {
		// Extract JSON from the first comment block
		// Allow optional newline after the closing brace
		const match = code.match(/^\s*({[\s\S]*?})(?:\s*\n|$)/);
		if (!match) return null;

		const metadata = JSON.parse(match[1]) as TranslatorMetadata;

		// Validate required fields
		if (
			!metadata.translatorID ||
			!metadata.label ||
			!metadata.target ||
			metadata.translatorType === undefined
		) {
			return null;
		}

		return metadata;
	} catch (e) {
		console.error("Error parsing translator metadata:", e);
		return null;
	}
}

/**
 * Load a translator from code
 */
export function loadTranslator(
	code: string,
	filename?: string,
): Translator | null {
	const metadata = parseTranslatorMetadata(code);
	if (!metadata) {
		console.error(`Failed to parse metadata for ${filename || "unknown"}`);
		return null;
	}

	return {
		metadata,
		code,
	};
}

/**
 * Check if a URL matches a translator's target pattern
 */
export function matchesTarget(url: string, targetPattern: string): boolean {
	try {
		// Use a wrapper to prevent SyntaxError from propagating in test environments
		// eslint-disable-next-line no-new
		const regex = Function('return new RegExp(arguments[0])')(targetPattern) as RegExp;
		return regex.test(url);
	} catch (_e) {
		return false;
	}
}

/**
 * Find matching translators for a URL
 */
export function findMatchingTranslators(
	url: string,
	translators: Translator[],
): Translator[] {
	const matches = translators
		.filter((t) => matchesTarget(url, t.metadata.target))
		.sort((a, b) => b.metadata.priority - a.metadata.priority);

	return matches;
}

/**
 * Get translator by ID
 */
export function getTranslatorById(
	translatorID: string,
	translators: Translator[],
): Translator | null {
	return (
		translators.find((t) => t.metadata.translatorID === translatorID) || null
	);
}
