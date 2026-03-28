---
phase: 2
slug: sandbox-core-api
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun built-in test runner (1.3.10) |
| **Config file** | `packages/core/bunfig.toml` — `preload = ["./tests/setup.ts"]` |
| **Quick run command** | `cd packages/core && bun test tests/translator-system-modern.test.ts` |
| **Full suite command** | `cd packages/core && bun test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/core && bun test tests/translator-system-modern.test.ts`
- **After every plan wave:** Run `cd packages/core && bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | SAND-01 | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | ❌ W0 (setExtra tests) | ⬜ pending |
| 2-01-01 | 01 | 1 | SAND-05 | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | ❌ W0 (Z alias, innerText, request* tests) | ⬜ pending |
| 2-01-01 | 01 | 1 | SAND-02 | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | ❌ W0 (bare request* globals, ZU.HTTP alias tests) | ⬜ pending |
| 2-01-02 | 01 | 1 | SAND-01, SAND-02, SAND-05 | unit | `cd packages/core && bun test tests/translator-system-modern.test.ts` | ✅ (after Task 1 creates them) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/tests/translator-system-modern.test.ts` — add tests for: `setExtra()` (3 tests), `Z` alias in sandbox (1 test), `innerText` global (1 test), bare `request*` globals (1 test), Zotero flags (1 test), `ZU.HTTP` alias (1 test) — covers SAND-01, SAND-02, SAND-05

*(Existing test infrastructure covers the full suite; only new test cases needed, not new files)*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
