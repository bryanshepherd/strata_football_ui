# Football Legacy File Audit

## Purpose

This audit separates clearly inactive Football input-flow artifacts from the new FCQI path without changing app behavior.

New FCQI files remain active and were not moved:

- `src/quick-input/footballIntentSchema.ts`
- `src/quick-input/footballIntentSchema.test.ts`

## Import Audit Summary

Routed app entry:

- `src/main.jsx`

Current routed routes:

- `/` -> `src/pages/FootballScorerShell.jsx`
- `/scorer` -> `src/pages/FootballScorerShell.jsx`
- `/football-layout-preview` -> `src/pages/FootballLayoutPreview.jsx`
- `/reports` -> `src/pages/FootballReportPlaceholder.jsx`
- `/quickie` -> `src/pages/FootballReportPlaceholder.jsx`
- fallback -> `src/pages/FootballScorerShell.jsx`

Important findings:

- `src/App.jsx` is not imported by `src/main.jsx`.
- `src/App.jsx` was later confirmed inactive by `docs/football-app-entrypoint-audit.md` and moved to `src/legacy-unused/app/App.jsx`.
- The old modal/input-flow stack was only referenced by that inactive shell and was moved to `src/legacy-unused/input-flow-stack/`.

## Active Files That Must Stay

Routed shell and preview:

- `src/main.jsx`
- `src/pages/FootballScorerShell.jsx`
- `src/pages/FootballLayoutPreview.jsx`
- `src/pages/FootballReportPlaceholder.jsx`
- `src/components/scorer/ScorerLayoutShell.jsx`
- `src/components/FootballDebugTracePanel.jsx`
- `src/data/footballGameEnvelopeFixtures.js`
- `src/utils/footballDebugTrace.js`
- `src/utils/footballRulesEngine.js`

Tests for active shell/preview/rules:

- `src/pages/FootballScorerShell.test.jsx`
- `src/pages/FootballLayoutPreview.test.jsx`
- `src/components/scorer/ScorerLayoutShell.test.jsx`
- `tests/football.rules.engine.test.js`

New FCQI schema path:

- `src/quick-input/footballIntentSchema.ts`
- `src/quick-input/footballIntentSchema.test.ts`

## Legacy/Unused Files Moved

Moved to `src/legacy-unused/app/`:

- `src/App.jsx`

Moved to `src/legacy-unused/input-flow-stack/contexts/`:

- `src/contexts/FootballFlowContext.jsx`

Moved to `src/legacy-unused/input-flow-stack/hooks/`:

- `src/hooks/usePlayInputFlow.jsx`
- `src/hooks/usePlayerLookup.js`

Moved to `src/legacy-unused/input-flow-stack/components/`:

- `src/components/FootballFlowModal.jsx`
- `src/components/FootballHotkeyHandler.jsx`
- `src/components/EventControls.jsx`
- `src/components/InputAssistant.jsx`
- `src/components/PlayerInput.jsx`
- `src/components/PlayerDisambiguationModal.jsx`
- `src/components/JerseyNumberInput.jsx`
- `src/components/YardlineInput.jsx`
- `src/components/PenaltyInputModal.jsx`
- `src/components/PenaltyModal.jsx`

Moved to `src/legacy-unused/input-flow-stack/components/PlayInputFlows/`:

- `src/components/PlayInputFlows/GameControlInputFlow.jsx`
- `src/components/PlayInputFlows/KickInputFlow.jsx`
- `src/components/PlayInputFlows/PassInputFlow.jsx`
- `src/components/PlayInputFlows/PenaltyInputFlow.jsx`
- `src/components/PlayInputFlows/PlayTypeSelector.jsx`
- `src/components/PlayInputFlows/PuntInputFlow.jsx`
- `src/components/PlayInputFlows/RushInputFlow.jsx`

Moved to `src/legacy-unused/input-flows/`:

- `src/components/PlayInputFlows/DriveStatusBar_Instructions.md`
- `src/components/PlayInputFlows/FlowMapping`
- `src/components/PlayInputFlows/FlowMapping.md`
- `src/components/PlayInputFlows/cookies.txt`

Moved to `src/legacy-unused/components/`:

- `src/components/DriveComponents_Example.jsx`
- `src/components/DriveStatusBar.jsx.bak`
- `src/components/DriveSummary_Test.jsx`
- `src/components/GameLog.jsx.backup`
- `src/components/PlayerInput_backup.jsx`
- `src/components/PlayerInput_new.jsx`

Moved to `src/legacy-unused/test-pages/`:

- `src/test/driveSummary.html`
- `src/test/driveSummaryChips.html`

These files were moved because import/reference checks did not show active imports from routed app code or tests.

## Files Deliberately Left In Place

These broad/shared-looking files were not moved:

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

They were left in the active tree because they either still belong to active routed scorer/report surfaces or are broad utilities/components that should not be moved without a separate import-specific cleanup.

## Files Suspected Legacy But Still Need Verification

None moved in this pass beyond the explicitly confirmed inactive app shell and old modal/input-flow stack.

## Import Updates Made

None.

No moved file was imported by the routed app, active tests, current reports route, current preview route, or `src/quick-input/**`, so no import rewrites were needed.

## Import/Reference Checks

Command:

```bash
rg -n "(import .* from|import\\(|require\\()" src tests
```

Result:

- Confirmed `src/main.jsx` imports routed pages, not `src/App.jsx`.
- Confirmed tests import active shell, preview, rules, validation, and FCQI schema surfaces.

Command:

