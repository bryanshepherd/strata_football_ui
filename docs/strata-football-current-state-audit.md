# Strata Football Current-State Audit

Date: 2026-06-19

Scope:
- Primary workspace audited: `/Users/bryanshepherd/strata-football-ui-new`
- Sibling legacy/build snapshot checked for repository context: `/Users/bryanshepherd/strata-football-ui`
- Requested repositories: `bryanshepherd/strata_football_ui`, `bryanshepherd/strata_football`
- Local note: `/Users/bryanshepherd/strata-football-ui` has remote `https://github.com/bryanshepherd-wvsu/strata_football_ui.git`. `/Users/bryanshepherd/strata-football-ui-new` has no configured remote. No local clone matching `bryanshepherd/strata_football` was found under `/Users/bryanshepherd` or `/Users/bryanshepherd/Documents`; the current workspace contains PHP API scaffolding plus legacy API files.

Verification performed:
- `npm run test:run` in `/Users/bryanshepherd/strata-football-ui-new`: 7 test files passed, 123 tests passed.
- File inventory and endpoint search across `/Users/bryanshepherd/strata-football-ui-new` and `/Users/bryanshepherd/strata-football-ui`.
- No behavior changes were made.

Working tree warning:
- The audited workspace was already dirty before this report was created, including modified source files, deleted legacy API files, untracked API scaffolding, and generated/cache files. Findings below describe the current filesystem state, not a clean branch baseline.

## 1. App Inventory

Entry points:
- `/Users/bryanshepherd/strata-football-ui-new/src/main.jsx:9-19` mounts React under `React.StrictMode`, `GlobalErrorBoundary`, and `BrowserRouter`.
- `/Users/bryanshepherd/strata-football-ui-new/src/main.jsx:13-16` defines only two routes: `/` -> `App` and `/quickie` -> `QuickieReport`.
- `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:30-49` wraps the main app in `FootballGameProvider`, `GameClockProvider`, and `FootballFlowProvider`.

Primary component tree under `/`:
- `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:34-44` renders `NavigationBar`, `FootballGame`, `FootballFlowModal`, `FootballHotkeyHandler`, and `DebugPanel`.
- `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:281-327` renders the three-column game screen: `TeamPlayerStats`, `Scoreboard`, `DriveSummaryChips`, `EventControls`, `InputAssistant`, `GameLog`, and `RosterModal`.
- `/Users/bryanshepherd/strata-football-ui-new/src/components/FootballFlowModal.jsx:34-49` routes active flow state to `RushInputFlow`, `PassInputFlow`, `PuntInputFlow`, `KickInputFlow`, `PenaltyInputFlow`, or `GameControlInputFlow`.

Context providers:
- `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:100-817` owns game load, submit, roster init, lock-aware submit blocking, clock update helpers, and game-control helpers.
- `/Users/bryanshepherd/strata-football-ui-new/src/contexts/GameClockContext.jsx:13-108` owns local-only game clock and play clock state.
- `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballFlowContext.jsx:110-334` owns modal flow state, keyboard startup shortcuts, and step metadata.

API calls:
- Game load: `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:821-838` calls `load_game_state.php?game_id=...`.
- Submit: `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:849-866` posts `{ game_id, play_data }` to `submit_play_enhanced.php`.
- Roster load: `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:119-133` and `/Users/bryanshepherd/strata-football-ui-new/src/utils/rosterManager.js:60-80` call `get_rosters.php`.
- Stats: `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiClient.js:187-199` calls `stats/get_team_totals.php` and `stats/get_player_totals.php`.
- Drive bar: `/Users/bryanshepherd/strata-football-ui-new/src/hooks/useSimpleDriveModel.js:34-56` calls `get_active_drive.php` and `get_drive_penalties.php`.
- Quickie report: `/Users/bryanshepherd/strata-football-ui-new/src/pages/QuickieReport.jsx:17-23` calls `php/reports/quickie_report.php`.
- Direct ad hoc calls still exist: `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:170-177`, `192-199`; `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/GameControlInputFlow.jsx:305-312`; `/Users/bryanshepherd/strata-football-ui-new/src/hooks/usePlayInputFlow.jsx:118-128`.

