# Zotero Upstream Codemods

This directory contains the maintained layer that lets Ztractor consume Zotero's upstream `translate` runtime without rewriting it.

The rule is:

- `packages/core/translate` is pristine upstream input.
- `packages/core/codemods` contains small, named, replayable transforms.
- `packages/core/src/host` contains the services Ztractor owns.
- `packages/core/src/generated/zotero-runtime` is disposable generated output.

## Workflow

Generate the isomorphic ESM runtime:

```bash
bun run build:zotero-runtime
```

Check whether the current codemods still apply to the pinned upstream source:

```bash
bun run codemods:check
```

Upgrade Zotero's `translate` submodule and regenerate the runtime:

```bash
bun scripts/upgrade-zotero.ts --ref origin/master
```

The upgrade command writes `src/generated/zotero-runtime/upgrade-report.json` with the old and new upstream commits.

## Codemod Shape

Each codemod exports a `ZoteroCodemod`:

```ts
export default {
	id: "adapt-http-host",
	description: "Route Zotero HTTP hooks through Ztractor host adapters.",
	upstreamFiles: ["src/http.js"],
	transform({ source }) {
		return source;
	},
};
```

Prefer exact anchors and small replacements. If an upstream anchor disappears, the codemod should fail instead of silently generating a subtly wrong runtime.
