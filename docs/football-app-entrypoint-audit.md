# Football App Entrypoint Audit

## Purpose

This audit verifies whether legacy `src/App.jsx` is used outside the current Vite routed app before moving the old modal/input-flow stack.

No files were moved in this audit.

## Current Active Entrypoints

Active development/build entrypoint:

- `index.html`
  - mounts `<div id="root"></div>`
  - loads `/src/main.jsx`

Active React entrypoint:

- `src/main.jsx`
  - mounts `document.getElementById('root')`
  - wraps the app in `React.StrictMode`, `GlobalErrorBoundary`, and `BrowserRouter`
  - routes:
    - `/` -> `FootballScorerShell`
    - `/scorer` -> `FootballScorerShell`
    - `/football-layout-preview` -> `FootballLayoutPreview`
    - `/reports` -> `FootballReportPlaceholder`
    - `/quickie` -> `FootballReportPlaceholder`
    - `*` -> `FootballScorerShell`

Active production static entrypoint:

- `dist/index.html`
  - mounts `<div id="root"></div>`
  - loads `/assets/index-25657742.js`
  - loads `/assets/index-a849a43c.css`

Package scripts:

- `npm run dev` -> `vite`
- `npm run build` -> `vite build`
- `npm run preview` -> `vite preview`
- tests run through `vitest`

Build config:

- `vite.config.js` uses the React plugin and Vite defaults.
- No custom Rollup input is configured.
- With the current `index.html`, Vite uses `/src/main.jsx` as the app module graph root.

## Legacy/PHP/Static Entrypoints

No current PHP/static file in this repository was found mounting a separate React root or loading `src/App.jsx`.

Observed PHP/static findings:

- `index.html` uses `#root` and `/src/main.jsx`.
- `dist/index.html` uses `#root` and the built `/assets/index-25657742.js`.
- No `#react-root` mount was found in current repo files.
- PHP files under `api/`, `legacy/api/`, root PHP files, and `php/` did not show React script/mount integration.

There are stale documentation references that describe `main.jsx -> App.jsx`, but current source and current build output do not match that older architecture.

## Whether `src/App.jsx` Is Used

Current source/build answer: `src/App.jsx` appears unused by the active Vite routed app.

Evidence:

- `src/main.jsx` does not import `src/App.jsx`.
- `index.html` loads `/src/main.jsx`, not `src/App.jsx`.
- `vite.config.js` does not define an alternate entrypoint.
- `package.json` scripts only call Vite/Vitest; no script references `src/App.jsx`.
- Active routed pages and tests import `FootballScorerShell`, `FootballLayoutPreview`, `FootballReportPlaceholder`, and related fixtures/utilities, not `App`.
- Built bundle string checks did not find unique legacy `App.jsx` text such as `Admin Dashboard`, `Loading football game`, `No game state available`, `FootballFlowModal`, or `FootballHotkeyHandler`.
- Built bundle did contain routed-shell strings such as `football-layout-preview`, `Fixture not found`, `Debug Trace`, and `Roster Lookup`.

Documentation-only references to `src/App.jsx` remain in:

- `documentation/00-Repo-Map.md`
- `documentation/01-Architecture.md`
- `documentation/03-APIs-and-Endpoints.md`
- `documentation/11-Code-Health-Audit.md`
- `docs/strata-football-current-state-audit.md`
- `docs/cross-sport-scorer-layout-standard.md`
- `docs/cross-sport-scorer-layout-implementation-plan.md`
- `DRIVE_CHIPS_IMPLEMENTATION.md`

These references are useful history, but they are not active runtime imports.

## Old Modal/Input-Flow Stack

`src/App.jsx` imports the old modal/input-flow path:

- `src/contexts/FootballFlowContext.jsx`
- `src/contexts/GameClockContext.jsx`
- `src/components/FootballFlowModal.jsx`
- `src/components/FootballHotkeyHandler.jsx`
- `src/components/EventControls.jsx`
- `src/components/InputAssistant.jsx`
- `src/components/APIStatus.jsx`
- `src/components/ReportsButton.jsx`
- `src/components/RosterManagement.jsx`
- `src/components/LockStatus.jsx`
- `src/components/Scoreboard.jsx`
- `src/components/TeamPlayerStats.jsx`
- `src/components/GameLog.jsx`

