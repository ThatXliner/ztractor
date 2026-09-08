import type { ExtractMetadataOptions, ItemType, ZoteroItem } from "./types";
import type { TranslatorRegistryEntry } from "./translators-registry";
import {
	createZoteroHostAdapters,
	type ZoteroHostPolicyOptions,
} from "./host/zotero-host";
import { withDocumentLocation } from "./document-location";
import { createZoteroRuntime } from "./generated/zotero-runtime/index.js";

type ExecutorDependencies = NonNullable<ExtractMetadataOptions["dependencies"]>;

interface RuntimeTranslatorProvider {
	get(id: string): Promise<any> | any;
	getAllForType(type: string): Promise<any[]>;
	getCodeForTranslator(translator: any): Promise<string>;
	getWebTranslatorsForLocation(uri: string, rootUri: string): Promise<[any[], unknown[]]>;
}

function translatorTypeForName(runtime: any, type: string): number {
	return (runtime.Translator.TRANSLATOR_TYPES as Record<string, number>)[type] ?? 0;
}

function matchesTarget(url: string, target: string): boolean {
	if (!target) return true;
	try {
		return new RegExp(target, "i").test(url);
	} catch (_e) {
		return false;
	}
}

function cloneItem(item: ZoteroItem): ZoteroItem {
	return JSON.parse(JSON.stringify(item)) as ZoteroItem;
}

class RegistryTranslatorProvider implements RuntimeTranslatorProvider {
	private readonly entriesById = new Map<string, TranslatorRegistryEntry>();
	private readonly translatorsById = new Map<string, any>();

	constructor(
		private readonly entries: TranslatorRegistryEntry[],
		private readonly runtime: any,
	) {
		for (const entry of entries) {
			this.entriesById.set(entry.metadata.translatorID, entry);
		}
	}

	get(id: string): any | null {
		const entry = this.entriesById.get(id);
		return entry ? this.toRuntimeTranslator(entry) : null;
	}

	async getAllForType(type: string): Promise<any[]> {
		const typeBit = translatorTypeForName(this.runtime, type);
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

		const translator = new this.runtime.Translator({
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
	private readonly runtime: any;

	constructor(
		entries: TranslatorRegistryEntry[],
		private readonly dependencies: ExecutorDependencies,
		policy: ZoteroHostPolicyOptions = {},
	) {
		const host = createZoteroHostAdapters({ entries, dependencies, ...policy });
		this.runtime = createZoteroRuntime(host, dependencies.DOMParser);
		this.provider = new RegistryTranslatorProvider(entries, this.runtime);
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
			callback(Object.keys(itemList).length === 1 ? itemList : null);
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
		const locatedDoc = withDocumentLocation(doc, url);
		const translate = new this.runtime.Translate.Web();
		translate.setTranslatorProvider(this.provider);
		translate.setDocument(locatedDoc);
		return translate;
	}
}
