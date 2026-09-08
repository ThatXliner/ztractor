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

	test("creates isolated upstream runtimes without publishing globals", async () => {
		const runtime = await import("../../src/generated/zotero-runtime/index.js");
		const globalNames = ["Zotero", "ZOTERO_CONFIG", "$rdf", "TLDS", "XRegExp"] as const;
		const before = new Map(globalNames.map((name) => [name, (globalThis as any)[name]]));
		const firstHost = { name: "first" };
		const secondHost = { name: "second" };

		const first = runtime.createZoteroRuntime(firstHost);
		const second = runtime.createZoteroRuntime(secondHost);

		expect(first).not.toBe(second);
		expect(first.__ztractorHost).toBe(firstHost);
		expect(second.__ztractorHost).toBe(secondHost);
		expect(first.RDF?.AJAW).toBeDefined();
		for (const name of globalNames) {
			expect((globalThis as any)[name]).toBe(before.get(name));
		}
	});
});
