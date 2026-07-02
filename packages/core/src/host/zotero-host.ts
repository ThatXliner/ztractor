import type { ExtractMetadataOptions, TranslatorMetadata } from "../types";
import type { TranslatorRegistryEntry } from "../translators-registry";

export interface ZoteroXmlHttpResponse {
	status: number;
	responseURL: string;
	responseText?: string;
	response?: unknown;
	responseType?: string;
	getAllResponseHeaders?: () => string;
}

export interface ZoteroHostHttpAdapter {
	request(
		method: string,
		url: string,
		options?: Record<string, unknown>,
	): Promise<ZoteroXmlHttpResponse>;
	processDocuments(
		urls: string | string[],
		processor: (doc: Document, url: string) => unknown | Promise<unknown>,
		options?: Record<string, unknown>,
	): Promise<unknown[]>;
}

export interface ZoteroHostDomAdapter {
	wrapDocument(doc: Document, url: string): Document;
}

export interface ZoteroHostRegistryAdapter {
	getTranslatorCode(translatorID: string): Promise<string>;
	getAllTranslatorMetadata(since?: number): Promise<TranslatorMetadata[]>;
}

export interface ZoteroHostAdapters {
	http: ZoteroHostHttpAdapter;
	dom: ZoteroHostDomAdapter;
	registry: ZoteroHostRegistryAdapter;
	debug?: (message: string, level?: number) => void;
}

type HostDependencies = NonNullable<ExtractMetadataOptions["dependencies"]>;

export interface CreateZoteroHostAdaptersOptions {
	entries: TranslatorRegistryEntry[];
	dependencies: HostDependencies;
}

function getAllResponseHeaders(headers: Headers): string {
	const lines: string[] = [];
	headers.forEach((value, key) => {
		lines.push(`${key}: ${value}`);
	});
	return lines.join("\r\n");
}

function createLocationLike(url: string) {
	const parsedUrl = new URL(url);
	return {
		href: url,
		protocol: parsedUrl.protocol,
		host: parsedUrl.host,
		hostname: parsedUrl.hostname,
		port: parsedUrl.port,
		pathname: parsedUrl.pathname,
		search: parsedUrl.search,
		hash: parsedUrl.hash,
		origin: parsedUrl.origin,
		toString: () => url,
	};
}

function canProxyOverride(doc: Document, prop: "URL" | "documentURI" | "location"): boolean {
	const descriptor = Object.getOwnPropertyDescriptor(doc, prop);
	if (!descriptor || descriptor.configurable) return true;
	if ("value" in descriptor) return Boolean(descriptor.writable);
	return descriptor.get !== undefined;
}

function wrapDocument(doc: Document, url: string): Document {
	const location = createLocationLike(url);
	try {
		Object.defineProperty(doc, "URL", { value: url, configurable: true });
	} catch (_e) {}
	try {
		Object.defineProperty(doc, "documentURI", { value: url, configurable: true });
	} catch (_e) {}
	try {
		Object.defineProperty(doc, "location", { value: location, configurable: true });
		return doc;
	} catch (_e) {
		const canOverrideURL = canProxyOverride(doc, "URL");
		const canOverrideDocumentURI = canProxyOverride(doc, "documentURI");
		const canOverrideLocation = canProxyOverride(doc, "location");
		return new Proxy(doc, {
			get(target, prop, receiver) {
				if (prop === "URL" && canOverrideURL) return url;
				if (prop === "documentURI" && canOverrideDocumentURI) return url;
				if (prop === "location" && canOverrideLocation) return location;
				const value = Reflect.get(target, prop, receiver);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	}
}

async function responseToXmlHttp(
	response: Response,
	responseType = "",
): Promise<ZoteroXmlHttpResponse> {
	const xmlhttp: ZoteroXmlHttpResponse = {
		status: response.status,
		responseURL: response.url,
		responseType,
		getAllResponseHeaders: () => getAllResponseHeaders(response.headers),
	};

	if (responseType === "arraybuffer") {
		xmlhttp.response = await response.arrayBuffer();
	} else if (responseType === "blob") {
		xmlhttp.response = await response.blob();
	} else if (responseType === "json") {
		xmlhttp.response = await response.json();
	} else {
		xmlhttp.responseText = await response.text();
		xmlhttp.response = xmlhttp.responseText;
	}

	return xmlhttp;
}

function isInvalidStatus(status: number, successCodes: unknown): boolean {
	if (successCodes === false) return false;
	if (Array.isArray(successCodes)) return !successCodes.includes(status);
	return status < 200 || status >= 300;
}

export function createZoteroHostAdapters({
	entries,
	dependencies,
}: CreateZoteroHostAdaptersOptions): ZoteroHostAdapters {
	const entriesById = new Map(entries.map((entry) => [entry.metadata.translatorID, entry]));

	const dom: ZoteroHostDomAdapter = {
		wrapDocument,
	};

	const http: ZoteroHostHttpAdapter = {
		async request(method, url, options = {}) {
			const response = await fetch(url, {
				method,
				headers: options.headers as HeadersInit | undefined,
				body: options.body as BodyInit | null | undefined,
				signal: typeof options.timeout === "number"
					? AbortSignal.timeout(options.timeout)
					: undefined,
			});
			const xmlhttp = await responseToXmlHttp(response, String(options.responseType ?? ""));
			if (isInvalidStatus(xmlhttp.status, options.successCodes)) {
				const error = new Error(`HTTP request to ${url} rejected with status ${xmlhttp.status}`);
				(error as any).status = xmlhttp.status;
				(error as any).responseText = xmlhttp.responseText;
				throw error;
			}
			return xmlhttp;
		},

		async processDocuments(urls, processor, options = {}) {
			const urlList = typeof urls === "string" ? [urls] : urls;
			const results: unknown[] = [];
			for (const url of urlList) {
				const response = await fetch(url, {
					headers: options.headers as HeadersInit | undefined,
				});
				const html = await response.text();
				const doc = dependencies.parseHTMLDocument
					? dependencies.parseHTMLDocument(html, url)
					: new dependencies.DOMParser().parseFromString(html, "text/html");
				results.push(await processor(wrapDocument(doc, url), url));
			}
			return results;
		},
	};

	const registry: ZoteroHostRegistryAdapter = {
		async getTranslatorCode(translatorID) {
			const entry = entriesById.get(translatorID);
			if (!entry) throw new Error(`Translator ${translatorID} is not in the bundled registry`);
			return `${JSON.stringify(entry.metadata, null, "\t")}\n${entry.code}`;
		},
		async getAllTranslatorMetadata() {
			return entries.map((entry) => entry.metadata as TranslatorMetadata);
		},
	};

	return { http, dom, registry };
}
