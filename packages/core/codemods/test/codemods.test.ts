import { describe, expect, test } from "bun:test";
import { applyHttpHostAdapter } from "../mods/adapt-http-host";
import { applyRepoRegistryAdapter } from "../mods/adapt-repo-registry";

describe("Zotero upstream codemods", () => {
	test("HTTP mod routes upstream host hooks through Ztractor host adapters", () => {
		const source = [
			"\t\tthrow new Error(`Zotero.HTTP.request(): not implemented`);",
			"\t\tthrow new Error('Zotero.HTTP.wrapDocument(): not implemented');",
			"\t\tthrow new Error(`Zotero.HTTP.processDocuments(): not implemented`);",
		].join("\n");

		const output = applyHttpHostAdapter(source);

		expect(output).toContain("Zotero.__ztractorHost.http.request(method, url, options)");
		expect(output).toContain("Zotero.__ztractorHost.dom.wrapDocument(doc, docURL)");
		expect(output).toContain("Zotero.__ztractorHost.http.processDocuments(urls, processor, options)");
		expect(output).not.toContain("not implemented`");
	});

	test("HTTP mod fails when an upstream anchor disappears", () => {
		expect(() => applyHttpHostAdapter("")).toThrow("adapt-http-host");
	});

	test("repository mod prefers the host registry and keeps Zotero's HTTP fallback", () => {
		const source = [
			"\tthis.getTranslatorCode = async function (translatorID) {",
			"\t\tlet code;",
			"\t\ttry {",
			"\t\t\tlet url = `${ZOTERO_CONFIG.REPOSITORY_URL}code/${translatorID}?version=${Zotero.version}`;",
			"\t\t\tlet xmlhttp = await Zotero.HTTP.request(\"GET\", url);",
			"\t\t\tcode = xmlhttp.responseText;",
			"\t\t}",
			"\t\tcatch (e) {",
			"\t\t\tthrow new Error(\"Repo: Code could not be retrieved for \" + translatorID + \"\\n\" + e.message);",
			"\t\t}",
			"",
			"\tthis.getAllTranslatorMetadata = async (since=0) => {",
			"\t\tvar url = ZOTERO_CONFIG.REPOSITORY_URL + \"metadata?version=\" + Zotero.version + \"&last=\"+ since;",
			"",
			"\t\ttry {",
			"\t\t\tlet xmlhttp = await Zotero.HTTP.request('GET', url);",
			"\t\t\treturn JSON.parse(xmlhttp.responseText);",
			"\t\t}",
			"\t\tcatch (e) {",
			"\t\t\tthrow new Error(\"Repo: Failed to retrieve all translator metadata\\n\" + e.message);",
			"\t\t}",
			"\t};",
		].join("\n");

		const output = applyRepoRegistryAdapter(source);

		expect(output).toContain("Zotero.__ztractorHost.registry.getTranslatorCode(translatorID)");
		expect(output).toContain("Zotero.__ztractorHost.registry.getAllTranslatorMetadata(since)");
		expect(output).toContain("Zotero.HTTP.request(\"GET\", url)");
	});

	test("repository mod fails when an upstream anchor disappears", () => {
		expect(() => applyRepoRegistryAdapter("")).toThrow("adapt-repo-registry");
	});
});