Backend/API inventory:
- Current new API route present: `/Users/bryanshepherd/strata-football-ui-new/api/routes/load_game_state.php:11-35`.
- Current repository does not contain `api/submit_play_enhanced.php`, `api/get_rosters.php`, `api/get_penalty_chart.php`, `api/get_active_drive.php`, `api/delete_play.php`, or `api/insert_play.php`; those are documented/called but absent from this workspace file inventory.
- Legacy API files remain under `/Users/bryanshepherd/strata-football-ui-new/legacy/api/`, including `load_game_state.php` and `submit_play.php`.
- Sibling old repo snapshot contains `current_build/v0.0.3.9/strata_football/api/submit_play.php` and related PHP endpoints, but not the new `submit_play_enhanced.php` endpoint in the current workspace.

## 2. Current Feature Status

Game load: Partial and contract-risky.
- Frontend expects `load_game_state.php` to return `gameState`, `gameInfo`, `playLog`, `stats`, `driveChart`, and `gameRules`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:821-838`.
- New PHP route returns `{ success: true, game: $envelope }`; see `/Users/bryanshepherd/strata-football-ui-new/api/routes/load_game_state.php:27-30`. That shape does not match the current frontend transform expectation.
- The legacy endpoint may match better, but the current repository state is split between new routes and legacy API.

Clock: Local UI clock exists, backend persistence is inconsistent.
- Local clock state/tickers exist in `/Users/bryanshepherd/strata-football-ui-new/src/contexts/GameClockContext.jsx:13-108`.
- Backend clock update helper calls `api/update_game_clock.php` at `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:598-611`, but that endpoint is not present in the current workspace.
- `promptForGameTime()` still uses blocking `prompt()` for drive-end time at `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:336-344`.

Rush: Functional flow skeleton with real calculation and roster lookup, but noisy/debug-heavy.
- Rush submits through the shared `handleSubmit` path with `playType`, `primaryPlayerID`, `resultCode`, `endYardLine`, `post_down`, `post_distance`, tackler jersey/IDs, and fumble fields; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/RushInputFlow.jsx:571-609`.
- Rush calculates a pre-play `LineToGain` locally rather than relying on loaded state; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/RushInputFlow.jsx:512-563`.
- Unknown players are allowed as synthetic IDs and then coerced to `null`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/RushInputFlow.jsx:494-500`, `574-592`.

Pass: Functional flow skeleton, but player payloads can be object-shaped and penalty branch bypasses main submit path.
- Normal branch submits via `submitEvent(playData)` at `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PassInputFlow.jsx:397-445`.
- Penalty branch posts directly to `/api/submit_play_enhanced.php`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PassInputFlow.jsx:453-503`.
- Interceptions are flagged as turnovers in local down/distance calculation at `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PassInputFlow.jsx:383-395`.

Punt: Functional flow skeleton, but downed/fair-catch/touchback variants do not consistently set `finalYardLine`.
- Punt return branch submits `endYardLine`/`end_yard_line` from `puntData.finalYardLine`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PuntInputFlow.jsx:287-319`.
- Downed and fair-catch details store `downedSpot` and `fairCatchSpot`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PuntInputFlow.jsx:576-636`. The submit builder still maps `end_yard_line` from `finalYardLine`, so those variants can submit blank end spots.
- Punts are treated as turnovers for calculation at `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PuntInputFlow.jsx:273-285`, and drive rules also end on punt at `/Users/bryanshepherd/strata-football-ui-new/src/utils/driveRules.js:75-79`.

Kick/kickoff: Kickoff return normal branch is partially fixed; other kick variants remain risky.
- Normal kickoff return path guards `finalSpotRef`, maps `endYardLine`, `end_yard_line`, and `post_yard_line`, and passes `is_kickoff`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:503-590`.
- Kickoff downed/fair-catch variants map `kickYardLine` to `finalYardLine`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:1464-1468`, `1509-1513`.
- Touchback, muffed, onside, out-of-bounds, blocked, and field-goal branches need submit-shape verification because `handleKickSubmit` removed validation and applies `end_yard_line = currentFinal` globally; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:503-558`.

