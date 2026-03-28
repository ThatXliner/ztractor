---
phase: 1
slug: test-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun built-in test runner (bun 1.3.10) |
| **Config file** | `packages/core/bunfig.toml` — `preload = ["./tests/setup.ts"]` |
| **Quick run command** | `cd packages/core && bun test tests/harness/` |
| **Full suite command** | `cd packages/core && bun test` |
| **Estimated runtime** | ~3 seconds (unit tests only, no network) |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/core && bun test tests/harness/`
- **After every plan wave:** Run `cd packages/core && bun test`
- **Before `/gsd:verify-work`:** Full suite must be green + baseline report generated
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | TEST-01 | unit | `cd packages/core && bun test tests/harness/parse-test-cases.test.ts` | No — Wave 0 | pending |
| 1-01-02 | 01 | 1 | TEST-01 | unit | `cd packages/core && bun test tests/harness/normalize-item.test.ts` | No — Wave 0 | pending |
| 1-02-01 | 02 | 2 | TEST-02 | integration (live) | `cd packages/core && bun test tests/zotero-compat.test.ts` | No — Wave 0 | pending |
| 1-02-02 | 02 | 2 | TEST-03 | smoke | `cd packages/core && TRANSLATOR_FILTER="Embedded Metadata" bun run baseline 2>&1 \| grep "Baseline report"` | No — Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/harness/parse-test-cases.ts` — core extraction logic (REQ TEST-01)
- [ ] `tests/harness/normalize-item.ts` — item normalization (REQ TEST-01)
- [ ] `tests/harness/parse-test-cases.test.ts` — unit tests for parse logic
- [ ] `tests/harness/normalize-item.test.ts` — unit tests for normalization
- [ ] `tests/zotero-compat.test.ts` — harness entry point (REQ TEST-02)
- [ ] Baseline report generation script in `package.json` scripts (REQ TEST-03)

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 3s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
