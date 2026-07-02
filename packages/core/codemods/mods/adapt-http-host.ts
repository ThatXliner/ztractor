import type { ZoteroCodemod } from "../types";
import { normalizeIndent, replaceOnce } from "./_utils";

const id = "adapt-http-host";

const requestAnchor = "\t\tthrow new Error(`Zotero.HTTP.request(): not implemented`);";
const requestReplacement = normalizeIndent(`
		if (!Zotero.__ztractorHost || !Zotero.__ztractorHost.http) {
			throw new Error("Zotero.HTTP.request(): missing Ztractor host HTTP adapter");
		}
		return Zotero.__ztractorHost.http.request(method, url, options);
`);

const wrapDocumentAnchor = "\t\tthrow new Error('Zotero.HTTP.wrapDocument(): not implemented');";
const wrapDocumentReplacement = normalizeIndent(`
		if (!Zotero.__ztractorHost || !Zotero.__ztractorHost.dom) {
			throw new Error("Zotero.HTTP.wrapDocument(): missing Ztractor host DOM adapter");
		}
		return Zotero.__ztractorHost.dom.wrapDocument(doc, docURL);
`);

const processDocumentsAnchor = "\t\tthrow new Error(`Zotero.HTTP.processDocuments(): not implemented`);";
const processDocumentsReplacement = normalizeIndent(`
		if (!Zotero.__ztractorHost || !Zotero.__ztractorHost.http) {
			throw new Error("Zotero.HTTP.processDocuments(): missing Ztractor host HTTP adapter");
		}
		return Zotero.__ztractorHost.http.processDocuments(urls, processor, options);
`);

export function applyHttpHostAdapter(source: string): string {
	let code = replaceOnce(source, requestAnchor, requestReplacement, id);
	code = replaceOnce(code, wrapDocumentAnchor, wrapDocumentReplacement, id);
	code = replaceOnce(code, processDocumentsAnchor, processDocumentsReplacement, id);
	return code;
}

const mod: ZoteroCodemod = {
	id,
	description: "Route Zotero HTTP and document loading hooks through the Ztractor host adapter.",
	upstreamFiles: ["src/http.js"],
	transform({ source }) {
		return {
			code: applyHttpHostAdapter(source),
			notes: [
				"Replaced upstream not-implemented HTTP hooks with calls into Zotero.__ztractorHost.",
			],
		};
	},
};

export default mod;