Penalties: Multiple overlapping implementations, not yet a single reliable workflow.
- Standalone penalty flow uses `PenaltyModal` and submits a single penalty event through `submitEvent`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PenaltyInputFlow.jsx:39-68`.
- In-play queued penalty modal uses `PenaltyInputModal` and returns `{ heldPlayData, penalties, gameState }`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltyInputModal.jsx:149-163`.
- New typed `PenaltiesModal.tsx` validates `Penalty[]` rigorously but appears not wired into the active flows; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltiesModal.tsx:97-187`.

Game control: UI exists, submit path bypasses standardized client.
- Actions are enumerated at `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/GameControlInputFlow.jsx:8-80`.
- Regular game control posts to `/strata_football/api/football/submit_event.php`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/GameControlInputFlow.jsx:278-328`. That endpoint is not present in the current workspace.
- Roster init calls `initializeRosters()` at `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/GameControlInputFlow.jsx:257-276`.

Roster management: UI/cache exists, endpoint absent in current workspace.
- Roster modal is integrated at `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:106-138` and `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:320-326`.
- Cache/API helper calls `get_rosters.php?gameId=...`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/rosterManager.js:60-80`.

Stats/reports: UI exists, endpoint availability is not proven by repository.
- Team/player stat API helpers exist at `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiClient.js:187-199`.
- `QuickieReport` renders team totals and individual tables at `/Users/bryanshepherd/strata-football-ui-new/src/pages/QuickieReport.jsx:91-202`.
- `/quickie` currently lacks the providers it needs; see P0 finding below.

Drive bar: UI exists but depends on absent endpoints and wrong play source.
- `DriveSummaryChips` renders drive number, start, yards, TOP, rush/pass/total, and penalties; see `/Users/bryanshepherd/strata-football-ui-new/src/components/DriveSummaryChips.jsx:12-45`.
- `useSimpleDriveModel` fetches active drive and drive penalties; see `/Users/bryanshepherd/strata-football-ui-new/src/hooks/useSimpleDriveModel.js:34-56`.
- It reads `gameState?.plays || []`, while `FootballGameContext` stores plays under `recent_plays`; compare `/Users/bryanshepherd/strata-football-ui-new/src/hooks/useSimpleDriveModel.js:41-43` and `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:188-205`.

## 3. Data Contract Mismatches

CamelCase vs snake_case:
- `submitEvent` enriches and then calls `DataTransformer.frontendToBackend(enrichedEvent)` followed by `StandardizedAPIClient.submitPlay(..., bePayload)`; see `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:526-531`.
- `StandardizedAPIClient.submitPlay()` then calls `DataTransformer.transformPlayData(playData)` again; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:849-853`.
- The first transform does not preserve every backend field. For example, `frontendToBackend` omits `sub_type` entirely, while `transformPlayData` can preserve `sub_type` only if it is still present; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:248-337`, `412-493`.
- `frontendToBackend` maps `post_yard_line` from `postYardLine || endYardLine`, ignoring already-present `post_yard_line`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:269-274`.

Home/visitor vs H/V:
- Loaded possession is mapped from backend `H`/`V` to `home`/`visitor` in `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:171-178`.
- Penalty modal emits `HOME`/`VISITOR`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltyModal.jsx:263-283`.
- Typed penalty rules expect `H`/`V`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/penaltyRules.ts:31-37`.
- `DataTransformer.possessionToBackend()` supports `home`/`visitor`/`H`/`V`, but penalty team data has no equivalent normalizer before rules analysis.

Yard-line fields:
- App-level live state uses `yard_line`; see `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:179-182`.
- Flows variously use `finalYardLine`, `endYardLine`, `end_yard_line`, `post_yard_line`, `kickYardLine`, `kicked_to_yard_line`, `downedSpot`, and `fairCatchSpot`.
- `apiDataContract.ts` normalizes API play yardlines as `YardLinePosition`, `EndYardLinePosition`, and `PostYardLinePosition`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:786-788`.
- Current transformations pad yardlines to `H05`/`V39`, while some documentation/tests still accept `50`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:716-745` and `/Users/bryanshepherd/strata-football-ui-new/tests/penalties.rules.test.ts:275-301`.

Play result fields:
- Flow payloads use `resultCode`; transformer maps this to backend `result`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:283-285`, `421-423`.
- API play mapper reads `PlayResult` into `result`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:791-794`.
- `driveRules` uses fields such as `is_good`, `is_blocked`, and `is_recovered_by_kicking_team`; many active flow submit payloads do not populate those exact names.

## 4. Down/Distance Logic

