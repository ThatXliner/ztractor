import { describe, expect, test } from "bun:test";

describe("generated Zotero runtime ESM", () => {
	test("imports and exposes host installation", async () => {
		const runtime = await import("../../src/generated/zotero-runtime/index.js");

		expect(typeof runtime.Zotero).toBe("object");
		expect(typeof runtime.ZOTERO_CONFIG.REPOSITORY_URL).toBe("string");
		expect(typeof runtime.installZoteroHost).toBe("function");

		const host = {
			http: {
				request: async () => ({ status: 200, responseURL: "", responseText: "" }),
				processDocuments: async () => [],
			},
			dom: {
				wrapDocument: (doc: Document) => doc,
			},
			registry: {
				getTranslatorCode: async () => "",
				getAllTranslatorMetadata: async () => [],
			},
		};

		expect(runtime.installZoteroHost(host)).toBe(runtime.Zotero);
		expect(runtime.Zotero.__ztractorHost).toBe(host);
	});
});
