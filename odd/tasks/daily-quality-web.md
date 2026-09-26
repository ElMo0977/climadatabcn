# Daily quality in the web UI

## Objective and problem
Show per-variable coverage and quality for daily values derived from XEMA 30-minute observations. The current daily web aggregation can present a value from sparse readings as if it represented a full day.

## Scope and authorization
- Approved domain policy: 100% coverage is complete; >70% is partial usable; <=70% is incomplete. Temperature, humidity, and mean wind additionally require no gap over six hours. Partial precipitation totals and gust maxima are observed lower bounds. Keep coverage distinct from XEMA validation status.
- Keep the 30-minute XEMA feed as the operational source so the preceding week is available on Monday morning.
- Web UI only. Do not change Excel export behavior.
- **Current authorization: phases 0–1 only.** Phase 0 PR #14 is merged into `main`; do not start phases 2–6 without a later instruction.
- The user reviewed and approved the completed phase 0 diff and checks before the local commit. For phase 1, the user delegated code review to the assistant, explicitly prohibited GGA file transfer, and authorized a local commit and PR if independent review passes.

## Route and test mode
- Phase 0 route: delegated direct. Mapping required more than four files; two non-trivial test files need a bounded writer.
- Phase 1 route: delegated direct. Mapping spans provider, domain type, tests, and XEMA contract documentation; delegate one bounded writer.
- Strict TDD enabled per `sdd/climadatabcn/testing-capabilities` observation #612; runner `npm test` (Vitest). Record actual RED/GREEN evidence, without inventing a RED for a characterization test that passes on existing behavior.
- Native RDD is OFF globally (`gentle-ai review mode status`, checked before the phase 0 commit); no native review is due.
- Delivery strategy: `ask-on-risk` with user-approved `feature-branch-chain`; forecast for the whole feature is approximately 1,000–1,450 authored changed lines. Phase 0 is the merged first slice; phase 1 is the next slice targeting `main`. The user authorized the configured GitHub session for this repository's phase 1 delivery.

## Checklist
- [x] **P0A — Green baseline:** corrected the stale `useObservations` test expectation for the existing 30-minute request and daily aggregation. Focused and full tests passed.
- [x] **P0B — Excel characterization:** added tests of current daily and 30-minute Excel output, including a sparse/partial day and absent values, with no production Excel or aggregation change. Focused and full tests passed.
- [x] **P0C — Phase review:** inspected the complete diff and ran lint, test, build, bundle check, and `git diff --check`; reported outcomes and rollback boundary. User approved the diff and delivery strategy before committing.
- [x] **P1 — XEMA metadata:** preserved optional validation status and temporal base per variable (including blank versus absent/unknown), without changing values, timestamps, 30-minute UI, or Excel. RED/GREEN provider tests, documentation, full regressions, independent assistant diff review, and local work-unit commit are complete. PR delivery remains pending.
- [ ] **P2 — Pure daily-quality engine:** implement per-variable slot coverage, validation, gap, and DST semantics with boundary tests. Not yet authorized.
- [ ] **P3 — Web integration:** connect quality-aware daily data to hooks and statistics while preserving the Excel legacy path. Not yet authorized.
- [ ] **P4 — Table and summaries:** expose quality states and lower-bound semantics in table, alerts, and KPIs. Not yet authorized.
- [ ] **P5 — Charts:** distinguish partial and incomplete values in charts and exports. Not yet authorized.
- [ ] **P6 — Documentation and regression:** synchronize canonical docs and perform full functional and visual regression. Not yet authorized.