LineToGain:
- Central calculator treats `LineToGain` as authoritative; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:1-10`, `62-83`.
- `FootballGameContext` passes `currentGameState.line_to_gain || null`; see `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:288-295`.
- `FootballGameContext` does not populate `line_to_gain` in `live_state` on load; see `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:160-187`.
- Rush locally reconstructs LineToGain from current spot and distance; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/RushInputFlow.jsx:512-522`. Pass and punt rely on `live_state.line_to_gain`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PassInputFlow.jsx:368-373` and `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PuntInputFlow.jsx:257-264`.

First downs:
- Calculator detects first down by explicit flag, yards gained against LineToGain, or penalty automatic first down; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:208-228`.
- Flow-level `isFirstDown` is mostly tied to `globalResult === 'first_down'`, but UI global results are `TACKLE`, `OUT_OF_BOUNDS`, `FUMBLE`, `END_OF_PLAY`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/RushInputFlow.jsx:551-561` and `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PassInputFlow.jsx:383-393`.

Goal-to-go and red zone:
- Calculator derives goal-to-go from LineToGain and red zone from possession-relative position; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:107-124`.
- If LineToGain is null, goal-to-go is false even near goal line; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:111-116`.

Turnovers, punts, kickoffs, and drive ending:
- Calculator handles touchdowns/safeties, turnovers, and turnover on downs; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:168-249`.
- Kickoffs explicitly return `driveEnds: false` and `driveResult: null`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:152-165`.
- `driveRules` starts new drives on kickoff, turnovers, punts, and possession changes; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/driveRules.js:16-48`.
- `driveRules` ends current drives on touchdown, safety, turnover, punt, failed fourth down, and field-goal attempts; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/driveRules.js:56-94`.
- `FootballGameContext` can override calculator drive decisions with `analyzeDriveTransition`; see `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:394-407`.

## 5. Kickoff Bug Status

Verified improvements:
- Kickoff modal state includes `finalYardLine`, `kickYardLine`, `tackler1`, and `tackler2`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:29-50`.
- Returned kickoff tackle UI writes `finalYardLine` and keeps `finalSpotRef` current; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:1261-1268`.
- Normal `handleKickSubmit()` reads `finalSpotRef`, blocks missing returned kickoff final spot, sets `endYardLine`, `end_yard_line`, `post_yard_line`, and `is_kickoff`, then calls `submitEvent`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:503-590`.
- Down/distance calculator no longer assigns a drive result for kickoffs; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:152-165`.

Remaining risks:
- `DataTransformer.frontendToBackend()` can drop `sub_type`, so downstream code relying on `play_type === 'kick' && sub_type === 'kickoff'` is fragile unless `is_kickoff` survives; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:248-337`.
- Normal kickoff submit sets `kicked_to_yard_line`, but transform allowlists do not consistently preserve all kick-specific fields; compare `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:540-553` and `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:475-487`.
- Penalty kickoff branch bypasses `submitEvent` and posts to `/api/submit_play_enhanced.php`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:600-678`. That path does not benefit from the same context-level kickoff guards or refetch behavior.
- The top-of-file Copilot bug instructions remain in source; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:1-18`.

Conclusion:
- The specific returned-kickoff normal-path bug is likely partially fixed in the UI-to-`submitEvent` path.
- It is not fully closed until endpoint availability, transform preservation, penalty branch behavior, and non-return kickoff variants are tested end-to-end.

## 6. Penalty Workflow

Queued penalties:
- Rush uses shared `usePlayInputFlow` and opens `PenaltyInputModal`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/RushInputFlow.jsx:625-644`.
- Pass/punt/kick each maintain independent `penaltyQueued` state and open `PenaltyInputModal`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PassInputFlow.jsx:435-503`, `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PuntInputFlow.jsx:248-363`, `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:577-678`.
- Shared hook penalty submit posts directly to `/strata_football/api/submit_play_enhanced.php`; see `/Users/bryanshepherd/strata-football-ui-new/src/hooks/usePlayInputFlow.jsx:113-144`.

Accepted/declined/no-play behavior:
- `PenaltyModal` supports accepted, declined, and offsetting choices; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltyModal.jsx:321-374`.
- Accepted penalties require enforcement details; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltyModal.jsx:376-530`.
- `PenaltyInputModal` supports `isDeclined` and `isOffsetting` form flags but submits raw modal-shaped penalties, not typed `Penalty[]`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltyInputModal.jsx:14-24`, `149-169`.
- Typed rule engine correctly analyzes declined-only, offsetting live-ball penalties, automatic first down, loss of down, and enforcement order in unit tests; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/penaltyRules.ts:19-135`, `/Users/bryanshepherd/strata-football-ui-new/tests/penalties.rules.test.ts:25-437`.

