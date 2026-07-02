import { describe, expect, test } from "bun:test";
import { applyDomParserAdapter } from "../mods/adapt-dom-parser";
import { applyHttpHostAdapter } from "../mods/adapt-http-host";
import { applyRepoRegistryAdapter } from "../mods/adapt-repo-registry";
import { applyXRegExpRuntimeAdapter } from "../mods/adapt-xregexp-runtime";

describe("Zotero upstream codemods", () => {
	test("HTTP mod routes upstream host hooks through Ztractor host adapters", () => {
		const source = [
			"\tthis.StatusError.prototype = Object.create(Error.prototype);",
			"\t\tthrow new Error(`Zotero.HTTP.request(): not implemented`);",
			"\t\tthrow new Error('Zotero.HTTP.wrapDocument(): not implemented');",
			"\t\tthrow new Error(`Zotero.HTTP.processDocuments(): not implemented`);",
		].join("\n");

		const output = applyHttpHostAdapter(source);

		expect(output).toContain("Zotero.__ztractorHost.http.request(method, url, options)");
		expect(output).toContain("this.UnexpectedStatusException = this.StatusError");
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

	test("DOM parser mod removes jsdom parsing branches", () => {
		const source = [
			"\t\t\t} else if(Zotero.isNode) {",
			"\t\t\t\tlet {JSDOM} = require('jsdom');",
			"\t\t\t\tlet document = (new JSDOM(str)).window.document;",
			"\t\t\t\treturn document.documentElement.textContent.replace(/ {2,}/g, \" \");",
			"\t\t\t} else {",
			"",
			"\t\tif (Zotero.isNode) {",
			"\t\t\tlet { JSDOM } = require('jsdom');",
			"\t\t\tdoc = new JSDOM(wrappedNote).window.document;",
			"\t\t}",
			"\t\telse {",
		].join("\n");

		const output = applyDomParserAdapter(source);

		expect(output).not.toContain("require('jsdom')");
		expect(output).toContain("new DOMParser().parseFromString(str, \"text/html\")");
		expect(output).toContain("new DOMParser().parseFromString(wrappedNote, 'text/html')");
	});

	test("DOM parser mod fails when an upstream anchor disappears", () => {
		expect(() => applyDomParserAdapter("")).toThrow("adapt-dom-parser");
	});

	test("XRegExp mod hides Browserify require calls from downstream bundlers", () => {
		const source = [
			"var XRegExp = require('./xregexp');",
			"require('./addons/build')(XRegExp);",
			"module.exports = XRegExp;",
		].join("\n");

		const output = applyXRegExpRuntimeAdapter("modules/utilities/xregexp-all.js", source);

		expect(output.code).not.toContain("require(");
		expect(output.code).toContain("__xregexpRequire('./xregexp')");
		expect(output.code).toContain("var XRegExp = globalThis.XRegExp");
	});

	test("XRegExp mod removes utilities CommonJS fallback", () => {
		const source = [
			"if (!Utilities.XRegExp) {",
			"\tif (typeof module != 'undefined') {",
			"\t\tUtilities.XRegExp = require('./xregexp-all');",
			"\t}",
			"}",
		].join("\n");

		const output = applyXRegExpRuntimeAdapter("modules/utilities/utilities.js", source);

		expect(output.code).not.toContain("require('./xregexp-all')");
		expect(output.code).toContain("Utilities.XRegExp = globalThis.XRegExp || null");
	});

	test("XRegExp mod fails when an upstream anchor disappears", () => {
		expect(() => applyXRegExpRuntimeAdapter("modules/utilities/xregexp-all.js", "")).toThrow("adapt-xregexp-runtime");
		expect(() => applyXRegExpRuntimeAdapter("modules/utilities/utilities.js", "")).toThrow("adapt-xregexp-runtime");
	});
});
