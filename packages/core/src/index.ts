/**
 * Ztractor - Extract structured metadata from websites using Zotero's translators
 */

import { TranslatorExecutor } from "./translator-system-modern";
import { BundledRegistry } from "./registry";
import { matchesTarget } from "./translator-loader";
import type {
	ExtractMetadataOptions,
	ExtractMetadataResult,
	ZoteroItem,
	ItemType,
	Creator,
	Tag,
	Note,
	Attachment,
	Translator,
} from "./types";

export type {
	ExtractMetadataOptions,
	ExtractMetadataResult,
	ZoteroItem,
	ItemType,
	Creator,
	Tag,
	Note,
	Attachment,
	Translator,
};

export { BundledRegistry, HTTPRegistry } from "./registry";
export type { TranslatorRegistry, TranslatorMetadata } from "./registry";
export { ZoteroUtilities as ZU } from "./translator-system-modern";
export { Item } from "./item";
export { parseTranslatorMetadata } from "./translator-loader";

export async function executeDetectWeb(
	translator: Translator,
	doc: Document,
	url: string,
): Promise<string | false | null> {
	const executor = new TranslatorExecutor({});
	return executor.detectWeb(translator, doc, url);
}

export async function executeDoWeb(
	translator: Translator,
	doc: Document,
	url: string,
): Promise<ZoteroItem[]> {
	const executor = new TranslatorExecutor({});
	return executor.doWeb(translator, doc, url) as Promise<ZoteroItem[]>;
}

const defaultRegistry = new BundledRegistry();

/**
 * Parse an HTML string into a Document.
 * Uses injected `dependencies.parseHTMLDocument` (Node.js) or native DOMParser (browser).
 */
function parseHTMLDocument(
	html: string,
	url: string,
	dependencies?: ExtractMetadataOptions["dependencies"],
): Document {
	if (dependencies?.parseHTMLDocument) {
		return dependencies.parseHTMLDocument(html, url);
	}
	const Parser: typeof DOMParser =
		dependencies?.DOMParser ?? (globalThis as any).DOMParser;
	const doc = new Parser().parseFromString(html, "text/html");
	// Attach URL metadata for translators that read document.URL / location.href / location.search
	let needsLocationProxy = false;
	try {
		const parsedURL = new URL(url);
		const locationLike = {
			href: url,
			protocol: parsedURL.protocol,
			host: parsedURL.host,
			hostname: parsedURL.hostname,
			port: parsedURL.port,
			pathname: parsedURL.pathname,
			search: parsedURL.search,
			hash: parsedURL.hash,
			origin: parsedURL.origin,
			toString: () => url,
		};
		try {
			Object.defineProperty(doc, "URL", { value: url, configurable: true });
		} catch (_e) {}
		try {
			Object.defineProperty(doc, "documentURI", {
				value: url,
				configurable: true,
			});
		} catch (_e) {}
		try {
			Object.defineProperty(doc, "location", {
				value: locationLike,
				configurable: true,
			});
		} catch (_e) {
			needsLocationProxy = true;
		}
		if (needsLocationProxy) {
			let proxy: Document;
			proxy = new Proxy(doc, {
				get(target, prop) {
					if (prop === "URL" || prop === "documentURI") return url;
					if (prop === "location") return locationLike;
					if (prop === "evaluate") {
						return (
							expression: string,
							contextNode: Node,
							resolver?: XPathNSResolver | null,
							type?: number,
							result?: XPathResult | null,
						) =>
							target.evaluate(
								expression,
								contextNode === proxy ? target : contextNode,
								resolver ?? null,
								type ?? 0,
								result ?? null,
							);
					}
					const value = Reflect.get(target, prop, target);
					return typeof value === "function" ? value.bind(target) : value;
				},
			});
			return proxy;
		}
	} catch (_e) {
		// read-only in some environments — ignore
	}
	return doc;
}

/**
 * Extract structured metadata from a URL using Zotero's web translators.
 *
 * @example
 * ```ts
 * const result = await extractMetadata('https://doi.org/10.1126/science.169.3946.635');
 * if (result.success) console.log(result.items[0].title);
 * ```
 */
export async function extractMetadata(
	options: string | ExtractMetadataOptions,
): Promise<ExtractMetadataResult> {
	const opts: ExtractMetadataOptions =
		typeof options === "string" ? { url: options } : options;

	const {
		url,
		html,
		headers,
		timeout = 30000,
		dependencies,
		registry = defaultRegistry,
	} = opts;

	try {
		// Fetch HTML if not provided
		let htmlContent = html;
		if (!htmlContent) {
			const response = await fetch(url, {
				headers: headers ?? {
					"User-Agent":
						"Mozilla/5.0 (compatible; Ztractor/1.0; +https://github.com/ThatXliner/ztractor)",
				},
				signal: AbortSignal.timeout(timeout),
			});

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			htmlContent = await response.text();
		}

		// Parse HTML into a Document
		const doc = parseHTMLDocument(htmlContent, url, dependencies);

		// Find matching translators from the registry
		const allMetadata = await registry.getAllTranslatorMetadata();
		const matchingMetadata = allMetadata
			.filter((t) => (t.translatorType & 4) !== 0 && matchesTarget(url, t.target))
			.sort((a, b) => a.priority - b.priority); // lower number = higher priority

		if (matchingMetadata.length === 0) {
			return {
				success: false,
				error: "No matching translator found for this URL",
			};
		}

		const executor = new TranslatorExecutor({
			dependencies,
			getTranslatorById: async (id) => {
				const code = await registry.getTranslatorCode(id);
				if (!code) return null;
				// The code from BundledRegistry already has metadata stripped,
				// so build a minimal translator object
				const meta = allMetadata.find((m) => m.translatorID === id);
				if (!meta) return null;
				return { metadata: meta as any, code };
			},
		});

		// Try translators in priority order
		for (const meta of matchingMetadata) {
			const code = await registry.getTranslatorCode(meta.translatorID);
			if (!code) continue;

			const translator = { metadata: meta as any, code };

			try {
				const itemType = await executor.detectWeb(translator, doc, url);
				if (!itemType) continue;

				const items = await executor.doWeb(translator, doc, url);
				if (items.length > 0) {
					return {
						success: true,
						items: items as ZoteroItem[],
						translator: meta.label,
					};
				}
			} catch (e) {
				// Try next translator
				continue;
			}
		}

		return {
			success: false,
			error: "No translator could extract metadata from this page",
		};
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}

/**
 * List all available translators.
 */
export async function getAvailableTranslators(
	registry: InstanceType<typeof BundledRegistry> = defaultRegistry,
): Promise<{ id: string; label: string; target: string; priority: number }[]> {
	const all = await registry.getAllTranslatorMetadata();
	return all.map((t) => ({
		id: t.translatorID,
		label: t.label,
		target: t.target,
		priority: t.priority,
	}));
}

/**
 * Find translators that match a given URL.
 */
export async function findTranslators(
	url: string,
	registry: InstanceType<typeof BundledRegistry> = defaultRegistry,
): Promise<{ id: string; label: string; target: string; priority: number }[]> {
	const all = await registry.getAllTranslatorMetadata();
	return all
		.filter((t) => (t.translatorType & 4) !== 0 && matchesTarget(url, t.target))
		.sort((a, b) => a.priority - b.priority)
		.map((t) => ({
			id: t.translatorID,
			label: t.label,
			target: t.target,
			priority: t.priority,
		}));
}
