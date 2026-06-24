# Strata Football Repo Baseline

Date: 2026-06-19
Linear: STR-48

## Canonical UI Repo

Canonical local path:
- `/Users/bryanshepherd/strata-football-ui-new`

Reason:
- This is the current active React/Vite workspace containing the audited scoring UI, Phase 2 branch work, tests, docs, and current STR-48 audit output.
- The sibling `/Users/bryanshepherd/strata-football-ui` is an older legacy/build snapshot and should remain reference-only unless explicitly promoted.

Current Git state:
- Branch: `fix/phase2-early-fixes`
- HEAD: `97fe2bd Phase 2 early fixes: dedupe drive prompt, remove early TD flip, ensure transform, dispatch event, harden API errors`
- Remote configured by STR-48:
  - `origin https://github.com/bryanshepherd/strata_football_ui.git`
- Remote `origin` currently has `refs/heads/main` at:
  - `7434b08314b8aaaf6fd97f3779cf5bc53edde0b2`
- Current local branch has no upstream set.

Recommended remote follow-up:
- Push the active work branch when ready:
  - `git push -u origin fix/phase2-early-fixes`
- Do not merge or overwrite `origin/main` until the dirty-tree inventory below is triaged.

## Legacy UI Snapshot

Reference-only local path:
- `/Users/bryanshepherd/strata-football-ui`

Current Git state:
- Branch: `main`
- HEAD: `7434b08 Merge branch 'main' of https://github.com/bryanshepherd-wvsu/strata_football_ui`
- Remote:
  - `origin https://github.com/bryanshepherd-wvsu/strata_football_ui.git`

Notes:
- `git ls-remote` resolves both `https://github.com/bryanshepherd/strata_football_ui.git` and `https://github.com/bryanshepherd-wvsu/strata_football_ui.git` to the same observed `HEAD` commit.
- Treat this folder as historical reference, not the active implementation workspace.

## Canonical Backend/API Repo

Canonical remote:
- `https://github.com/bryanshepherd/strata_football.git`

Observed remote HEAD:
- `33ec8fc3d66fbb8581bc90530dcc9353037db39a`

Canonical local path:
- Not present yet.
- Recommended local clone path: `/Users/bryanshepherd/strata_football`

Current UI workspace backend/API state:
- `/Users/bryanshepherd/strata-football-ui-new` contains PHP API scaffolding and legacy API files, but the active frontend calls endpoints that are not fully present in this workspace.
- Until the backend repo is cloned and compared, treat UI-workspace PHP as reference/scaffold material rather than canonical backend ownership.

Backend ownership decision:
- The long-term canonical backend/API source should live in `bryanshepherd/strata_football`.
- The UI repo should own the React/Vite scoring interface and API client contracts.
- Deployment bundles can include both, but should not be the only source of truth.

## Deployment Target

Frontend/API documentation expects:
- Web namespace: `/strata_football/`
- Development proxy: `/strata_football` -> `http://localhost`
- PHP backend endpoints including:
  - `/strata_football/api/load_game_state.php`
  - `/strata_football/api/submit_play_enhanced.php`
  - `/strata_football/api/get_rosters.php`

Observed local XAMPP folders:
- Present: `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/StrataFootball`
- Not observed as a top-level directory during STR-48: `/Applications/XAMPP/xamppfiles/htdocs/strata_football`

Deployment baseline:
- Do not deploy from the dirty UI workspace until the active backend target is confirmed.
- Before deployment, confirm whether Apache maps `/strata_football/` to a top-level XAMPP folder, a symlink, or the `StrataSportsSuite/StrataFootball` folder.

## Dirty Tree Inventory

`git status --short` is not clean. This is intentionally documented for STR-48 rather than cleaned in this ticket.

Pre-existing modified/deleted/untracked areas include:
- Modified UI source:
  - `src/App.jsx`
  - `src/components/DriveStatusBar.jsx`
  - `src/components/GameLog.jsx`
  - `src/components/PlayInputFlows/PenaltyInputFlow.jsx`
  - `src/components/TeamPlayerStats.jsx`
  - `src/components/YardlineInput.jsx`
  - `src/contexts/FootballGameContext.jsx`
  - `src/index.css`
  - `src/pages/QuickieReport.jsx`
  - `src/utils/apiClient.js`
  - `src/utils/apiDataContract.ts`
- Deleted legacy API files under `api/`:
  - `api/StrataFootballAPI.php`
  - `api/YardLineConverter.php`
  - `api/end_scoring.php`
  - `api/get_games.php`
  - `api/load_game_state.php`
  - `api/start_scoring.php`
  - `api/submit_play.php`
- Untracked new API scaffolding:
  - `api/Http/`
  - `api/Repositories/`
  - `api/Services/`
  - `api/Support/`
  - `api/bootstrap.php`
  - `api/config.php`
  - `api/routes/`
- Untracked current feature/test files:
  - `src/components/DriveSummaryChips.jsx`
  - `src/components/LockStatus.jsx`
  - `src/components/PenaltiesModal.tsx`
  - `src/hooks/useSimpleDriveModel.js`
  - `src/utils/driveModel.ts`
  - `src/utils/penaltyRules.ts`
  - `src/utils/penaltyTable.ts`
  - `src/utils/simpleDriveModel.ts`
  - `tests/multi.user.safety.test.ts`
  - `tests/penalties.rules.test.ts`
  - `tests/phase2.integration.test.ts`
  - `tests/play.log.performance.test.ts`
- Generated/cache/archive noise:
  - `.DS_Store` files
  - `node_modules/.vite/`
  - `src.zip`
  - `api-consistency-bundle.zip`
- STR-48/audit docs:
  - `docs/strata-football-current-state-audit.md`
  - `docs/strata-football-repo-baseline.md`

Do not reset, delete, or normalize this tree without a separate cleanup ticket or explicit user instruction.

## Baseline Decisions

- Active UI path: `/Users/bryanshepherd/strata-football-ui-new`
- Active UI remote: `https://github.com/bryanshepherd/strata_football_ui.git`
- Legacy UI path: `/Users/bryanshepherd/strata-football-ui`
- Backend/API remote: `https://github.com/bryanshepherd/strata_football.git`
- Backend/API local path: not cloned; recommended `/Users/bryanshepherd/strata_football`
- Deployment target: unresolved; documented web namespace is `/strata_football/`, observed XAMPP folder is `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/StrataFootball`
- Scoring behavior changes in STR-48: none

## Next Actions

- Clone or locate `bryanshepherd/strata_football` and compare it against the PHP/API files currently mixed into the UI workspace.
- Decide whether the current `api/` scaffold in the UI workspace should move to the backend repo, stay as shared contract scaffolding, or be removed after migration.
- Add `.gitignore` or cleanup policy for `.DS_Store`, `node_modules/.vite`, archive zips, and generated bundles.
- Triage the dirty tree into separate commits or cleanup tickets before any scoring bug fixes.
- Set upstream for `fix/phase2-early-fixes` only after dirty-tree triage is complete.
