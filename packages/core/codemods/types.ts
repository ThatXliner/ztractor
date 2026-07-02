export interface CodemodManifest {
	version: number;
	upstreamRoot: string;
	outputRoot: string;
	mods: CodemodManifestEntry[];
}

export interface CodemodManifestEntry {
	id: string;
	module: string;
	enabled?: boolean;
}

export interface CodemodContext {
	codemodsRoot: string;
	coreRoot: string;
	outputRoot: string;
	upstreamRoot: string;
}

export interface TransformInput {
	filePath: string;
	source: string;
	context: CodemodContext;
}

export interface TransformOutput {
	code: string;
	notes?: string[];
}

export type TransformResult = string | TransformOutput | Promise<string | TransformOutput>;

export interface ZoteroCodemod {
	id: string;
	description: string;
	upstreamFiles: string[];
	transform(input: TransformInput): TransformResult;
}

export interface CodemodFileReport {
	filePath: string;
	changed: boolean;
	notes: string[];
}

export interface CodemodReport {
	id: string;
	description: string;
	files: CodemodFileReport[];
}

export interface CodemodRunReport {
	generatedAt: string;
	mode: "check" | "write";
	upstreamRoot: string;
	upstreamCommit: string | null;
	outputRoot: string;
	mods: CodemodReport[];
}
