---
phase: 3
slug: sandbox-advanced-flows
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in) |
| **Config file** | `packages/core/bunfig.toml` (preload: `tests/setup.ts`) |
| **Quick run command** | `bun test packages/core/tests/translator-system-modern.test.ts` |
| **Full suite command** | `bun test packages/core/` |
| **Estimated runtime** | ~10 seconds |

---

## Wave 0 Status

Both plans (03-01 and 03-02) use `tdd="true"` task structure. Tests are written as the first step of each task (RED phase), then implementation follows (GREEN phase). This integrates Wave 0 test scaffolding directly into the task execution cycle — no separate Wave 0 task is needed.

The `<behavior>` blocks in each task define the exact test expectations before implementation begins, satisfying the Nyquist requirement that tests exist before production code.

---

## Sampling Rate

- **After every task commit:** Run `bun test packages/core/tests/translator-system-modern.test.ts`
- **After every plan wave:** Run `bun test packages/core/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | TDD Integrated | Status |
|---------|------|-------------|-----------|-------------------|-----------------|--------|
| 3-01-T1 | 01 | SAND-03,04,06 | unit (fetch mock) | `bun test packages/core/tests/translator-system-modern.test.ts` | yes (tdd="true") | pending |
| 3-02-T1 | 02 | SAND-07 | unit | `bun test packages/core/tests/translator-system-modern.test.ts` | yes (tdd="true") | pending |

*Status: pending · green · red · flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-world translator with `loadTranslator` chain extracts items from live URL | SAND-07 | Requires live HTTP and real translator registry | Run `bun test packages/node/tests/integration.test.ts` with a translator that uses delegation (e.g., Figshare, AIP) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify with TDD-integrated test creation
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered by tdd="true" task structure (tests written before implementation)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (TDD structure satisfies Wave 0 requirement)