## Evidence and next step
- Starting branch: `codex/daily-quality-web`, from `main` at `1e24cb4`.
- Starting worktree had only untracked `.codegraph/`, a tool-managed analysis index.
- Observed RED before P0A: `npm test -- src/hooks/useObservations.test.ts` failed 1/7 because the test expected a `day` request but the hook requested `30min`.
- Focused GREEN: `npm test -- src/hooks/useObservations.test.ts src/hooks/useExcelExport.test.ts src/lib/exportExcel.test.ts` passed 15/15.
- Full checks: `npm test` passed 97/97 in 26 files; `npm run lint`, `npm run build`, `npm run check:bundle` (after build), and `git diff --check` passed. Build emitted existing advisory warnings for outdated Browserslist data and chunks over 500 kB.
- Authored test diff: 150 additions and 3 deletions in three test files. Production code, Excel behavior, and documentation were not modified. Runtime harness: N/A, test-only change. Rollback boundary: the three changed test files and this task document; exclude `.codegraph/`.
- User approved phase 0 changes and `feature-branch-chain` before the commit.
- Work-unit commit: `768ce04025bf1860a8dad3b384d8c6b81c2c1713` (`test(daily-quality): characterize daily and Excel baselines`); phase 0 slice contains this commit. No PR or push.
- Commit hook caveat: `.git/hooks/pre-commit` automatically invoked `gga run` and reported sending the four staged files to Claude for review. This was not anticipated in the local-only authorization; do not invoke it again without explicit remote authorization. This identity/caveat update is not committed yet.
- Phase 1 implementation: `Observation.variableMetadata` optionally keys validation and temporal-base metadata by each of the six measured fields; XEMA now selects `codi_base` and maps both codes without changing numeric values. Raw trimmed codes are retained; blank, absent, unexpected, `V`/`T`, and `HO`/`SH` have distinct normalized states. Provider contract documentation was updated. No Excel production file was changed.
- Phase 1 RED: focused provider test initially failed 3/14 for missing metadata/`codi_base`; after adding temporal-base normalization, it failed 4/15 for the newly asserted base states. GREEN: provider tests 17/17, full `npm test` 100/100 in 26 files; `npm run lint`, `npm run build`, post-build `npm run check:bundle`, and `git diff --check` passed. Build retained advisory Browserslist/chunk warnings. Runtime harness: N/A, provider-mapping change with mocked service tests; no visual UI change. Rollback boundary: `src/types/weather.ts`, `src/services/providers/xemaObservations.ts`, `src/services/providers/xemaTransparencia.test.ts`, and `docs/xema-transparencia-implementation.md`; preserve the phase 0 evidence in this document.
- Phase 1 work-unit commit: `3cd64bcf049e9a6af09c3f3ac737015577cf87dc` (`feat(xema): preserve per-variable validation metadata`), 175 additions and 25 deletions across five files. Commit was made with a per-command `core.hooksPath=/dev/null` override, so GGA sent nothing; no repository/global hook configuration changed.
- Phase 1 independent review: inspected provider mapping, optional domain types, all changed tests, and contract documentation; confirmed no production Excel or UI edits. Re-ran `npm test` (100/100), `npm run lint`, `npm run build`, post-build `npm run check:bundle`, and `git diff --check` successfully. The user prohibited GGA transfer; bypass its hook for the authorized local commit only, without changing repository/global hook settings.
- Phase 1 delivery branch: `codex/daily-quality-web-p1`, created from phase 0 commit `768ce04` to keep the next PR distinct from merged PR #14. Verified the commit is an ancestor of refreshed `origin/main`.
- Repository PR policy check: GitHub `ElMo0977/climadatabcn` has no issue forms, no `status:approved` or `type:*` labels, and no issues; merged PR #14 did not use issue linkage. Do not invent an issue or label solely to satisfy a generic skill for a different workflow.
- Phase 1 PR: https://github.com/ElMo0977/climadatabcn/pull/15, open against `main` with 176 additions and 25 deletions across five files. It contains work-unit commit `3cd64bc`, evidence commit `b7fb8b7`, delivery-preparation commit `f7d5031`, and this tracking update. GitHub reported it mergeable but no automated checks were reported at creation.
- Next: let the user decide when to merge PR #15. Do not start phase 2 or merge the PR automatically.
