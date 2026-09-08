#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildZoteroRuntime } from "./build-zotero-runtime";

interface UpgradeOptions {
	ref: string;
	fetch: boolean;
}

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const translateRoot = join(coreRoot, "translate");

function parseArgs(argv: string[]): UpgradeOptions {
	const options: UpgradeOptions = {
		ref: "origin/master",
		fetch: true,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--ref") {
			const value = argv[++i];
			if (!value) throw new Error("--ref requires a git ref");
			options.ref = value;
		} else if (arg === "--no-fetch") {
			options.fetch = false;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return options;
}

function git(args: string[], cwd: string = translateRoot): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function ensureCleanSubmodule(): void {
	const status = git(["status", "--porcelain"]);
	if (status) {
		throw new Error(
			`Cannot upgrade Zotero translate with dirty submodule state:\n${status}`,
		);
	}
}

async function main() {
	const options = parseArgs(Bun.argv.slice(2));
	ensureCleanSubmodule();

	const from = git(["rev-parse", "HEAD"]);
	if (options.fetch) {
		git(["fetch", "origin"]);
	}
	const to = git(["rev-parse", options.ref]);

	if (from !== to) {
		git(["checkout", to]);
	}

	const runtimePath = await buildZoteroRuntime();
	const report = {
		generatedAt: new Date().toISOString(),
		upstream: {
			repository: "https://github.com/zotero/translate",
			from,
			to,
			ref: options.ref,
		},
		runtimePath,
		nextSteps: [
			"Run bun test from packages/core.",
			"Review generated codemod report for changed upstream integration points.",
			"Commit the submodule pointer and generated runtime together.",
		],
	};

	const reportPath = join(coreRoot, "src/generated/zotero-runtime/upgrade-report.json");
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
	console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
