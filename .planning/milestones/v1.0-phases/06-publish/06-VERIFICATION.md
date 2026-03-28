---
phase: 06-publish
verified: 2026-03-27T20:00:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Publish ztractor (core) to npm"
    expected: "npm view ztractor version returns 1.0.0"
    why_human: "npm publish requires user npm credentials and intentional manual action"
  - test: "Publish ztractor-node to npm"
    expected: "npm view ztractor-node version returns 1.0.0"
    why_human: "npm publish requires user npm credentials and intentional manual action; core must be published first since node depends on ztractor ^1.0.0"
  - test: "Post-publish install verification"
    expected: "mkdir /tmp/ztractor-test && cd /tmp/ztractor-test && npm init -y && npm install ztractor-node && node test.mjs extracts metadata from https://arxiv.org/abs/2303.08774"
    why_human: "Requires packages to be live on npm; cannot verify install from registry before publish"
---

# Phase 6: Publish Verification Report

**Phase Goal:** Both packages are live on npm and a new user can install, run a quick-start example, and extract real metadata in under 5 minutes
**Verified:** 2026-03-27T20:00:00Z
**Status:** human_needed — all automated publish-readiness checks pass; actual npm publish requires human action
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Core README shows arXiv quick-start with realistic output | VERIFIED | Line 27: `url: 'https://arxiv.org/abs/2303.08774'`; lines 32-36: preprint, GPT-4 Technical Report, creators, date, DOI |
| 2 | Node README shows arXiv quick-start with realistic output and XPath caveat | VERIFIED | Lines 25, 64: arXiv URL; line 87: "XPath support uses an xmldom bridge (XPath 1.0). XPath 2.0 is not supported." |
| 3 | ztractor-node version is 1.0.0 | VERIFIED | `packages/node/package.json` line 4: `"version": "1.0.0"` |
| 4 | ztractor-node depends on ztractor ^1.0.0 (not workspace:*) | VERIFIED | `packages/node/package.json` line 49: `"ztractor": "^1.0.0"` — no workspace: strings found |
| 5 | Both packages build successfully with current source | VERIFIED | `bun run build` passes; dist artifacts present as of 2026-03-27 19:42 |
| 6 | All tests pass after version bump | VERIFIED | 325 pass, 5 skip, 0 fail across 14 files (5.60s) |
| 7 | dist/ directories contain fresh build artifacts | VERIFIED | All 4 dist files present; npm pack --dry-run lists correct file sets only |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/README.md` | Core package README with arXiv quick-start | VERIFIED | Contains `arxiv.org/abs/2303.08774`, shows preprint/GPT-4 metadata, no NYTimes URL |
| `packages/node/README.md` | Node package README with arXiv quick-start and XPath caveat | VERIFIED | Contains `arxiv.org/abs/2303.08774` (2 occurrences), XPath 1.0 caveat at line 87 |
| `packages/node/package.json` | Node package.json with version 1.0.0 and real semver dep | VERIFIED | `"version": "1.0.0"`, `"ztractor": "^1.0.0"` |
| `packages/core/dist/index.js` | Core package built output | VERIFIED | 14,754 lines, 547.6 KB; exports extractMetadata, findTranslators, getAvailableTranslators, BundledRegistry, HTTPRegistry, Item, ZU, executeDetectWeb, executeDoWeb |
| `packages/core/dist/index.d.ts` | Core package type definitions | VERIFIED | 307 lines, 8.0 KB |
| `packages/node/dist/index.js` | Node package built output | VERIFIED | 166 lines, 4.6 KB; imports from "ztractor" at line 2; re-exports all core exports at line 152 |
| `packages/node/dist/index.d.ts` | Node package type definitions | VERIFIED | 301 lines, 7.9 KB |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/node/package.json` | `packages/core/package.json` | ztractor dependency version | WIRED | `"ztractor": "^1.0.0"` — matches core version exactly; no workspace:* |
| `packages/node/dist/index.js` | `packages/core/dist/index.js` | ztractor import | WIRED | Line 2: `import { extractMetadata as coreExtractMetadata } from "ztractor"`; line 152: `export * from "ztractor"` |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces documentation and build artifacts, not dynamic rendering components. Dist artifacts export real functions backed by 682 bundled translators (7.75 MB translator registry chunk confirmed in build output).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Core package exports resolve | `node -e "import('...core/dist/index.js').then(m => console.log(Object.keys(m)...))"` | `core OK, exports: BundledRegistry, HTTPRegistry, Item, ZU, executeDetectWeb, executeDoWeb, extractMetadata, findTranslators` | PASS |
| Node package exports resolve | `node -e "import('...node/dist/index.js').then(m => console.log(Object.keys(m)...))"` | `node OK, exports: BundledRegistry, HTTPRegistry, Item, ZU, executeDetectWeb, executeDoWeb, extractMetadata, findTranslators` | PASS |
| npm pack dry-run — core | `cd packages/core && npm pack --dry-run` | `ztractor@1.0.0`, 7 files, 2.2 MB packed / 9.1 MB unpacked — only dist/ + package.json + LICENSE + README | PASS |
| npm pack dry-run — node | `cd packages/node && npm pack --dry-run` | `ztractor-node@1.0.0`, 5 files, 17.6 kB packed / 52.5 kB unpacked — only dist/ + package.json + LICENSE + README | PASS |
| All tests pass | `bun test` | 325 pass, 5 skip, 0 fail across 14 files | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PUB-01 | 06-01, 06-02 | `ztractor` (core) published to npm with correct exports, types, and package.json fields | SATISFIED (publish-ready; actual publish deferred to human) | `"version": "1.0.0"`, exports field resolves to `./dist/index.js`, types at `./dist/index.d.ts`, npm pack dry-run passes with correct 7-file set |
| PUB-02 | 06-01, 06-02 | `ztractor-node` published to npm with correct exports, types, and package.json fields | SATISFIED (publish-ready; actual publish deferred to human) | `"version": "1.0.0"`, `"ztractor": "^1.0.0"` (no workspace:*), npm pack dry-run passes with correct 5-file set |
| PUB-03 | 06-01 | Both packages have a README with install instructions and a working quick-start example | SATISFIED | Both READMEs have `npm install` + `bun add` install instructions, arXiv quick-start with realistic preprint metadata output, no placeholder URLs |

