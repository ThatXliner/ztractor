#!/usr/bin/env bun

/**
 * Bundle Zotero translate utilities at build time
 * Converts prototype-based global namespace code to clean ES modules
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { readdir } from "node:fs/promises";
import { join } from "path";

import recast from "recast";
import * as babelParser from "@babel/parser";
// TODO: concat in order
// TODO: modules folder too
const NEED_TO_REIMPL = [
	"translators.js",
	"http.js",
	"translation/translate_item.js",
];
const CONCAT_ORDER = [
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
	"src/tlds.js",
	"src/proxy.js",
	"src/rdf/init.js",
	"src/rdf/uri.js",
	"src/rdf/term.js",
	"src/rdf/identity.js",
	"src/rdf/n3parser.js",
	"src/rdf/rdfparser.js",
	"src/rdf/serialize.js",
];
async function main() {
	const translateDir = join(process.cwd(), "translate");
	const srcDir = join(translateDir, "src");
	const utilsDir = join(translateDir, "modules", "utilities");
	const outputFile = join(
		process.cwd(),
		"src",
		"utilities-translate-bundle.ts",
	);

	console.log("📦 Bundling Zotero translate utilities...");

	if (!existsSync(translateDir)) {
		console.error(
			"❌ Translate directory not found. Run: git submodule update --init",
		);
		process.exit(1);
	}

	const srcFiles: [string, string][] = (
		await readdir(srcDir, { recursive: true })
	)
		.filter((x) => x.endsWith(".js"))
		.filter((x) => !NEED_TO_REIMPL.includes(x))
		.map((x) => [join(srcDir, x), readFileSync(join(srcDir, x), "utf-8")]);
	const utilFiles: [string, string][] = (await readdir(utilsDir))
		.filter((x) => x.endsWith(".js"))
		.map((x) => [join(utilsDir, x), readFileSync(join(utilsDir, x), "utf-8")]);

	console.log("✅ Read submodule");
	const translationBundlePatch = readFileSync(
		join(process.cwd(), "translation-bundle-patch.js"),
		"utf-8",
	);
	// Generate output
	let output = generateTranslateBundle(
		[...srcFiles, ...utilFiles]
			.toSorted(
				(a, b) =>
					CONCAT_ORDER.findIndex((x) => a[0].includes(x)) -
					CONCAT_ORDER.findIndex((x) => b[0].includes(x)),
			)
			.map((x) => unwrapTopLevelIIFE(x[1]))
			.join("\n") +
			"\n" +
			translationBundlePatch,
	);

	// Patch require() calls that reference relative paths or optional node modules
	// (jsdom, rdflib internals) so bundlers don't try to statically resolve them.
	// These code paths are guarded by runtime checks (Zotero.isNode, typeof process)
	// and never execute in browser/ESM builds.
	output = output.replace(
		/\brequire\(("(?:\.\/[^"]+|jsdom)")\)/g,
		`(eval('require'))($1)`,
	);

	writeFileSync(outputFile, output, "utf-8");

	console.log(`✨ Generated ${outputFile}`);
	console.log(`   File size: ${(output.length / 1024).toFixed(2)} KB`);
	console.log(`✅ Done!`);
}

function generateTranslateBundle(utilities: string): string {
	return `/**
 * Auto-generated Zotero translate utilities bundle
 * Generated at: ${new Date().toISOString()}
 * Source: https://github.com/zotero/translate
 *
 * WARNING: This is an auto-generated file. Do not edit manually!
 * Run 'bun run bundle-translate.ts' to regenerate.
 */
var module = undefined;
var process = undefined;
${utilities}

// ===== Re-export Zotero for convenience =====
export { Zotero, ZOTERO_CONFIG };

// ===== Named exports for individual utilities =====
const _mockTranslate = { _sandboxManager: null, _debug: () => {} };
const _translateUtils = new Zotero.Utilities.Translate(_mockTranslate);

export const processDocuments = _translateUtils.processDocuments.bind(_translateUtils);
export const requestDocument = _translateUtils.requestDocument.bind(_translateUtils);
export const request = _translateUtils.request.bind(_translateUtils);
export const requestText = _translateUtils.requestText.bind(_translateUtils);
export const requestJSON = _translateUtils.requestJSON.bind(_translateUtils);
export const getItemArray = _translateUtils.getItemArray.bind(_translateUtils);
export const getVersion = _translateUtils.getVersion.bind(_translateUtils);
export const doGet = _translateUtils.doGet.bind(_translateUtils);
export const doPost = _translateUtils.doPost.bind(_translateUtils);
export const ZU = Zotero.Utilities;
`;
}

const { visit } = recast.types;

function parse(code: string) {
	return recast.parse(code, {
		parser: {
			parse(source: string) {
				return babelParser.parse(source, {
					sourceType: "module",
					plugins: ["jsx", "typescript"],
				});
			},
		},
	});
}

function findTopLevelIIFE(code: string) {
	const ast = parse(code);

	let match = null;

	visit(ast, {
		visitProgram(path) {
			for (const stmt of path.node.body) {
				if (stmt.type !== "ExpressionStatement") continue;

				const expr = stmt.expression;
				if (expr.type !== "CallExpression") continue;
				if (expr.arguments.length !== 0) continue;

				const callee = expr.callee;
				if (callee.type !== "FunctionExpression") continue;
				if (callee.id !== null) continue;

				match = stmt;
				break;
			}

			// Stop traversal early
			return false;
		},
	});

	return match;
}
function unwrapTopLevelIIFE(code: string) {
	const ast = parse(code);

	visit(ast, {
		visitProgram(path) {
			const body = path.node.body;

			for (let i = 0; i < body.length; i++) {
				const stmt = body[i];
				if (
					stmt.type === "ExpressionStatement" &&
					stmt.expression.type === "CallExpression" &&
					stmt.expression.arguments.length === 0 &&
					stmt.expression.callee.type === "FunctionExpression" &&
					stmt.expression.callee.id === null
				) {
					body.splice(i, 1, ...stmt.expression.callee.body.body);
					break;
				}
			}

			return false;
		},
	});

	return recast.print(ast).code;
}
main().catch((err) => {
	console.error("Error bundling translate utilities:", err);
	process.exit(1);
});
