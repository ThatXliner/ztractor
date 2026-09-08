import type { ZoteroCodemod } from "../types";
import { normalizeIndent, replaceOnce } from "./_utils";

const id = "adapt-dom-parser";

const unescapeHtmlAnchor = [
	"\t\t\t} else if(Zotero.isNode) {",
	"\t\t\t\tlet {JSDOM} = require('jsdom');",
	"\t\t\t\tlet document = (new JSDOM(str)).window.document;",
	"\t\t\t\treturn document.documentElement.textContent.replace(/ {2,}/g, \" \");",
	"\t\t\t} else {",
].join("\n");

const unescapeHtmlReplacement = normalizeIndent(`
			} else if(Zotero.isNode) {
				if (typeof DOMParser === 'undefined') {
					throw new Error("Utilities.unescapeHTML(): DOMParser unavailable");
				}
				let document = new DOMParser().parseFromString(str, "text/html");
				return document.documentElement.textContent.replace(/ {2,}/g, " ");
			} else {
`);

const walkNoteDomAnchor = [
	"\t\tif (Zotero.isNode) {",
	"\t\t\tlet { JSDOM } = require('jsdom');",
	"\t\t\tdoc = new JSDOM(wrappedNote).window.document;",
	"\t\t}",
	"\t\telse {",
].join("\n");

const walkNoteDomReplacement = normalizeIndent(`
		if (Zotero.isNode) {
			if (typeof DOMParser === 'undefined') {
				throw new Error("Utilities.walkNoteDOM(): DOMParser unavailable");
			}
			doc = new DOMParser().parseFromString(wrappedNote, 'text/html');
		}
		else {
`);

export function applyDomParserAdapter(source: string): string {
	let code = replaceOnce(source, unescapeHtmlAnchor, unescapeHtmlReplacement, id);
	code = replaceOnce(code, walkNoteDomAnchor, walkNoteDomReplacement, id);
	return code;
}

const mod: ZoteroCodemod = {
	id,
	description: "Replace upstream Node-only jsdom parsing branches with host-provided DOMParser.",
	upstreamFiles: ["modules/utilities/utilities.js"],
	transform({ source }) {
		return {
			code: applyDomParserAdapter(source),
			notes: [
				"Removed jsdom requires from Node parsing paths so the browser runtime bundle stays dependency-free.",
			],
		};
	},
};

export default mod;
