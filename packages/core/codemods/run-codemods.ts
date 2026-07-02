#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
	CodemodContext,
	CodemodManifest,
	CodemodReport,
	CodemodRunReport,
	TransformOutput,
	ZoteroCodemod,
} from "./types";

export interface RunCodemodsOptions {
	check?: boolean;
	write?: boolean;
	manifestPath?: string;
	coreRoot?: string;
}

interface LoadedCodemod {
	mod: ZoteroCodemod;
	modulePath: string;
}

const codemodsRoot = dirname(fileURLToPath(import.meta.url));
const defaultCoreRoot = dirname(codemodsRoot);
const defaultManifestPath = join(codemodsRoot, "manifest.json");

function parseArgs(argv: string[]): RunCodemodsOptions {
	const options: RunCodemodsOptions = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--check") {
			options.check = true;
		} else if (arg === "--write") {
			options.write = true;
		} else if (arg === "--manifest") {
			const value = argv[++i];
			if (!value) throw new Error("--manifest requires a path");
			options.manifestPath = value;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return options;
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function loadCodemod(entryModule: string, manifestDir: string): Promise<LoadedCodemod> {
	const modulePath = resolve(manifestDir, entryModule);
	const loaded = await import(pathToFileURL(modulePath).href);
	const mod = loaded.default as ZoteroCodemod | undefined;
	if (!mod) {
		throw new Error(`${entryModule} does not export a default codemod`);
	}
	return { mod, modulePath };
}

function normalizeTransformOutput(output: string | TransformOutput): TransformOutput {
	if (typeof output === "string") return { code: output };
	return output;
}

function getGitCommit(path: string): string | null {
	try {
		return execFileSync("git", ["-C", path, "rev-parse", "HEAD"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch (_e) {
		return null;
	}
}

function assertManifest(manifest: CodemodManifest): void {
	if (manifest.version !== 1) {
		throw new Error(`Unsupported codemod manifest version: ${manifest.version}`);
	}
	if (!manifest.upstreamRoot) throw new Error("Codemod manifest is missing upstreamRoot");
	if (!manifest.outputRoot) throw new Error("Codemod manifest is missing outputRoot");
	if (!Array.isArray(manifest.mods)) throw new Error("Codemod manifest mods must be an array");
}

export async function runCodemods(options: RunCodemodsOptions = {}): Promise<CodemodRunReport> {
	const mode = options.write ? "write" : "check";
	const coreRoot = resolve(options.coreRoot ?? defaultCoreRoot);
	const manifestPath = resolve(options.manifestPath ?? defaultManifestPath);
	const manifestDir = dirname(manifestPath);
	const manifest = await readJson<CodemodManifest>(manifestPath);
	assertManifest(manifest);

	const context: CodemodContext = {
		codemodsRoot: manifestDir,
		coreRoot,
		outputRoot: resolve(coreRoot, manifest.outputRoot),
		upstreamRoot: resolve(coreRoot, manifest.upstreamRoot),
	};

	const enabledEntries = manifest.mods.filter((entry) => entry.enabled !== false);
	const fileMap = new Map<string, string>();
	const reports: CodemodReport[] = [];

	for (const entry of enabledEntries) {
		const { mod } = await loadCodemod(entry.module, manifestDir);
		if (mod.id !== entry.id) {
			throw new Error(`Manifest id ${entry.id} does not match module id ${mod.id}`);
		}

		const files = [];
		for (const filePath of mod.upstreamFiles) {
			const current = fileMap.get(filePath)
				?? await readFile(resolve(context.upstreamRoot, filePath), "utf-8");
			const output = normalizeTransformOutput(
				await mod.transform({ filePath, source: current, context }),
			);
			fileMap.set(filePath, output.code);
			files.push({
				filePath,
				changed: output.code !== current,
				notes: output.notes ?? [],
			});
		}

		reports.push({
			id: mod.id,
			description: mod.description,
			files,
		});
	}

	if (mode === "write") {
		await rm(context.outputRoot, { recursive: true, force: true });
		for (const [filePath, code] of fileMap) {
			const targetPath = resolve(context.outputRoot, filePath);
			await mkdir(dirname(targetPath), { recursive: true });
			await writeFile(targetPath, code, "utf-8");
		}
	}

	const report: CodemodRunReport = {
		mode,
		upstreamRoot: context.upstreamRoot,
		upstreamCommit: getGitCommit(context.upstreamRoot),
		outputRoot: context.outputRoot,
		mods: reports,
	};

	if (mode === "write") {
		await mkdir(context.outputRoot, { recursive: true });
		await writeFile(
			join(context.outputRoot, "_codemods-report.json"),
			`${JSON.stringify(report, null, 2)}\n`,
			"utf-8",
		);
	}

	return report;
}

if (import.meta.main) {
	runCodemods(parseArgs(Bun.argv.slice(2)))
		.then((report) => {
			console.log(JSON.stringify(report, null, 2));
		})
		.catch((error) => {
			console.error(error instanceof Error ? error.message : error);
			process.exit(1);
		});
}