The old modal graph then imports:

- `src/components/PlayInputFlows/GameControlInputFlow.jsx`
- `src/components/PlayInputFlows/KickInputFlow.jsx`
- `src/components/PlayInputFlows/PassInputFlow.jsx`
- `src/components/PlayInputFlows/PenaltyInputFlow.jsx`
- `src/components/PlayInputFlows/PlayTypeSelector.jsx`
- `src/components/PlayInputFlows/PuntInputFlow.jsx`
- `src/components/PlayInputFlows/RushInputFlow.jsx`
- `src/hooks/usePlayInputFlow.jsx`
- `src/components/PlayerInput.jsx`
- `src/components/PlayerDisambiguationModal.jsx`
- `src/components/JerseyNumberInput.jsx`
- `src/components/YardlineInput.jsx`
- `src/components/PenaltyInputModal.jsx`
- `src/components/PenaltyModal.jsx`
- `src/hooks/usePlayerLookup.js`

These files are not part of the current routed `src/main.jsx -> FootballScorerShell` path, but they are still connected to each other through the legacy `src/App.jsx` import graph.

## Files That Would Become Movable If `src/App.jsx` Is Retired

If `src/App.jsx` is moved out of the active `src/` tree, the following files become candidates to move to `src/legacy-unused/` after one final import check:

- `src/App.jsx`
- `src/contexts/FootballFlowContext.jsx`
- `src/components/FootballFlowModal.jsx`
- `src/components/FootballHotkeyHandler.jsx`
- `src/components/EventControls.jsx`
- `src/components/InputAssistant.jsx`
- `src/components/PlayInputFlows/GameControlInputFlow.jsx`
- `src/components/PlayInputFlows/KickInputFlow.jsx`
- `src/components/PlayInputFlows/PassInputFlow.jsx`
- `src/components/PlayInputFlows/PenaltyInputFlow.jsx`
- `src/components/PlayInputFlows/PlayTypeSelector.jsx`
- `src/components/PlayInputFlows/PuntInputFlow.jsx`
- `src/components/PlayInputFlows/RushInputFlow.jsx`
- `src/hooks/usePlayInputFlow.jsx`
- `src/components/PlayerInput.jsx`
- `src/components/PlayerDisambiguationModal.jsx`
- `src/components/JerseyNumberInput.jsx`
- `src/components/YardlineInput.jsx`
- `src/components/PenaltyInputModal.jsx`
- `src/components/PenaltyModal.jsx`
- `src/hooks/usePlayerLookup.js`

Additional App-only candidates may also become movable, but they should be handled more conservatively because some are broadly named and may be useful outside input flows:

- `src/components/APIStatus.jsx`
- `src/components/ReportsButton.jsx`
- `src/components/RosterManagement.jsx`
- `src/components/LockStatus.jsx`
- `src/components/Scoreboard.jsx`
- `src/components/TeamPlayerStats.jsx`
- `src/components/GameLog.jsx`
- `src/components/DriveSummaryChips.jsx`
- `src/hooks/useSimpleDriveModel.js`
- `src/utils/rosterManager.js`
- `src/utils/playerManager.js`

Do not move these broader components until a final import check confirms they are not needed by current routed pages, tests, reports, or future preview work.

## Risks

- Stale documentation still says `main.jsx -> App.jsx`; moving `App.jsx` without documenting the current routed architecture may confuse future agents.
- The repo has legacy PHP/API files, but no current PHP React mount was found. A deployment outside this repository could still serve an older bundle or have external integration expectations not visible here.
- `dist/` is tracked/dirty in this worktree. A deployed static bundle may not match source unless deployment is explicitly verified.
- Some old components are not currently routed but may contain useful UI behavior or styling references.
- `src/pages/QuickieReport.jsx` still exists and imports game context, but current `src/main.jsx` routes `/quickie` to `FootballReportPlaceholder`, not `QuickieReport`.

