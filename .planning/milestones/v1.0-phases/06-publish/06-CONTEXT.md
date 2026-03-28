# Phase 6: Publish - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare both packages for npm publication: update READMEs with stable quick-start examples, align versions, verify builds, and produce a publish-ready state. The actual `npm publish` command is deferred — user will run it manually when ready.

</domain>

<decisions>
## Implementation Decisions

### Version Strategy
- Align both packages to `1.0.0` (bump `ztractor-node` from `0.1.0` to `1.0.0`)
- Keep ESM-only — no CJS `main` field, no `browser` exports condition

### README Quality
- Quick-start examples use `https://arxiv.org/abs/2303.08774` (stable arXiv URL, confirmed working in Phase 4)
- Show realistic output shape (itemType, title, creators, date) in examples
- Node README includes one-line XPath caveat: XPath 1.0 only, not 2.0
- No root-level README needed — each package README is self-contained

### Publish Workflow
- Build both packages fresh before publishing (ensures dist is current)
- Provide dry-run instructions and publish commands for user to run manually
- Do NOT execute `npm publish` — user will publish when ready
- Note in README/SUMMARY that publishing requires `npm login` first

### Claude's Discretion
- Exact wording of README sections
- Output format for quick-start examples

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/README.md` — 94 lines, has install + quick-start sections already
- `packages/node/README.md` — 113 lines, has install + quick-start sections already
- `packages/core/package.json` — `version: "1.0.0"`, no `private` field, npm-ready
- `packages/node/package.json` — `version: "0.1.0"`, needs bump to 1.0.0

### Established Patterns
- Both packages use `bun run build` for building
- Both packages have `"files": ["dist"]` — only dist is published
- Core build: `bun bundle-translate.ts && bun bundle-translators.ts && bunx bunup ...`
- Node build: `bunx bunup --exports`

### Integration Points
- `ztractor-node` depends on `ztractor` via `workspace:*` — npm publish requires real semver range

</code_context>

<specifics>
## Specific Ideas

- arXiv quick-start URL: `https://arxiv.org/abs/2303.08774` (GPT-4 paper — stable, well-known)
- XPath caveat wording: "Note: XPath support uses an xmldom bridge (XPath 1.0). XPath 2.0 is not supported."

</specifics>

<deferred>
## Deferred Ideas

- Actual `npm publish` execution — user will run manually when ready
- Merging `rewrite` branch to `main` before publishing — user decision
- Root-level README

</deferred>
