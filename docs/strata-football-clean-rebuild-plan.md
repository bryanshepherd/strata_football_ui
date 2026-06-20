# Strata Football Clean Rebuild Plan

Date: 2026-06-20
Linear: STR-55

## 1. Recommendation

Recommendation: hybrid approach.

StrataFootball should move to a clean rebuild architecture now, but not by discarding all current work. The current app should be frozen as a reference/prototype, while pure football logic, tested rules, and useful scorer workflow ideas are ported deliberately into a new contract-first frontend/backend shape.

Reason:
- The current workspace mixes frontend, PHP API scaffolding, legacy API files, generated artifacts, and deleted endpoint state. STR-48 documents the canonical UI path as `/Users/bryanshepherd/strata-football-ui-new`, but the backend/API repo is still not cloned locally.
- The current frontend calls endpoints that are absent from the UI workspace, including `submit_play_enhanced.php`, `get_rosters.php`, `get_active_drive.php`, `get_drive_penalties.php`, `get_penalty_chart.php`, `delete_play.php`, `insert_play.php`, and `football/submit_event.php`.
- `api/routes/load_game_state.php` returns `{ success, game }`, while the frontend loader expects `gameState`, `gameInfo`, `playLog`, `stats`, `driveChart`, and `gameRules`.
- Existing tests prove that some isolated logic is worth salvaging: `npm run test:run` previously passed 7 test files and 123 tests, including contract transforms, drive rules, penalty rules, validation, and integration-style rule checks.
- Continuing to patch the current app before contracts are stable will likely increase drift. Rebuilding the shell and API contract first gives football a clean baseline while preserving the useful prototype investment.

Decision:
- Build the next StrataFootball implementation as a clean architecture.
- Keep the current app as reference until every MVP scoring path is replaced or ported.
- Do not continue broad feature patching in the current mixed runtime except for explicitly approved stopgap fixes.

## 2. Proposed Architecture

### Repository Ownership

UI repo:
- Canonical remote: `https://github.com/bryanshepherd/strata_football_ui.git`
- Canonical local path: `/Users/bryanshepherd/strata-football-ui-new`
- Ownership: React/Vite scorer UI, browser route shell, scorer components, client-side validation, UI tests, and generated frontend types.
- Should not own canonical PHP endpoint implementations.

Backend/API repo:
- Canonical remote: `https://github.com/bryanshepherd/strata_football.git`
- Recommended local path: `/Users/bryanshepherd/strata_football`
- Ownership: PHP API runtime, database access, canonical game state persistence, submit-event validation, scoring-event write model, reports, stats, roster endpoints, and deployment backend target.
- Next prerequisite: clone or locate this repo and compare it with the PHP scaffolding currently mixed into the UI workspace.

Reference-only material:
- `/Users/bryanshepherd/strata-football-ui` should remain the legacy/build snapshot unless explicitly promoted.
- `legacy/`, build snapshots, old API files, and current UI-workspace PHP scaffolding should be treated as migration references until backend ownership is resolved.

### Shared Contracts And Types

Create a contract-first boundary shared by UI and backend:
- `GameEnvelope`: canonical loaded game state.
- `ScoringEvent`: canonical submitted event.
- `SubmitEventRequest`: `{ gameId, event, clientContext }`.
- `SubmitEventResponse`: `{ success, gameEnvelope, acceptedEvent, warnings, errors }`.
- `RosterEnvelope`: canonical team/player lookup data.
- `ReportEnvelope`: canonical box/report/export payload.

The UI should consume generated or copied contract types from the backend contract package, not infer backend shape from ad hoc transform helpers. If a separate shared package is too heavy initially, place versioned JSON schemas in the backend repo and generate TypeScript types into the UI repo during development.

### Game State Envelope

The clean `GameEnvelope` should include:
- `game`: identity, status, period, scoring rules, teams, venue, scheduled metadata.
- `clock`: period, game clock, play clock, running/stopped state, last update metadata.
- `score`: home/visitor points and scoring breakdown.
- `liveState`: possession, down, distance, yard line, line to gain, goal-to-go, red zone, drive id, next-play context.
- `rosters`: home/visitor players, jersey indexes, inactive/unknown-player handling.
- `plays`: ordered normalized scoring events.
- `drives`: current and completed drive summaries.
- `stats`: computed or cached team/player totals.
- `locks`: active scorer/session lock metadata if multi-user control is required.