## Recommendation

`src/App.jsx` can be treated as legacy/inactive in this repository's current Vite routed app.

Recommended next step:

1. Move `src/App.jsx` to `src/legacy-unused/app/App.jsx`.
2. Move the old modal/input-flow stack listed above to `src/legacy-unused/input-flow-stack/`.
3. Leave broader shared-looking components in place unless a final import check proves they are App-only and no longer useful.
4. Update `docs/football-legacy-file-audit.md` after the move.
5. Run:
   - `npm run test:run`
   - `npm run build`
   - scoped `git diff --check` for moved files and docs

Do not delete these files yet. Move only, preserve history, and keep FCQI files under `src/quick-input/`.

## Commands And Results

Command:

```bash
sed -n '1,200p' index.html
```

Result:

- `index.html` mounts `#root`.
- `index.html` loads `/src/main.jsx`.

Command:

```bash
sed -n '1,220p' package.json
```

Result:

- Package scripts call `vite`, `vite build`, `vite preview`, and `vitest`.
- No package script references `src/App.jsx`.

Command:

```bash
sed -n '1,220p' vite.config.js
```

Result:

- Vite React plugin is configured.
- No alternate entrypoint or custom Rollup input is configured.

Command:

```bash
rg -n "src/App\\.jsx|['\\\"]\\./App|['\\\"]\\.\\/App|import App|<App\\b|App\\(|App\\.|main\\.jsx|ReactDOM\\.createRoot|createRoot\\(|#root|id=['\\\"]root|#react-root|id=['\\\"]react-root|dist/assets|/assets/index-|index-[A-Za-z0-9_-]+\\.(js|css)" -g '!node_modules/**' -g '!package-lock.json' -g '!dist/assets/**' .
```

Result:

- Found `src/App.jsx` self-export.
- Found `src/main.jsx` mounting `#root`.
- Found `index.html` and `dist/index.html` mounting `#root`.
- Found stale documentation references to `App.jsx`.
- Found no active code import of `src/App.jsx`.
- Found no `#react-root`.

Command:

```bash
rg -n "App\\.jsx|FootballFlowModal|FootballHotkeyHandler|FootballGameProvider|FootballScorerShell|FootballLayoutPreview|football-layout-preview|/assets/index-|#react-root|react-root|#root|id=['\\\"]root|src/main\\.jsx|dist/assets" dist index.html public api legacy php *.php *.md documentation docs -g '!dist/assets/*.map'
```

Result:

- Found `index.html` and `dist/index.html` root/static asset references.
- Found docs references to old and new architecture.
- Found no PHP/static React mount outside `index.html` and `dist/index.html`.

Command:

```bash
rg -n "<script|<div id=|react-root|root|assets/index|main\\.jsx|vite" AdminDashboardCompatibility.php NORMALIZED_API_LAYER.php YardLineConverter.php api legacy php public index.html dist/index.html -g '!node_modules/**'
```

Result:

- Found only `index.html` and `dist/index.html` React mount/script references.
- PHP files did not expose a React mount or script include.

Command:

```bash
node -e "const fs=require('fs'); const p='dist/assets/index-25657742.js'; const s=fs.existsSync(p)?fs.readFileSync(p,'utf8'):''; for (const q of ['Admin Dashboard','Loading football game','No game state available','FootballFlowModal','FootballHotkeyHandler','Play Entry','Debug Trace','football-layout-preview','Fixture not found','Roster Lookup']) console.log(q+': '+s.includes(q));"
```

Result:

- `Admin Dashboard: false`
- `Loading football game: false`
- `No game state available: false`
- `FootballFlowModal: false`
- `FootballHotkeyHandler: false`
- `Play Entry: true`
- `Debug Trace: true`
- `football-layout-preview: true`
- `Fixture not found: true`
- `Roster Lookup: true`

Interpretation:

- Current built bundle includes routed shell strings.
- Current built bundle does not include the checked unique legacy `App.jsx` strings.
