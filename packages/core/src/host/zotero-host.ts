import type { TranslatorMetadata } from "../types";

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