Naming rules:
- Use one internal possession vocabulary at the contract boundary: `H` and `V` for persisted/backend ownership, with UI labels mapped separately.
- Use one yard-line representation: canonical spot string such as `H35`, `V20`, or `50`, with helpers for possession-relative math.
- Use one line-to-gain field: `lineToGain` in frontend types and `line_to_gain` only at backend serialization if PHP/database conventions require it.

### Submit Event Shape

All scoring flows should submit one event shape:

```json
{
  "gameId": "999",
  "clientContext": {
    "sessionId": "scorer-session-id",
    "userId": "authenticated-user-id",
    "clientEventId": "uuid",
    "submittedAt": "2026-06-20T00:00:00Z"
  },
  "event": {
    "type": "rush",
    "subtype": null,
    "period": 1,
    "clock": "12:00",
    "possession": "H",
    "preState": {
      "down": 1,
      "distance": 10,
      "yardLine": "H35",
      "lineToGain": "H45"
    },
    "participants": {
      "primary": "player-id",
      "secondary": null,
      "defenders": []
    },
    "result": {
      "code": "tackle",
      "yards": 5,
      "endYardLine": "H40",
      "scoring": null,
      "turnover": null
    },
    "penalties": []
  }
}
```

Rules:
- Every flow submits through the same client API function.
- No flow posts directly to PHP endpoints.
- The backend owns final post-play state calculation and returns the accepted envelope.
- The frontend may preview down/distance locally, but preview is not authoritative.
- Kicks, punts, turnovers, scores, and penalties must use the same top-level event contract with sport-specific payload sections.

### Local And Offline Behavior

Initial MVP should be online-first with guarded optimistic UI:
- The UI may show local previews before submit.
- A play is not authoritative until the backend returns the accepted event and updated envelope.
- If a submit fails, the UI keeps the unsaved event in a retryable draft state.
- Do not build full offline scoring until the envelope contract and conflict rules are stable.

Avoid repeating local/server state drift:
- Do not let refresh mutate local game state.
- Do not maintain separate local-only play histories that can diverge from the server.
- Include `clientEventId` for idempotent retries.

### Deployment Target

Target web namespace remains unresolved:
- Existing documentation expects `/strata_football/`.
- STR-48 observed `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/StrataFootball`.
- No top-level `/Applications/XAMPP/xamppfiles/htdocs/strata_football` folder was observed during the baseline pass.

Clean deployment target should be decided before implementation:
- UI build served from the StrataFootball frontend deployment path.
- PHP API served under `/strata_football/api/` or a documented equivalent.
- Local Vite proxy should map exactly to the deployed API namespace.
- Deployment should never depend on untracked PHP files living only inside the UI repo.

## 3. MVP Scorer Scope

The smallest useful StrataFootball scorer should support one live scorer completing a real game with a trusted game log and report export.

In scope for MVP:
- Load game: fetch canonical `GameEnvelope` by game id.
- Start game: transition scheduled/pre-game state into in-progress state.
- Clock control: period, game clock, play clock, start/stop/manual adjust.
- Rush: runner, yards/end spot, result, tacklers, fumble marker.
- Pass: passer, receiver, complete/incomplete/interception/sack, yards/end spot, touchdown marker.
- Punt: punter, kick spot, result, return/fair catch/downed/touchback, end spot, returner/tacklers.
- Kickoff: kicker, kicked-to spot, returned/touchback/fair catch/downed/onside/out-of-bounds, returner, end spot.
- Basic penalties: accepted, declined, offsetting, dead-ball/live-ball, enforcement spot, yards, automatic first down, loss of down, replay down.
- Scoring plays: touchdown, field goal, PAT kick, two-point try, safety.
- Roster lookup: jersey/name lookup for home and visitor with explicit unknown-player handling.
- Game log: chronological accepted events, edit/delete gated behind backend support.
- Report/export path: basic team totals, individual rushing/passing/receiving/punting/returns, scoring summary, drive summary.