All three PUB requirements are mapped to phase 06 in REQUIREMENTS.md (marked Complete). No orphaned requirements found — all IDs declared in PLAN frontmatter appear in REQUIREMENTS.md and are covered by verified artifacts.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME, placeholder text, empty implementations, or NYTimes stub URLs found in any checked file. The xmldom parse error output during `bun test` (`[xmldom error] invalid doc source`) is expected behavior from the edge-case test suite testing malformed HTML inputs — 0 tests fail.

### Human Verification Required

#### 1. Publish ztractor (core) to npm

**Test:** Run `npm login` then `cd packages/core && npm publish`
**Expected:** Package live at https://www.npmjs.com/package/ztractor at version 1.0.0; `npm view ztractor version` returns `1.0.0`
**Why human:** npm publish requires authenticated npm credentials and is an irreversible action that should be intentionally triggered by the package owner

#### 2. Publish ztractor-node to npm

**Test:** After core is published, run `cd packages/node && npm publish`
**Expected:** Package live at https://www.npmjs.com/package/ztractor-node at version 1.0.0; `npm view ztractor-node version` returns `1.0.0`
**Why human:** Same as above; must run after core is published since ztractor-node depends on ztractor ^1.0.0 from the registry

#### 3. Post-publish end-to-end install verification

**Test:**
```bash
mkdir /tmp/ztractor-test && cd /tmp/ztractor-test
npm init -y
npm install ztractor-node
node --input-type=module <<'EOF'
import { extractMetadata } from 'ztractor-node';
const result = await extractMetadata({ url: 'https://arxiv.org/abs/2303.08774' });
console.log(result.success, result.items?.[0]?.title);
EOF
```
**Expected:** Prints `true GPT-4 Technical Report` (or similar preprint title)
**Why human:** Requires packages to be live on the npm registry; cannot simulate a fresh install from registry before publish occurs

### Gaps Summary

No gaps — all automated publish-readiness checks pass. The phase goal decomposes into two parts: (1) packages are publish-ready, and (2) packages are live on npm. Part 1 is fully verified programmatically. Part 2 is intentionally deferred to human action per the phase design.

**Publish checklist (from 06-02-SUMMARY.md):**
- [ ] `npm login` (verify account with `npm whoami`)
- [ ] `cd packages/core && npm publish`
- [ ] Verify: `npm view ztractor version` shows `1.0.0`
- [ ] `cd packages/node && npm publish`
- [ ] Verify: `npm view ztractor-node version` shows `1.0.0`
- [ ] Post-publish install test from a fresh directory

---

_Verified: 2026-03-27T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
