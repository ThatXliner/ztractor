import type { TransformOutput, ZoteroCodemod } from "../types";
import { replaceOnce } from "./_utils";

const id = "adapt-xregexp-runtime";

const utilitiesFallbackAnchor = [
	"if (!Utilities.XRegExp) {",
	"\tif (typeof module != 'undefined') {",
	"\t\tUtilities.XRegExp = require('./xregexp-all');",
	"\t}",
	"}",
].join("\n");

const utilitiesFallbackReplacement = [
	"if (!Utilities.XRegExp) {",
	"\tUtilities.XRegExp = XRegExp;",
	"}",
].join("\n");

const browserGlobalAnchor = "else{var g;if(typeof window!==\"undefined\"){g=window}else if(typeof global!==\"undefined\"){g=global}else if(typeof self!==\"undefined\"){g=self}else{g=this}g.XRegExp = f()}})(function(){";

function adaptXRegExpBundle(source: string): string {
	if (!source.includes("require('./xregexp')")) {
		throw new Error(`${id}: expected Browserify require anchor was not found`);
	}
	if (!source.includes(browserGlobalAnchor)) {
		throw new Error(`${id}: expected browser global export anchor was not found`);
	}
	const code = source
		.replace(/\brequire\b/g, "__xregexpRequire")
		.replace(browserGlobalAnchor, "else{var g=__ztractorXRegExpRoot;g.XRegExp=f()}})(function(){");
	return [
		"var XRegExp = (function () {",
		"\tvar __ztractorXRegExpRoot = {};",
		code,
		"\treturn __ztractorXRegExpRoot.XRegExp;",
		"})();",
	].join("\n");
}

function adaptUtilitiesFallback(source: string): string {
	return replaceOnce(source, utilitiesFallbackAnchor, utilitiesFallbackReplacement, id);
}

export function applyXRegExpRuntimeAdapter(filePath: string, source: string): TransformOutput {
	if (filePath === "modules/utilities/xregexp-all.js") {
		return {
			code: adaptXRegExpBundle(source),
			notes: [
				"Renamed Browserify-local require identifiers so downstream bundlers do not resolve internal XRegExp modules.",
			],
		};
	}

	if (filePath === "modules/utilities/utilities.js") {
		return {
			code: adaptUtilitiesFallback(source),
			notes: [
				"Replaced the CommonJS XRegExp fallback with the per-runtime bundled value.",
			],
		};
	}

	throw new Error(`${id}: unsupported file ${filePath}`);
}

const mod: ZoteroCodemod = {
	id,
	description: "Make upstream XRegExp browser bundle safe inside the generated ESM runtime.",
	upstreamFiles: [
		"modules/utilities/xregexp-all.js",
		"modules/utilities/utilities.js",
	],
	transform({ filePath, source }) {
		return applyXRegExpRuntimeAdapter(filePath, source);
	},
};

export default mod;