Placeholder penalty helpers still exist:
- `DownDistanceCalculator.applyPenaltyEnforcement()` is a placeholder returning the play end position; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:276-283`.
- Legacy export `applyPenaltyToDownDistance()` returns `currentState`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:307-310`.
- `PenaltiesModal.handleApplySuggestions()` is TODO and does not apply suggestions; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltiesModal.tsx:202-206`.

## 7. Debug Cleanup

Console/debug logs:
- Raw `console.log` remains in rendered drive components: `/Users/bryanshepherd/strata-football-ui-new/src/components/DriveSummaryChips.jsx:5-8` and `/Users/bryanshepherd/strata-football-ui-new/src/hooks/useSimpleDriveModel.js:116-119`.
- Context and flows contain extensive `debug.log`/`debug.trace` instrumentation, especially kickoff and rush paths; examples: `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:235-255`, `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:57-98`, `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/RushInputFlow.jsx:44-48`.

Hardcoded IDs/session/user:
- Default game ID `999`: `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:737-779`, `/Users/bryanshepherd/strata-football-ui-new/src/components/DebugPanel.jsx:77-95`, `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayEditModal.jsx:108`.
- Fallback game ID `1000`: `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:529`, `618`; `/Users/bryanshepherd/strata-football-ui-new/src/hooks/useSimpleDriveModel.js:5`; `/Users/bryanshepherd/strata-football-ui-new/src/components/ReportsButton.jsx:14`.
- Hardcoded submit identity: `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:433-436` and `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:456-457`.

Unfinished Copilot/TODO comments:
- Copilot kickoff task block remains in `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:1-18`.
- `PenaltiesModal` contains a TODO for applying suggestions; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltiesModal.tsx:202-206`.
- `GlobalErrorBoundary` has a TODO for external reporting; see `/Users/bryanshepherd/strata-football-ui-new/src/components/GlobalErrorBoundary.jsx:34`.

## 8. Test Gaps

Existing tests:
- `npm run test:run` passed 123 tests across validation, contract transforms, drive rules, penalties rules, phase 2 integration, play log performance, and multi-user safety.
- Current tests cover pure rules and transform helpers but do not mount the full app routes or exercise real PHP endpoints.

Minimum regression suite recommended:
- Route smoke tests:
  - `/` renders with mocked `load_game_state.php`, `get_rosters.php`, stats, active drive, and penalty endpoints.
  - `/quickie` renders under providers or explicitly does not call `useGameState`.
- Submit contract tests:
  - Rush/pass/punt/kick normal branch payloads survive `submitEvent -> frontendToBackend -> transformPlayData`.
  - Kickoff return preserves `is_kickoff`, `sub_type`, `end_yard_line`, `post_yard_line`, `kicked_to_yard_line`, `primary_player_id`, `secondary_player_id`, and tackler IDs.
  - Penalty branches use the same API base and preserve held play data.
- Down/distance tests:
  - First down by yardage with missing and present LineToGain.
  - Goal-to-go at/inside the 10.
  - Red zone from both H and V possession.
  - Turnover on downs, interception, fumble, punt, field goal attempt, kickoff, touchback, fair catch, and onside recovery.
- Penalty tests:
  - Accepted, declined, offsetting, no-play/replay-down, dead-ball after live-ball, AFD, LOD, half-distance, carry-over to try/kickoff.
  - Modal output shape from `PenaltyModal` and `PenaltyInputModal` normalized into typed `Penalty[]`.
- Endpoint contract tests:
  - Repository-level PHP route response shape for `load_game_state.php`.
  - Submit endpoint existence and JSON shape for `submit_play_enhanced.php`.
  - Roster, stats, active-drive, drive-penalties, delete/insert play endpoints.
- Browser-level flow tests:
  - Full returned kickoff submit with mocked network assertions.
  - Punt downed/fair-catch/touchback submit asserts nonblank end yard line.
  - Quickie report provider crash regression.

## 9. Risk-Ranked Findings