Out of MVP unless explicitly pulled forward:
- Full offline mode.
- Multi-scorer conflict resolution beyond basic lock/idempotency.
- Advanced penalty edge cases such as carry-over to kickoff/try unless the rule engine contract is ready.
- Full redesign polish beyond a stable Strata-style scorer shell.
- Deep admin roster management; MVP can consume rosters from existing backend/admin ownership.

## 4. Keep / Rebuild / Discard Table

| Subsystem | Decision | Evidence | Rebuild guidance |
| --- | --- | --- | --- |
| Down/distance calculator and tests | Port after cleanup | `src/utils/DownDistanceCalculator.js`, `src/utils/driveRules.js`, `tests/drive.rules.test.ts`, and `tests/phase2.integration.test.ts` contain useful football math and tests. Audit found `LineToGain` is not loaded into `live_state` consistently. | Keep concepts and tests, but make backend authoritative and require canonical pre/post state. Remove blocking `prompt()` from rules code. |
| Penalty rule engine and tests | Port after cleanup | `src/utils/penaltyRules.ts`, `src/types/penalties.ts`, `src/data/penaltyTable.json`, and `tests/penalties.rules.test.ts` are useful. Audit found active modals emit incompatible shapes and placeholder helpers still exist. | Port typed penalty model and tests. Rebuild UI workflow around the typed model. Retire placeholder enforcement helpers. |
| Roster/player lookup utilities | Port after cleanup | `src/utils/rosterManager.js`, `src/hooks/usePlayerLookup.js`, `src/components/PlayerInput.jsx`, and roster UI prove useful lookup concepts. Endpoint ownership is missing in current workspace. | Preserve jersey lookup behavior and cache ideas. Rebuild around canonical `RosterEnvelope` from backend. |
| Game clock context | Rebuild | `src/contexts/GameClockContext.jsx` is local-only and `update_game_clock.php` is absent from the current workspace. | Rebuild with backend-persisted clock state and explicit local preview semantics. |
| Play input flow concepts | Port after cleanup | Rush/pass/punt/kick flows cover real scorer prompts and useful branching. Audit found direct endpoint posts, inconsistent payload fields, and variant-specific submit bugs. | Keep the scorer workflow map. Rebuild flow components to emit canonical `ScoringEvent` drafts only. |
| Drive model ideas | Port after cleanup | `src/hooks/useSimpleDriveModel.js`, `src/utils/simpleDriveModel.ts`, `src/utils/driveModel.ts`, and `DriveSummaryChips` show useful drive display concepts. Audit found endpoint dependencies and `plays` vs `recent_plays` mismatch. | Move drive calculation to backend or shared pure engine. UI should render `drives.current` from the envelope. |
| Reports/Quickie report ideas | Port after cleanup | `src/pages/QuickieReport.jsx` has useful report layout ideas. Audit found `/quickie` lacks required providers and report endpoint readiness is unproven. | Rebuild report route against `ReportEnvelope`; avoid provider coupling that can crash route rendering. |
| Existing PHP API scaffolding | Unknown until backend clone | Current UI workspace has `api/Support`, `api/Services`, `api/Repositories`, `api/routes/load_game_state.php`, but backend canonical repo is not cloned. | Compare against `bryanshepherd/strata_football`. Keep only if it belongs in backend and matches target contract. |
| Legacy API/build snapshot | Discard as runtime, keep as reference | `/Users/bryanshepherd/strata-football-ui` and `legacy/` have historical endpoint/build context. | Do not run new scorer from legacy files. Use only to recover missing endpoint behavior. |
| Current Tailwind UI styling | Rebuild | Audit notes older card styling, colored play tiles, debug text, generic gray panels, and `DebugPanel` in the active app shell. | Build a new Strata-style scorer UI shell. Port only workflow ergonomics, not visual styling. |
| API data transformer | Rebuild | `src/utils/apiDataContract.ts` has useful normalization ideas but currently double-transforms submit data and can drop `sub_type`/yard-line fields. | Replace with generated contract mappers and strict request/response schemas. |
| Debug panel/logging | Discard | `DebugPanel`, raw `console.log`, hardcoded game ids, and Copilot task comments are documented in the audit. | Keep no production-visible debug UI in the rebuild. Add dev-only diagnostics behind environment flags. |