```bash
rg -n "DriveComponents_Example|DriveSummary_Test|DriveStatusBar_Example|DriveStatusBar\\.jsx\\.bak|GameLog\\.jsx\\.backup|PlayerInput_backup|PlayerInput_new|DriveStatusBar_Instructions|FlowMapping|cookies\\.txt|driveSummary\\.html|driveSummaryChips\\.html" src tests docs
```

Result after move:

- Only self-definitions remained inside `src/legacy-unused/components/DriveComponents_Example.jsx` and `src/legacy-unused/components/DriveSummary_Test.jsx`.
- No active import/reference to the old paths remained.

Command:

```bash
rg -n "(FootballFlowModal|PlayInputFlows|usePlayInputFlow|PlayerInput)" src/main.jsx src/pages src/components src/hooks src/contexts tests
```

Result:

- Confirmed the old modal/input-flow graph is still internally imported:
  - `FootballFlowModal` imports `PlayInputFlows/*`.
  - `PlayInputFlows/*` import `PlayerInput`, `PenaltyInputModal`, and `usePlayInputFlow`.
  - `src/hooks/usePlayInputFlow.jsx` is still used by old flow components.

Final pre-move active-surface reference check:

```bash
rg -n "(\\.\\.?/)?(App|FootballFlowContext|FootballFlowModal|FootballHotkeyHandler|EventControls|InputAssistant|GameControlInputFlow|KickInputFlow|PassInputFlow|PenaltyInputFlow|PlayTypeSelector|PuntInputFlow|RushInputFlow|usePlayInputFlow|PlayerInput|PlayerDisambiguationModal|JerseyNumberInput|YardlineInput|PenaltyInputModal|PenaltyModal|usePlayerLookup)(\\.jsx|\\.js)?" src/main.jsx src/pages tests src/quick-input
```

Result:

- No active imports or references to the files being moved.
- Only false-positive text matches remained:
  - `src/pages/FootballScorerShell.jsx` uses the active slot name `FootballInputAssistantSlot`.
  - `src/pages/FootballLayoutPreview.jsx` uses the active slot name `PreviewInputAssistantSlot`.
  - `tests/penalties.rules.test.ts` contains unrelated penalty wording matches.

Final post-move import check:

```bash
rg -n "from ['\"][^'\"]*(App|FootballFlowContext|FootballFlowModal|FootballHotkeyHandler|EventControls|InputAssistant|GameControlInputFlow|KickInputFlow|PassInputFlow|PenaltyInputFlow|PlayTypeSelector|PuntInputFlow|RushInputFlow|usePlayInputFlow|PlayerInput|PlayerDisambiguationModal|JerseyNumberInput|YardlineInput|PenaltyInputModal|PenaltyModal|usePlayerLookup)" src tests
```

Result:

- Only imports inside `src/legacy-unused/input-flow-stack/**` remained.
- No active routed app, active test, reports route, preview route, or FCQI schema import targets the moved files.

Moved-file destination check:

```bash
find src/legacy-unused/app src/legacy-unused/input-flow-stack -type f | sort
```

Result:

- Confirmed `src/legacy-unused/app/App.jsx`.
- Confirmed all old modal/input-flow stack files under `src/legacy-unused/input-flow-stack/`.

Original-path check:

```bash
find src/components/PlayInputFlows src/hooks src/contexts src/components -maxdepth 2 \( -name 'App.jsx' -o -name 'FootballFlowContext.jsx' -o -name 'FootballFlowModal.jsx' -o -name 'FootballHotkeyHandler.jsx' -o -name 'EventControls.jsx' -o -name 'InputAssistant.jsx' -o -name 'GameControlInputFlow.jsx' -o -name 'KickInputFlow.jsx' -o -name 'PassInputFlow.jsx' -o -name 'PenaltyInputFlow.jsx' -o -name 'PlayTypeSelector.jsx' -o -name 'PuntInputFlow.jsx' -o -name 'RushInputFlow.jsx' -o -name 'usePlayInputFlow.jsx' -o -name 'PlayerInput.jsx' -o -name 'PlayerDisambiguationModal.jsx' -o -name 'JerseyNumberInput.jsx' -o -name 'YardlineInput.jsx' -o -name 'PenaltyInputModal.jsx' -o -name 'PenaltyModal.jsx' -o -name 'usePlayerLookup.js' \) -print
```

Result:

- No original active-tree paths remained for the moved files.

Command:

```bash
find src/legacy-unused -maxdepth 3 -type f | sort
```

Result:

- Confirmed all moved files are now under `src/legacy-unused/`.

## Validation Results

Command:

```bash
npm run test:run
```

Result:

- Passed.
- 12 test files passed.
- 162 tests passed.

Command:

```bash
npm run build
```

Result:

- Passed.
- Vite emitted the existing Browserslist data age warning.
- Build completed successfully.

Command:

```bash
git diff --check
```

Result:

- Failed because the repository already has unrelated dirty files with trailing whitespace.
- Examples include `documentation/04-State-Management.md`, `documentation/README.md`, `src/components/DriveStatusBar.jsx`, `src/components/GameLog.jsx`, `src/components/TeamPlayerStats.jsx`, `src/contexts/FootballGameContext.jsx`, `src/index.css`, `src/utils/apiClient.js`, and `src/utils/apiDataContract.ts`.
- These files were already outside this cleanup scope and were not edited for this task.

Command:

```bash
git diff --check -- docs/football-legacy-file-audit.md src/legacy-unused/app src/legacy-unused/input-flow-stack
```

Result:

- Passed.
- No whitespace errors were introduced by the report or moved legacy app/input-flow files.

Behavior note:

- No route, UI, scoring, envelope, submit, or FCQI schema behavior changed.