### P0

1. `/quickie` route is structurally broken by missing providers.
- Evidence: `/Users/bryanshepherd/strata-football-ui-new/src/main.jsx:13-16` renders `QuickieReport` directly, while `/Users/bryanshepherd/strata-football-ui-new/src/pages/QuickieReport.jsx:14-15` calls `useGameState()` and `useSimpleDriveModel(gameState)`. `useGameState()` throws outside `FootballGameProvider` at `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:819-824`.
- Impact: `/quickie` can crash before report data loads.

2. Current repository state does not contain the main endpoints the frontend calls.
- Evidence: frontend calls `submit_play_enhanced.php`, `get_rosters.php`, `get_active_drive.php`, `get_drive_penalties.php`, `get_penalty_chart.php`, `delete_play.php`, `insert_play.php`, and `football/submit_event.php`; see API inventory above. Current workspace file inventory contains `api/routes/load_game_state.php` and legacy `legacy/api/submit_play.php`, but not those live endpoint files.
- Impact: A clean deploy from this repo cannot satisfy the current frontend without an external backend tree.

3. New `api/routes/load_game_state.php` response shape does not match frontend loader expectations.
- Evidence: route returns `{ success, game }` at `/Users/bryanshepherd/strata-football-ui-new/api/routes/load_game_state.php:27-30`; loader expects `rawData.gameState`, `rawData.gameInfo`, `rawData.playLog`, and related keys at `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:821-838`.
- Impact: If wired to the new route, app load will produce default/missing game state or fail downstream.

### P1

1. Submit payload transforms can drop or reshape fields needed for football logic.
- Evidence: `submitEvent` runs `frontendToBackend` before `submitPlay`, and `submitPlay` runs `transformPlayData`; see `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:526-531` and `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:849-853`.
- Evidence: `frontendToBackend` omits `sub_type` and ignores existing `post_yard_line`; see `/Users/bryanshepherd/strata-football-ui-new/src/utils/apiDataContract.ts:248-337`.
- Impact: Kickoff, punt, field-goal, and penalty-specific backend behavior can silently receive incomplete payloads.

2. Kickoff fix is incomplete outside the normal returned-kickoff branch.
- Evidence: normal path maps final spot and calls `submitEvent`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:503-590`.
- Evidence: penalty path posts directly to `/api/submit_play_enhanced.php`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:600-678`.
- Impact: A returned kickoff without penalty is likely improved, but penalty and variant paths can bypass guards/refetch/transforms.

3. Penalty workflow has multiple incompatible shapes.
- Evidence: `PenaltyModal` emits `{ penalty, team, playerNumber, result, enforcement }`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltyModal.jsx:81-93`.
- Evidence: `PenaltyInputModal` emits `{ heldPlayData, penalties, gameState }`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PenaltyInputModal.jsx:149-163`.
- Evidence: typed rule engine expects `Penalty[]` with `team`, `code`, `enforcedFrom`, `accepted`, etc.; see `/Users/bryanshepherd/strata-football-ui-new/src/types/penalties.ts:1-39` and `/Users/bryanshepherd/strata-football-ui-new/src/utils/penaltyRules.ts:19-135`.
- Impact: Accepted/declined/no-play behavior is not guaranteed across all active flows.

