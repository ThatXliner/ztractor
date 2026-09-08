#!/usr/bin/env bun

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCodemods } from "../codemods/run-codemods";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runtimeFileOrder = [
	"src/zotero.js",
	"src/promise.js",
	"modules/utilities/openurl.js",
	"modules/utilities/date.js",
	"modules/utilities/xregexp-all.js",
	"modules/utilities/xregexp-unicode-zotero.js",
	"modules/utilities/utilities.js",
	"modules/utilities/utilities_item.js",
	"modules/utilities/schema.js",
	"modules/utilities/resource/zoteroTypeSchemaData.js",
	"modules/utilities/cachedTypes.js",
	"src/utilities_translate.js",
	"src/debug.js",
	"src/http.js",
	"src/translator.js",
	"src/translators.js",
	"src/repo.js",
	"src/translation/translate.js",
	"src/translation/sandboxManager.js",
	"src/translation/translate_item.js",
	"src/proxy.js",
	"src/tlds.js",
	"src/rdf/init.js",
	"src/rdf/uri.js",
	"src/rdf/term.js",
	"src/rdf/identity.js",
	"src/rdf/n3parser.js",
	"src/rdf/rdfparser.js",
	"src/rdf/serialize.js",
];

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (_e) {
		return false;
	}
}

async function readRuntimeSource(filePath: string, upstreamRoot: string, patchedRoot: string): Promise<string> {
	const patchedPath = join(patchedRoot, filePath);
	if (await exists(patchedPath)) {
		return readFile(patchedPath, "utf-8");
	}
	return readFile(join(upstreamRoot, filePath), "utf-8");
}

function stripCommonJsExports(source: string): string {
	return source.replace(
		/\nif \(typeof module === 'object' && module\.exports\) \{\n\tmodule\.exports = [^;]+;\n\}\n?/g,
		"\n",
	);
}

const globalRuntimeExports = `
if (typeof globalThis !== 'undefined') {
	globalThis.Zotero = Zotero;
	globalThis.ZOTERO_CONFIG = ZOTERO_CONFIG;
}
`;

const globalRdfExports = `
if (typeof globalThis !== 'undefined') {
	globalThis.$rdf = $rdf;
}
`;

const globalTldsExports = `
if (typeof globalThis !== 'undefined') {
	globalThis.TLDS = TLDS;
}
`;

function stripGlobalRuntimeExports(source: string): string {
	if (!source.includes(globalRuntimeExports)) {
		throw new Error("Expected upstream Zotero global runtime export block was not found");
	}
	return source.replace(globalRuntimeExports, "\n");
}

function stripGlobalRdfExports(source: string): string {
	if (!source.includes(globalRdfExports)) {
		throw new Error("Expected upstream RDF global export block was not found");
	}
	return source.replace(globalRdfExports, "\n");
}

function stripGlobalTldsExports(source: string): string {
	if (!source.includes(globalTldsExports)) {
		throw new Error("Expected upstream TLDS global export block was not found");
	}
	return source.replace(globalTldsExports, "\n");
}

function stripRdfCommonJsBranches(source: string, filePath: string): string {
	let code = source;
	const header = /if \(typeof module === 'object' && module\.exports\) \{\n  (?:var |this\.)\$rdf = require\('\.\/init'\);\n\}\n\n?/g;
	code = code.replace(header, "");

	if (filePath === "src/rdf/init.js") {
		const moduleBranch = `if (typeof module === 'object' && module.exports) {
	module.exports = $rdf;
	$rdf.Util = require('./uri');
	$rdf = Object.assign($rdf, require('./term'));
	$rdf.IndexedFormula = require('./identity');
	$rdf.N3Parser = require('./n3parser');
	$rdf.RDFParser = require('./rdfparser');
	$rdf.Serializer = require('./serialize');
}
else {
	if (Zotero.RDF) {
		Zotero.RDF.AJAW = $rdf;
	}
	else {
		Zotero.RDF = { AJAW: $rdf };
	}
}`;
		if (!code.includes(moduleBranch)) {
			throw new Error("Expected RDF init CommonJS branch was not found");
		}
		code = code.replace(moduleBranch, `if (Zotero.RDF) {
	Zotero.RDF.AJAW = $rdf;
}
else {
	Zotero.RDF = { AJAW: $rdf };
}`);
	}

	if (filePath === "src/rdf/term.js") {
		const browserBranch = `if (typeof module === 'object' && module.exports) {
  module.exports = Term;
}
else {
  Object.assign($rdf, Term);
}`;
		if (!code.includes(browserBranch)) {
			throw new Error("Expected RDF term CommonJS branch was not found");
		}
		code = code.replace(browserBranch, "Object.assign($rdf, Term);");
	} else if (filePath !== "src/rdf/init.js") {
		const exportPattern = /\nif \(typeof module === 'object' && module\.exports\) \{\n  module\.exports = [^;\n]+;\n\}\n?/g;
		const before = code;
		code = code.replace(exportPattern, "\n");
		if (code === before) {
			throw new Error(`Expected RDF CommonJS export branch was not found in ${filePath}`);
		}
	}

	return code;
}

