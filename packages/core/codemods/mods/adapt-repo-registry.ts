import type { ZoteroCodemod } from "../types";
import { replaceOnce } from "./_utils";

const id = "adapt-repo-registry";

const getCodeAnchor = [
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
].join("\n");

const getCodeReplacement = [
	"\tthis.getTranslatorCode = async function (translatorID) {",
	"\t\tlet code;",
	"\t\ttry {",
	"\t\t\tif (Zotero.__ztractorHost && Zotero.__ztractorHost.registry) {",
	"\t\t\t\tcode = await Zotero.__ztractorHost.registry.getTranslatorCode(translatorID);",
	"\t\t\t}",
	"\t\t\telse {",
	"\t\t\t\tlet url = `${ZOTERO_CONFIG.REPOSITORY_URL}code/${translatorID}?version=${Zotero.version}`;",
	"\t\t\t\tlet xmlhttp = await Zotero.HTTP.request(\"GET\", url);",
	"\t\t\t\tcode = xmlhttp.responseText;",
	"\t\t\t}",
	"\t\t}",
	"\t\tcatch (e) {",
	"\t\t\tthrow new Error(\"Repo: Code could not be retrieved for \" + translatorID + \"\\n\" + e.message);",
	"\t\t}",
].join("\n");

const getMetadataAnchor = [
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

const getMetadataReplacement = [
	"\tthis.getAllTranslatorMetadata = async (since=0) => {",
	"\t\ttry {",
	"\t\t\tif (Zotero.__ztractorHost && Zotero.__ztractorHost.registry) {",
	"\t\t\t\treturn Zotero.__ztractorHost.registry.getAllTranslatorMetadata(since);",
	"\t\t\t}",
	"",
	"\t\t\tvar url = ZOTERO_CONFIG.REPOSITORY_URL + \"metadata?version=\" + Zotero.version + \"&last=\"+ since;",
	"\t\t\tlet xmlhttp = await Zotero.HTTP.request('GET', url);",
	"\t\t\treturn JSON.parse(xmlhttp.responseText);",
	"\t\t}",
	"\t\tcatch (e) {",
	"\t\t\tthrow new Error(\"Repo: Failed to retrieve all translator metadata\\n\" + e.message);",
	"\t\t}",
	"\t};",
].join("\n");

export function applyRepoRegistryAdapter(source: string): string {
	let code = replaceOnce(source, getCodeAnchor, getCodeReplacement, id);
	code = replaceOnce(code, getMetadataAnchor, getMetadataReplacement, id);
	return code;
}

const mod: ZoteroCodemod = {
	id,
	description: "Route Zotero repository lookups through the Ztractor translator registry when present.",
	upstreamFiles: ["src/repo.js"],
	transform({ source }) {
		return {
			code: applyRepoRegistryAdapter(source),
			notes: [
				"Added a host registry path while preserving Zotero's upstream HTTP repository fallback.",
			],
		};
	},
};

export default mod;