4. Punt and kickoff spot variants can submit blank or wrong end yard lines.
- Evidence: punt downed/fair-catch store `downedSpot`/`fairCatchSpot`, while submit maps `end_yard_line` from `finalYardLine`; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/PuntInputFlow.jsx:287-319`, `576-636`.
- Evidence: kick submit sets `end_yard_line` from `finalSpotRef` globally; see `/Users/bryanshepherd/strata-football-ui-new/src/components/PlayInputFlows/KickInputFlow.jsx:503-558`.

5. Play replacement path references an undefined function.
- Evidence: `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:234-237` calls `setReplacementContext`, but `FootballGame` only destructures `startFlow` from flow context at `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:140-143`.
- Impact: Replacing a play can throw before the replacement flow starts.

### P2

1. Debug logging and blocking browser dialogs remain in scoring paths.
- Evidence: kickoff/rush/context logs and traces listed in Debug Cleanup; blocking `prompt()` at `/Users/bryanshepherd/strata-football-ui-new/src/utils/DownDistanceCalculator.js:336-344`.

2. Hardcoded game IDs and session/user IDs remain.
- Evidence: defaults/fallbacks listed in Debug Cleanup.

3. Drive bar depends on current-play source mismatch.
- Evidence: `FootballGameContext` stores `recent_plays`; `useSimpleDriveModel` reads `gameState?.plays`; see `/Users/bryanshepherd/strata-football-ui-new/src/contexts/FootballGameContext.jsx:188-205` and `/Users/bryanshepherd/strata-football-ui-new/src/hooks/useSimpleDriveModel.js:41-43`.

4. Report and stats surfaces are UI-present but endpoint/current provider readiness is not proven.
- Evidence: `QuickieReport` route/provider issue and stats endpoint inventory above.

### Unknowns

- Whether `/Applications/XAMPP/xamppfiles/htdocs/strata_football` currently contains the enhanced backend endpoints. It was not in the writable workspace and was not audited here.
- Whether `bryanshepherd/strata_football` has a remote-only backend implementation that differs from local files. No local clone was found.
- Whether live database schemas include fields expected by the new transform layer (`post_yard_line`, `line_to_gain`, `drive_ends`, `drive_result`, penalty arrays, kickoff metadata).
- Whether current deployed PHP accepts both `game_id` and `gameId` consistently across all endpoints.

## 10. Recommended Next Milestones

1. Repository alignment milestone:
- Decide which repo owns backend endpoints.
- Bring `submit_play_enhanced.php`, roster, stats, active-drive, drive-penalties, penalty-chart, delete/insert, and game-control endpoint code under version control or update frontend to the actual committed endpoints.
- Add an endpoint inventory test that fails if frontend-referenced endpoints are missing.

2. App load/report stability milestone:
- Fix `/quickie` provider wiring or remove context dependency from `QuickieReport`.
- Align `load_game_state` route response shape with `StandardizedAPIClient.loadGameState()`.

3. Single submit contract milestone:
- Remove double-transform ambiguity.
- Define one canonical submit payload interface for all flows.
- Add tests for rush/pass/punt/kick/kickoff/penalty/game-control payload preservation.

4. Kickoff and special-teams milestone:
- Verify returned, downed, fair-catch, touchback, muffed, onside, out-of-bounds, and penalty-on-kickoff paths.
- Assert no kickoff stores `drive_result = received`.
- Assert new drive starts at the correct post-kick spot.

5. Penalty workflow milestone:
- Choose the active penalty component (`PenaltyModal`, `PenaltyInputModal`, or `PenaltiesModal`) and retire/bridge the others.
- Normalize `HOME`/`VISITOR` to `H`/`V`.
- Replace placeholder penalty enforcement helpers with tested enforcement behavior.

6. Down/distance and drive milestone:
- Make `LineToGain` part of loaded `live_state`.
- Centralize first down/goal-to-go/red-zone/turnover/punt/kickoff logic.
- Add browser or integration tests for drive transitions.

7. Debug and hardcoding cleanup milestone:
- Remove Copilot task comments, raw `console.log`, heavy traces, fallback IDs, and hardcoded session/user placeholders.
- Replace blocking `alert()`/`prompt()` scoring interactions with flow-managed UI.

## Next-Action Checklist

- [ ] Confirm local or remote location for `bryanshepherd/strata_football`.
- [ ] Decide whether current frontend should target legacy `submit_play.php` or new `submit_play_enhanced.php`.
- [ ] Add a route smoke test proving `/quickie` does not crash outside providers.
- [ ] Add a transform test for returned kickoff payload preserving `is_kickoff`, `sub_type`, `end_yard_line`, `post_yard_line`, `kicked_to_yard_line`, returner, and tacklers.
- [ ] Add submit-flow tests for punt downed/fair-catch/touchback end-yard-line behavior.
- [ ] Normalize penalty output into one typed `Penalty[]` shape before `analyzePenalties()`.
- [ ] Replace `DownDistanceCalculator.applyPenaltyEnforcement()` and `applyPenaltyToDownDistance()` placeholders.
- [ ] Wire `line_to_gain` into loaded `live_state`.
- [ ] Remove source-level Copilot instructions and production-visible debug panels/logs from scoring flows.
- [ ] Re-run `npm run test:run`, then browser-smoke `/`, `/quickie`, returned kickoff, and one accepted/declined penalty flow against the real PHP backend.