## 5. Milestone Plan

### Milestone 1: App Shell And Strata-Style UI Foundation

Goal:
- Create a clean React/Vite app shell for football in the canonical UI repo.

Deliverables:
- Route shell for scorer, report, and not-found/error states.
- Strata-style layout, scoreboard header, compact play-entry workspace, game log column, and drive/status band.
- No production `DebugPanel`, hardcoded game id, blocking browser prompt, or legacy card-heavy styling.
- Mocked `GameEnvelope` fixture that drives the shell without real backend dependency.

Exit criteria:
- Browser smoke can render the scorer shell and report route from fixtures.
- No scoring event behavior is implemented beyond fixture display.

### Milestone 2: Canonical Game State Envelope

Goal:
- Define and validate the football `GameEnvelope`.

Deliverables:
- JSON schema or PHP validator in backend ownership.
- Generated or copied TypeScript types in UI ownership.
- Fixture examples for pre-game, in-progress, halftime, final, red zone, goal-to-go, and possession change states.
- Explicit yard-line and possession vocabulary.

Exit criteria:
- UI renders only from `GameEnvelope`.
- Backend contract tests validate fixture envelopes.

### Milestone 3: API Contract And Backend Skeleton

Goal:
- Establish backend routes before scorer flow work resumes.

Deliverables:
- `GET /strata_football/api/games/:gameId/state` or equivalent load endpoint.
- `POST /strata_football/api/games/:gameId/events` submit endpoint.
- Roster, report, stats, and clock endpoints or explicit sections in the envelope.
- Idempotent `clientEventId` handling.
- Local Vite proxy that matches the documented deployment namespace.

Exit criteria:
- The UI can load a real backend envelope.
- Submit endpoint accepts a no-op/control event in contract tests.

### Milestone 4: Core Down/Distance And Drive Engine

Goal:
- Centralize football state transitions before adding all input flows.

Deliverables:
- Shared or backend-owned engine for first downs, line to gain, goal-to-go, red zone, turnovers, punts, kickoffs, scoring plays, and drive start/end.
- Ported tests from current drive/down-distance coverage.
- Backend returns authoritative post-play `liveState` and `drives`.

Exit criteria:
- Rush-like synthetic events can update down/distance and drive state through backend contract tests.
- UI displays returned post-state without recalculating authority.

### Milestone 5: Rush, Pass, Punt, And Kick Flows

Goal:
- Rebuild scorer flows around canonical event drafts.

Deliverables:
- Rush flow.
- Pass flow.
- Punt flow.
- Kickoff and field-goal flow.
- One shared submit function and one event draft normalizer.
- Network tests asserting event shape for each branch.

Exit criteria:
- Returned kickoff, punt downed/fair catch/touchback, pass interception, rush first down, and field goal attempt all submit canonical payloads.

### Milestone 6: Penalty Engine

Goal:
- Replace overlapping penalty workflows with one typed penalty path.

Deliverables:
- One active penalty modal/workflow.
- Typed `Penalty[]` input.
- Accepted, declined, offsetting, no-play/replay-down, automatic first down, loss of down, dead-ball/live-ball ordering.
- Ported `penaltyRules.ts` tests or backend equivalents.

Exit criteria:
- Penalty-only and penalty-with-play events use the same submit contract.
- Placeholder penalty helpers are gone from active code.

### Milestone 7: Reports, Stats, And Export

Goal:
- Rebuild Quickie/report output on top of canonical backend summaries.

Deliverables:
- `ReportEnvelope`.
- Quickie report route that renders without provider crashes.
- Team totals, player totals, scoring summary, drive summary, and export/print path.

Exit criteria:
- Report route has a browser smoke test and fixture coverage.

### Milestone 8: Regression Tests And Browser Smoke Tests

Goal:
- Protect the scorer before live use.

Deliverables:
- Unit tests for pure rules.
- Contract tests for load and submit envelopes.
- Browser smoke tests for load, start game, rush, pass, punt, kickoff, penalty, game log, and report route.
- Endpoint inventory test to fail when UI-referenced routes are missing.

