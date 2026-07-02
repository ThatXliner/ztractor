import type { ExtractMetadataOptions, ItemType, ZoteroItem } from "./types";
import type { TranslatorRegistryEntry } from "./translators-registry";
import { createZoteroHostAdapters } from "./host/zotero-host";
import { installZoteroHost, Zotero } from "./generated/zotero-runtime/index.js";

type ExecutorDependencies = NonNullable<ExtractMetadataOptions["dependencies"]>;

interface RuntimeTranslatorProvider {
	get(id: string): Promise<any> | any;
	getAllForType(type: string): Promise<any[]>;
	getCodeForTranslator(translator: any): Promise<string>;
	getWebTranslatorsForLocation(uri: string, rootUri: string): Promise<[any[], unknown[]]>;
}

function translatorTypeForName(type: string): number {
	return (Zotero.Translator.TRANSLATOR_TYPES as Record<string, number>)[type] ?? 0;
}

function matchesTarget(url: string, target: string): boolean {
	if (!target) return true;
	try {
		return new RegExp(target, "i").test(url);
	} catch (_e) {
		return false;
	}
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

function ensureDocumentLocation(doc: Document, url: string): Document {
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

function cloneItem(item: ZoteroItem): ZoteroItem {
	return JSON.parse(JSON.stringify(item)) as ZoteroItem;
}

class RegistryTranslatorProvider implements RuntimeTranslatorProvider {
	private readonly entriesById = new Map<string, TranslatorRegistryEntry>();
	private readonly translatorsById = new Map<string, any>();

	constructor(private readonly entries: TranslatorRegistryEntry[]) {
		for (const entry of entries) {
			this.entriesById.set(entry.metadata.translatorID, entry);
		}
	}

	get(id: string): any | null {
		const entry = this.entriesById.get(id);
		return entry ? this.toRuntimeTranslator(entry) : null;
	}

	async getAllForType(type: string): Promise<any[]> {
		const typeBit = translatorTypeForName(type);
		return this.entries
			.filter((entry) => (entry.metadata.translatorType & typeBit) !== 0)
			.map((entry) => this.toRuntimeTranslator(entry))
			.sort((a, b) => a.priority - b.priority);
	}

	async getCodeForTranslator(translator: any): Promise<string> {
		const id = translator.translatorID;
		const entry = this.entriesById.get(id);
		if (!entry) {
			throw new Error(`Translator ${id} is not in the bundled registry`);
		}
		return this.getFullTranslatorCode(entry);
	}

	async getWebTranslatorsForLocation(uri: string, rootUri: string): Promise<[any[], unknown[]]> {
		const urls = uri === rootUri ? [uri] : [uri, rootUri];
		const translators = this.entries
			.filter((entry) => (entry.metadata.translatorType & 4) !== 0)
			.filter((entry) => urls.some((url) => matchesTarget(url, entry.metadata.target)))
			.map((entry) => this.toRuntimeTranslator(entry))
			.sort((a, b) => a.priority - b.priority);

		return [translators, translators.map(() => null)];
	}

	toRuntimeTranslator(entry: TranslatorRegistryEntry): any {
		const id = entry.metadata.translatorID;
		const cached = this.translatorsById.get(id);
		if (cached) return cached;

		const translator = new Zotero.Translator({
			...entry.metadata,
			code: this.getFullTranslatorCode(entry),
		});
		translator.code = this.getFullTranslatorCode(entry);
		this.translatorsById.set(id, translator);
		return translator;
	}

	private getFullTranslatorCode(entry: TranslatorRegistryEntry): string {
		return `${JSON.stringify(entry.metadata, null, "\t")}\n${entry.code}`;
	}
}

export class ZoteroRuntimeExecutor {
	private readonly provider: RegistryTranslatorProvider;

	constructor(
		entries: TranslatorRegistryEntry[],
		private readonly dependencies: ExecutorDependencies,
	) {
		this.provider = new RegistryTranslatorProvider(entries);
		if (!(globalThis as any).DOMParser && dependencies.DOMParser) {
			(globalThis as any).DOMParser = dependencies.DOMParser;
		}
		installZoteroHost(createZoteroHostAdapters({ entries, dependencies }));
	}

	async detectWeb(
		entry: TranslatorRegistryEntry,
		doc: Document,
		url: string,
	): Promise<ItemType | false | null> {
		const translate = this.createWebTranslate(doc, url);
		translate.setTranslator(this.provider.toRuntimeTranslator(entry));
		const translators = await translate.getTranslators(false, true);
		return translators?.[0]?.itemType ?? false;
	}

	async doWeb(
		entry: TranslatorRegistryEntry,
		doc: Document,
		url: string,
	): Promise<ZoteroItem[]> {
		const translate = this.createWebTranslate(doc, url);
		const items: ZoteroItem[] = [];
		let translateError: unknown;

		translate.setTranslator(this.provider.toRuntimeTranslator(entry));
		translate.setHandler("select", (_translate: unknown, itemList: Record<string, string>, callback: Function) => {
			callback(itemList);
		});
		translate.setHandler("itemDone", (_translate: unknown, _newItem: unknown, item: ZoteroItem) => {
			items.push(cloneItem(item));
		});
		translate.setHandler("error", (_translate: unknown, error: unknown) => {
			translateError = error;
		});

		await translate.translate({
			libraryID: false,
			saveAttachments: false,
		});

		if (translateError) {
			throw translateError;
		}

		return items;
	}

	private createWebTranslate(doc: Document, url: string): any {
		const locatedDoc = ensureDocumentLocation(doc, url);
		const translate = new Zotero.Translate.Web();
		translate.setTranslatorProvider(this.provider);
		translate.setDocument(locatedDoc);
		return translate;
	}
}
