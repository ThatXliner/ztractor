---
phase: 4
slug: verification
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-27
audited: 2026-03-27
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test |
| **Config file** | `packages/core/bunfig.toml` (package) + `bunfig.toml` (repo root) |
| **Quick run command** | `bun test packages/core/tests/zotero-compat.test.ts` |
| **Full suite command** | `bun test` |
| **Live translator tests** | `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` |
| **Estimated runtime** | ~6 seconds (offline) / ~30 seconds (TRANSLATOR_COMPAT) |

---

## Sampling Rate

- **After every task commit:** Run `bun test packages/core/tests/zotero-compat.test.ts`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | VERIFY-01, VERIFY-02 | unit | `bun test packages/core/tests/zotero-compat.test.ts` | ✅ | ✅ green |
| 4-01-02 | 01 | 1 | VERIFY-01, VERIFY-02 | unit | `bun test packages/core/tests/zotero-compat.test.ts` | ✅ | ✅ green |
| 4-01-03 | 01 | 1 | VERIFY-01, VERIFY-02 | unit | `bun test packages/core/tests/zotero-compat.test.ts` | ✅ | ✅ green |
| 4-02-01 | 02 | 2 | VERIFY-01 | integration | `TRANSLATOR_COMPAT=1 bun test packages/core/tests/zotero-compat.test.ts` | ✅ | ✅ green |
| 4-02-02 | 02 | 2 | VERIFY-02 | integration | `bun test` | ✅ | ✅ green |
| 4-03-01 | 03 | 3 | VERIFY-02 | infra | `bun test packages/core/` | ✅ | ✅ green |
| 4-04-01 | 04 | 4 | VERIFY-01 | manual-UAT | `TRANSLATOR_COMPAT=1 bun test` (human-verified) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

The Phase 1 test harness (`zotero-compat.test.ts`, `runTranslatorWebTest()`, `compareItems()`, `parseTestCases()`) is already in place. Plan 03 added root-level `bunfig.toml` so `bun test packages/core/` from repo root also works.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

Plan 04 was a human UAT checkpoint (no code changes). Live translator test results were visually confirmed by the user: 6 pass, 0 fail.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ Nyquist-compliant

---

## Validation Audit 2026-03-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tasks updated (pending → green) | 4 |
| Tasks added (Plans 03/04) | 3 |

**Suite state at audit:** 325 pass, 5 skip, 0 fail (14 files)
**TRANSLATOR_COMPAT suite:** 6 pass, 0 fail (human-verified 2026-03-27)