Exit criteria:
- `npm run test:run` and browser smoke suite pass on the clean rebuild branch.

## 6. Risks

Losing useful current work:
- Risk: A clean rebuild could discard working scorer knowledge embedded in current flows.
- Mitigation: Treat current app as a reference library until every MVP path has been rebuilt. Port tests and workflow maps before deleting old code.

API/backend drift:
- Risk: UI and backend can drift again if endpoint shapes are implied rather than contracted.
- Mitigation: Backend owns schemas, UI consumes generated or copied types, and CI runs contract tests for every frontend-referenced route.

Underestimating football edge cases:
- Risk: Kicks, punts, penalties, goal-to-go, red zone, turnovers, safeties, tries, and drive boundaries are easy to oversimplify.
- Mitigation: Build rule engines before visual polish. Port current rule tests and add fixture-driven edge-case coverage before broad UI work.

Rebuilding UI before contracts are stable:
- Risk: A redesigned UI on unstable contracts repeats the current mismatch in a better-looking shell.
- Mitigation: Milestones 2 and 3 must complete before full rush/pass/punt/kick implementation.

Repeating local/server state mistakes:
- Risk: Local preview, optimistic updates, and refresh behavior can corrupt or hide server truth.
- Mitigation: Backend accepted envelope is authoritative. UI draft events are clearly unsaved until accepted. `clientEventId` makes retries idempotent.

Backend repo uncertainty:
- Risk: `bryanshepherd/strata_football` may contain useful code that changes this plan.
- Mitigation: Clone or locate backend repo before implementation. Re-run salvage review against backend files.

Dirty current UI workspace:
- Risk: The current dirty tree can hide accidental behavior changes or stale generated files.
- Mitigation: Keep STR-55 docs-only. Start rebuild work from a deliberate branch/worktree after dirty tree triage.

## 7. Codex-Ready Next Issues

Suggested next Linear issues after STR-55:

1. `P0: Clone and audit canonical StrataFootball backend repo`
- Scope: clone or locate `bryanshepherd/strata_football`, inventory endpoints, compare against UI-workspace PHP scaffolding, identify salvageable backend code.
- Output: backend audit doc and endpoint ownership decision.

2. `P0: Define StrataFootball GameEnvelope and submit-event contracts`
- Scope: create JSON schemas or PHP validators for `GameEnvelope`, `ScoringEvent`, `SubmitEventRequest`, and `SubmitEventResponse`.
- Output: contract docs, fixtures, and TypeScript type generation/copy plan.

3. `P1: Build clean StrataFootball scorer shell from fixture envelope`
- Scope: create the Strata-style UI shell using fixture data only.
- Output: scorer route, report route placeholder, scoreboard/game-log/drive band layout, browser smoke test.

4. `P1: Build backend load and submit skeleton for football events`
- Scope: implement canonical load and submit routes in backend repo with idempotent event acceptance and fixture-backed persistence if database mapping is not ready.
- Output: backend contract tests and local Vite proxy verification.

5. `P1: Port football down/distance and drive rules into clean engine`
- Scope: port useful calculator/drive tests, remove UI prompts, centralize authoritative state transition.
- Output: tested engine and backend integration contract.

6. `P1: Rebuild rush/pass/punt/kick flows against canonical ScoringEvent`
- Scope: rebuild MVP scoring flows using one submit path.
- Output: payload tests for rush, pass, punt, kickoff, and field goal.

7. `P1: Rebuild football penalty workflow around typed Penalty events`
- Scope: choose one penalty workflow, port rule tests, implement accepted/declined/offsetting/no-play behavior.
- Output: modal/workflow tests and backend contract fixtures.

8. `P2: Rebuild Quickie report and export path on ReportEnvelope`
- Scope: replace provider-dependent Quickie route with canonical report data.
- Output: report route smoke test and export/print path.

## Implementation Guardrails

- Do not implement rebuild behavior in STR-55.
- Do not delete current prototype files until replacement coverage exists.
- Do not patch endpoint drift one-off unless it is required to unblock a contract milestone.
- Keep frontend and backend ownership separate even if local deployment bundles both.
- Prefer fixtures and contract tests before UI flow work.
