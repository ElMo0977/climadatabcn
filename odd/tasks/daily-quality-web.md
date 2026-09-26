# Daily quality in the web UI

## Objective and problem
Show per-variable coverage and quality for daily values derived from XEMA 30-minute observations. The current daily web aggregation can present a value from sparse readings as if it represented a full day.

## Scope and authorization
- Approved domain policy: 100% coverage is complete; >70% is partial usable; <=70% is incomplete. Temperature, humidity, and mean wind additionally require no gap over six hours. Partial precipitation totals and gust maxima are observed lower bounds. Keep coverage distinct from XEMA validation status.
- Keep the 30-minute XEMA feed as the operational source so the preceding week is available on Monday morning.
- Web UI only. Do not change Excel export behavior.
- **Current authorization: phase 0 only.** Do not start phases 1–6 without a later user instruction.
- The user reviewed and approved the completed phase 0 diff and checks before the local commit. Phases 1–6 still require a later instruction.

## Route and test mode
- Phase 0 route: delegated direct. Mapping required more than four files; two non-trivial test files need a bounded writer.
- Strict TDD enabled per `sdd/climadatabcn/testing-capabilities` observation #612; runner `npm test` (Vitest). Record actual RED/GREEN evidence, without inventing a RED for a characterization test that passes on existing behavior.
- Native RDD is OFF globally (`gentle-ai review mode status`, checked before the phase 0 commit); no native review is due.
- Delivery strategy: `ask-on-risk` with user-approved `feature-branch-chain`; forecast for the whole feature is approximately 1,000–1,450 authored changed lines. Phase 0 is the first reviewable slice; later slice boundaries and PR commits remain to be determined. No PR or remote operation is authorized.

## Checklist
- [x] **P0A — Green baseline:** corrected the stale `useObservations` test expectation for the existing 30-minute request and daily aggregation. Focused and full tests passed.
- [x] **P0B — Excel characterization:** added tests of current daily and 30-minute Excel output, including a sparse/partial day and absent values, with no production Excel or aggregation change. Focused and full tests passed.
- [x] **P0C — Phase review:** inspected the complete diff and ran lint, test, build, bundle check, and `git diff --check`; reported outcomes and rollback boundary. User approved the diff and delivery strategy before committing.
- [ ] **P1 — XEMA metadata:** preserve provider validation metadata without changing values or the 30-minute UI. Not yet authorized.
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
- Work-unit commit: pending creation and identity recording below; no PR or push.
- Next: create the local phase 0 commit, record its identity, and stop until phase 1 is authorized.
