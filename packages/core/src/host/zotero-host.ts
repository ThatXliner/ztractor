import type { ExtractMetadataOptions, TranslatorMetadata } from "../types";
import type { TranslatorRegistryEntry } from "../translators-registry";
import { withDocumentLocation } from "../document-location";

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

export interface ZoteroHostPolicyOptions {
	network?: "allow" | "deny";
	signal?: AbortSignal;
	baseUrl?: string;
	timeout?: number;
}

export interface CreateZoteroHostAdaptersOptions extends ZoteroHostPolicyOptions {
	entries: TranslatorRegistryEntry[];
	dependencies: HostDependencies;
}

export class NetworkAccessDenied extends Error {
	constructor(url: string) {
		super(`Network access denied for ${url}`);
		this.name = "NetworkAccessDenied";
	}
}

function getAllResponseHeaders(headers: Headers): string {
	const lines: string[] = [];
	headers.forEach((value, key) => {
		lines.push(`${key}: ${value}`);
	});
	return lines.join("\r\n");
}

function wrapDocument(doc: Document, url: string): Document {
	return withDocumentLocation(doc, url);
}

async function responseToXmlHttp(
	response: Response,
	responseURL: string,
	responseType = "",
	dependencies: HostDependencies,
	wrap: (doc: Document, url: string) => Document,
): Promise<ZoteroXmlHttpResponse> {
	const xmlhttp: ZoteroXmlHttpResponse = {
		status: response.status,
		responseURL,
		responseType,
		getAllResponseHeaders: () => getAllResponseHeaders(response.headers ?? new Headers()),
	};

	if (responseType === "arraybuffer") {
		xmlhttp.response = await response.arrayBuffer();
	} else if (responseType === "blob") {
		xmlhttp.response = await response.blob();
	} else if (responseType === "json") {
		xmlhttp.response = await response.json();
	} else if (responseType === "document" || responseType === "xml") {
		const responseText = await response.text();
		xmlhttp.responseText = responseText;
		const contentType = response.headers?.get("content-type")?.toLowerCase() ?? "";
		const mimeType = responseType === "xml" || contentType.includes("xml")
			? "text/xml"
			: "text/html";
		let document: Document;
		if (mimeType === "text/html" && dependencies.parseHTMLDocument) {
			document = dependencies.parseHTMLDocument(responseText, responseURL) as Document;
		} else if (dependencies.DOMParser) {
			document = new dependencies.DOMParser().parseFromString(responseText, mimeType);
		} else {
			throw new Error("DOMParser unavailable for document response");
		}
		xmlhttp.response = wrap(document, responseURL);
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
	network = "allow",
	signal,
	baseUrl,
	timeout = 10000,
}: CreateZoteroHostAdaptersOptions): ZoteroHostAdapters {
	const entriesById = new Map(entries.map((entry) => [entry.metadata.translatorID, entry]));

	const dom: ZoteroHostDomAdapter = {
		wrapDocument,
	};

	function resolveRequestUrl(url: string, requestBaseUrl = baseUrl): string {
		let resolvedUrl: string;
		try {
			resolvedUrl = requestBaseUrl ? new URL(url, requestBaseUrl).toString() : url;
			const parsedUrl = new URL(resolvedUrl);
			if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
				throw new Error(`Unsupported request URL scheme: ${parsedUrl.protocol}`);
			}
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Unsupported request URL scheme:")) {
				throw error;
			}
			throw new Error(`Invalid request URL: ${url}`);
		}
		return resolvedUrl;
	}

	function requestTimeout(requestOptions: Record<string, unknown>): number {
		const policyTimeout = typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0
			? timeout
			: 10000;
		const optionTimeout = typeof requestOptions.timeout === "number"
			&& Number.isFinite(requestOptions.timeout)
			&& requestOptions.timeout > 0
			? requestOptions.timeout
			: policyTimeout;
		return Math.min(policyTimeout, optionTimeout);
	}

	function combineSignals(
		requestOptions: Record<string, unknown>,
	): { signal: AbortSignal; dispose: () => void } {
		const controller = new AbortController();
		const requestSignal = requestOptions.signal as AbortSignal | undefined;
		const listeners: Array<{ source: AbortSignal; listener: () => void }> = [];
		const timeoutMs = requestTimeout(requestOptions);
		const timeoutId = setTimeout(() => {
			const error = new Error(`HTTP request timed out after ${timeoutMs}ms`);
			error.name = "TimeoutError";
			controller.abort(error);
		}, timeoutMs);
		const abortFrom = (source: AbortSignal) => {
			controller.abort(source.reason);
		};
		const sources = [signal, requestSignal].filter(
			(source): source is AbortSignal => Boolean(source),
		);
		for (const source of sources) {
			if (source.aborted) {
				abortFrom(source);
				break;
			}
			const listener = () => abortFrom(source);
			source.addEventListener("abort", listener, { once: true });
			listeners.push({ source, listener });
		}
		return {
			signal: controller.signal,
			dispose: () => {
				clearTimeout(timeoutId);
				for (const { source, listener } of listeners) {
					source.removeEventListener("abort", listener);
				}
			},
		};
	}

	const http: ZoteroHostHttpAdapter = {
		async request(method, url, options = {}) {
			const requestOptions = options ?? {};
			const resolvedUrl = resolveRequestUrl(url);
			if (network === "deny") {
				throw new NetworkAccessDenied(resolvedUrl);
			}
			const combined = combineSignals(requestOptions);
			try {
				const response = await fetch(resolvedUrl, {
					method,
					headers: requestOptions.headers as HeadersInit | undefined,
					body: requestOptions.body as BodyInit | null | undefined,
					signal: combined.signal,
				});
				const responseURL = response.url || resolvedUrl;
				const xmlhttp = await responseToXmlHttp(
					response,
					responseURL,
					String(requestOptions.responseType ?? ""),
					dependencies,
					dom.wrapDocument,
				);
				if (isInvalidStatus(xmlhttp.status, requestOptions.successCodes)) {
					const error = new Error(`HTTP request to ${resolvedUrl} rejected with status ${xmlhttp.status}`);
					(error as any).status = xmlhttp.status;
					(error as any).responseText = xmlhttp.responseText;
					throw error;
				}
				return xmlhttp;
			} finally {
				combined.dispose();
			}
		},

		async processDocuments(urls, processor, options = {}) {
			const urlList = typeof urls === "string" ? [urls] : urls;
			const results: unknown[] = [];
			for (const url of urlList) {
				const response = await http.request("GET", url, {
					...(options ?? {}),
					responseType: "text",
				});
				const html = response.responseText ?? String(response.response ?? "");
				const doc = dependencies.parseHTMLDocument
					? dependencies.parseHTMLDocument(html, response.responseURL)
					: new dependencies.DOMParser().parseFromString(html, "text/html");
				results.push(await processor(wrapDocument(doc, response.responseURL), response.responseURL));
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