function renderRuntimeBundle(
	parts: { filePath: string; source: string }[],
	upstreamCommit: string | null,
	resources: { dateFormats: unknown; schema: unknown },
): string {
	const body = parts
		.map(({ filePath, source }) => {
			// RDF modules need their CommonJS branches transformed before generic
			// export stripping, which would otherwise remove the required anchors.
			let runtimeSource = filePath.startsWith("src/rdf/")
				? stripRdfCommonJsBranches(source, filePath)
				: stripCommonJsExports(source);
			if (filePath === "src/zotero.js") runtimeSource = stripGlobalRuntimeExports(runtimeSource);
			if (filePath === "src/rdf/init.js") runtimeSource = stripGlobalRdfExports(runtimeSource);
			if (filePath === "src/tlds.js") runtimeSource = stripGlobalTldsExports(runtimeSource);
			return [
				`// ===== ${filePath} =====`,
				runtimeSource.trimEnd(),
				";",
			].join("\n");
		})
		.join("\n\n");
	const runtimeFactorySource = `${body}

Zotero.Date.init(${JSON.stringify(resources.dateFormats)});
Zotero.Schema.init(${JSON.stringify(resources.schema)});
return { Zotero, ZOTERO_CONFIG };`;

	return `/**
 * Auto-generated Zotero translate runtime for Ztractor.
 *
 * Source: https://github.com/zotero/translate
 * Upstream commit: ${upstreamCommit ?? "unknown"}
 *
 * Do not edit this file manually. Run:
 *   bun run build:zotero-runtime
 */

const runtimeFactory = new Function("host", "DOMParser", "module", "require", ${JSON.stringify(runtimeFactorySource)});

function createZoteroRuntime(host, DOMParser) {
\tconst bundle = runtimeFactory(host, DOMParser, undefined, undefined);
\t// Keep the runtime configuration tied to this instance for the legacy module export below.
\tObject.defineProperty(bundle.Zotero, "__ztractorConfig", {
\t\tvalue: bundle.ZOTERO_CONFIG,
\t\tconfigurable: true,
\t});
\tif (host) {
\t\tbundle.Zotero.__ztractorHost = host;
\t}
\treturn bundle.Zotero;
}

const Zotero = createZoteroRuntime();
const ZOTERO_CONFIG = Zotero.__ztractorConfig;

/**
 * Install the host adapters that let upstream Zotero code run in Ztractor.
 * The runtime remains upstream-owned; adapters provide browser/Node services.
 */
function installZoteroHost(host) {
\tZotero.__ztractorHost = host;
\treturn Zotero;
}

function getZoteroRuntime() {
\treturn Zotero;
}

export { Zotero, ZOTERO_CONFIG, createZoteroRuntime, getZoteroRuntime, installZoteroHost };
`;
}

export async function buildZoteroRuntime(): Promise<string> {
	const report = await runCodemods({
		write: true,
		coreRoot,
	});

	const parts = [];
	for (const filePath of runtimeFileOrder) {
		parts.push({
			filePath,
			source: await readRuntimeSource(filePath, report.upstreamRoot, report.outputRoot),
		});
	}
	const dateFormats = JSON.parse(await readFile(
		join(report.upstreamRoot, "modules/utilities/resource/dateFormats.json"),
		"utf-8",
	));
	const schema = JSON.parse(await readFile(
		join(report.upstreamRoot, "modules/utilities/resource/schema/global/schema.json"),
		"utf-8",
	));

	const outputPath = join(coreRoot, "src/generated/zotero-runtime/index.js");
	const bundle = renderRuntimeBundle(parts, report.upstreamCommit, { dateFormats, schema });
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, bundle, "utf-8");
	return outputPath;
}

if (import.meta.main) {
	buildZoteroRuntime()
		.then((outputPath) => {
			console.log(`Generated ${outputPath}`);
		})
		.catch((error) => {
			console.error(error instanceof Error ? error.message : error);
			process.exit(1);
		});
}
