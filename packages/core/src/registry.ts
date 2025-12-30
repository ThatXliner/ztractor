/// May separate into a separate package but that's not necessary yet.

import type { TranslatorRegistryEntry } from "./translators-registry";
import { ZOTERO_CONFIG } from "./utilities-translate-bundle";
/**
 * Translator metadata, would remove in favor of Zotero schema if possible
 */
export interface TranslatorMetadata {
	translatorID: string;
	label: string;
	creator: string;
	target: string;
	minVersion: string;
	maxVersion: string;
	priority: number;
	inRepository: boolean;
	translatorType: number;
	browserSupport: string;
	lastUpdated: string;
}

export abstract class TranslatorRegistry {
	abstract getTranslatorCode(id: string): Promise<string | undefined>;
	abstract getAllTranslatorMetadata(
		since?: number,
	): Promise<TranslatorMetadata[]>;
}
// TODO: tree-shakable
export class BundledRegistry extends TranslatorRegistry {
	private _TRANSLATORS_REGISTRY: TranslatorRegistryEntry[] | null = null;

	async getRegistry() {
		if (this._TRANSLATORS_REGISTRY != null) return this._TRANSLATORS_REGISTRY;
		const module = await import("./translators-registry");
		return (this._TRANSLATORS_REGISTRY = module.TRANSLATORS_REGISTRY);
	}
	async getTranslatorCode(id: string): Promise<string | undefined> {
		const registry = await this.getRegistry();
		const entry =
			registry.find((entry) => entry.metadata.translatorID === id) || null;
		return entry?.code;
	}

	async getAllTranslatorMetadata(
		since?: number,
	): Promise<TranslatorMetadata[]> {
		const registry = await this.getRegistry();
		return Promise.resolve(registry.map((entry) => entry.metadata));
	}
}

export class HTTPRegistry implements TranslatorRegistry {
	fetchFunction: (url: string) => Promise<Response>;
	infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
	constructor(fetchFunction: (url: string) => Promise<Response>) {
		this.fetchFunction = fetchFunction;
	}
	// TODO: cache
	async getTranslatorCode(id: string): Promise<string | undefined> {
		let code;
		let url = `${ZOTERO_CONFIG.REPOSITORY_URL}code/${id}`;
		let xmlhttp = await this.fetchFunction(url);
		code = await xmlhttp.text();

		// validation
		var m = this.infoRe.exec(code);
		if (!m) {
			throw new Error(
				"Repo: Invalid or missing translator metadata JSON object for " + id,
			);
		}
		try {
			JSON.parse(m[0]);
		} catch (e) {
			throw new Error(
				"Repo: Invalid or missing translator metadata JSON object for " + id,
			);
		}
		return code;
	}
	/**
	 * Retrieves all translator metadata. The parameter is a timestamp since the
	 * last retrieval, in which case only metadata for changed translators is
	 * returned.
	 *
	 * @param since {Number} timestamp in seconds
	 * @returns {Promise<TranslatorMetadata[]>}
	 */
	async getAllTranslatorMetadata(
		since: number = 0,
	): Promise<TranslatorMetadata[]> {
		const url = ZOTERO_CONFIG.REPOSITORY_URL + "metadata?last=" + since;
		// const url = ZOTERO_CONFIG.REPOSITORY_URL + "metadata?version=" + Zotero.version + "&last="+ since;
		// XXX: use Zod to verify?
		return (await this.fetchFunction(url)).json();
	}
}
