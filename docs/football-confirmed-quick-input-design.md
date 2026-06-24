# Football Confirmed Quick Input Design

## Proposed System Name

**Football Confirmed Quick Input**, abbreviated **FCQI**.

The name is intentionally explicit: this is a fast input system, but not an auto-submit system. It borrows Basketball's intent-flow ergonomics while adding football-specific confirmation, roster validation, duplicate jersey handling, and penalty attachment before final submission.

## Current Audit Summary

The current Football UI has several useful building blocks, but none should be treated as the final FCQI architecture as-is.

- `src/contexts/FootballFlowContext.jsx` starts modal-driven play flows from hotkeys/buttons and defines broad flow steps for rush, pass, punt, kick, penalty, and game control.
- `src/hooks/usePlayInputFlow.jsx` handles Enter, Escape, and penalty toggling for existing flow components, but its `handleSubmit` path can call `submitEvent` directly.
- `src/components/PlayerInput.jsx` can validate a jersey against a target roster, but duplicate resolution currently uses `prompt(...)`, which is not acceptable for FCQI.
- `src/components/PlayerDisambiguationModal.jsx` already contains a visual duplicate-player modal and position-aware recommended-player behavior.
- `src/utils/positionPriority.js` has position-priority helpers that should be reused or replaced centrally, not duplicated inside each flow.
- Existing play flow files under `src/components/PlayInputFlows/` already contain sport-specific input details and penalty hooks, but they are component-heavy and not a compact confirmed quick-input state machine.
- Basketball's flow model is useful for hotkey-started intent capture, modal prompts, and flow-specific keyboard handling, but football needs an explicit pre-submit review state.

## Non-Goals

- Do not submit a play automatically after enough tokens are collected.
- Do not change scoring, down/distance, drive, envelope, or event-ingestion logic.
- Do not invent a duplicate stat or rule engine.
- Do not silently create unknown players when a required roster validation fails.
- Do not hide duplicate jersey ambiguity just because a smart default exists.

## Core Principle

Every completed football quick-input flow must produce a **draft event**, not a submitted event.

The draft event becomes eligible for submission only after:

1. Required input tokens are complete.
2. Every player token resolves to a roster player.
3. Every duplicate jersey decision is explicitly confirmed.
4. The operator reviews a human-readable play summary.
5. Optional penalties are added, edited, or skipped.
6. The operator presses a final confirm action.

## Operator Team Alias Layer

FCQI should eventually accept operator-friendly team identifiers while keeping canonical internal team values.

Reference: `docs/football-operator-team-aliases.md`.

Core boundary:

- Operator-facing UI may accept aliases such as team abbreviations, first-letter shortcuts, or configured spot prefixes.
- FCQI must normalize those aliases before storing draft intent data.
- Internal canonical teams remain `H` and `V`.
- Canonical spots remain `H32`, `V12`, `50`, or other schema-approved spot values.
- FPSG, the Event Builder, projection, stats, envelope, and backend contracts should continue reading canonical values only.

Example:

```text
S32 -> H32
T12 -> V12
```

Alias normalization should apply anywhere FCQI collects a team token, including yardlines, penalty team, fumble recovery team, kick/punt receiving team, possession changes, timeouts, challenges, game control, and future correction flows.

## Canonical FCQI Result-Code Model

FCQI uses compact, Basketball-style result-code choices during modal flows. These result codes are operator input shortcuts. They are not necessarily the same values as final envelope `result.code` values.

General rules:

- Result codes are scoped to the current prompt.
- FCQI maps operator result codes into canonical `FootballDraftIntent` fields before FPSG or the Event Builder read the draft.
- Nested result codes are context-specific.
- The same key can mean different things in different prompt scopes.
- Example: `C` means Complete at the primary Pass result step, but `C` means Lateral in the Complete result step.
- `.` means End of Play and must not be renamed or replaced with another shortcut.
- If a chosen result needs a fumble, lateral, or return continuation that is not implemented yet, FCQI must block safely with a clear not-implemented message and must not build an incomplete event.
- Lateral is a shared live-ball continuation layer across rushes, completed passes, fumble returns, interception returns, kickoff returns, punt returns, field goal returns, and other live-ball returns. It is not a pass-specific branch. Stat allocation rules live in `docs/football-lateral-stat-allocation.md`.
- Never interpret `T` or `C` without `inputScope`. `terminal.result:T` means Tackle, while `kick.receiveResult:T` means Touchback. `terminal.result:C` means Lateral, while `kick.receiveResult:C` means Fair Catch.

### Shared Terminal Result Codes

Terminal result codes are shared FCQI result codes that end a live-ball offensive play or a live return continuation.

Base terminal result codes:

| Code | Meaning |
| --- | --- |
| `T` | Tackle |
| `O` | Out of Bounds |
| `F` | Fumble |
| `C` | Lateral |
| `.` | End of Play |

Rules:

- Every offensive play should eventually resolve to one terminal result code.
- Rush uses terminal result codes directly.
- Complete Pass uses terminal result codes after receiver and catch detail.
- Shared Return Flow uses terminal result codes after returner and from-spot detail.
- `C` means Lateral in terminal-result context.
- `.` means End of Play and must not be renamed.
- `F` starts fumble flow.
- `C` starts lateral flow.
- If fumble or lateral continuation is not fully implemented, block safely and do not build incomplete events.

Suggested metadata examples:

```ts
{ inputScope: 'terminal.result', code: 'T', meaning: 'Tackle' }
{ inputScope: 'terminal.result', code: 'C', meaning: 'Lateral' }
{ inputScope: 'kick.receiveResult', code: 'T', meaning: 'Touchback' }
{ inputScope: 'kick.receiveResult', code: 'C', meaning: 'Fair Catch' }
```

Future implementation should prefer shared helpers such as `src/quick-input/terminalResultCodes.ts` and a shared terminal-result branch inside the FCQI machine.

### Rush Result Codes

Rush flow:

```text
Rusher -> Result -> Resolve result -> To Spot -> Summary
```

Rush result codes:

| Code | Meaning |
| --- | --- |
| `T` | Tackle |
| `O` | Out of Bounds |
| `F` | Fumble |
| `C` | Lateral |
| `.` | End of Play |

#### `T` Tackle

- Requires `tackleA`.
- Allows optional `tackleB`.
- Requires `toSpot`.
- Summary includes tackler(s).

#### `O` Out Of Bounds

- Allows optional `tackleA`.
- Allows optional `tackleB`.
- Requires `toSpot`.
- Summary includes out-of-bounds wording.
- Tacklers, if entered, are included.

#### `F` Fumble

Requires fumble detail flow:

1. `forcedBy`
2. `recoverTeam`
3. `recoverPlayer`
4. `recoverSpot`
5. `returned` boolean

Rules:

- If `returned = false`, end the play at the recovery spot.
- If `returned = true`, start the shared return flow.
- If fumble continuation is not complete, do not build an event.

#### `C` Lateral

- Starts the shared lateral flow.
- If lateral support is not implemented, block safely and do not build incomplete events.

#### `.` End Of Play

- Skips tacklers.
- Requires `toSpot`.
- Summary has no tackled-by text.
- Map safely into canonical intent/result fields while preserving the source operator result where useful.

### Pass Primary Result Codes

Pass primary flow:

```text
Passer -> Primary Result -> Resolve result -> Summary
```

Primary Pass result codes:

| Code | Meaning |
| --- | --- |
| `C` | Complete |
| `I` | Incomplete |
| `S` | Sack |
| `F` | Sack Fumble |
| `R` | Rush Conversion |
| `X` | Intercepted |

#### `C` Complete

Prompt sequence:

1. Receiver jersey, required.
2. Caught At yardline, optional.
3. Complete result code, required.
4. End Yardline, required.

Complete result codes:

| Code | Meaning |
| --- | --- |
| `T` | Tackle |
| `O` | Out of Bounds |
| `F` | Fumble |
| `C` | Lateral |
| `.` | End of Play |

Important: inside the Complete result-code step, `C` means Lateral, not Complete.

Behavior:

- `T`, `O`, and `.` finish the play normally.
- `F` starts the fumble flow after the end yardline is entered.
- `C` starts the lateral flow after the end yardline is entered.
- Preserve passer, receiver, caught-at yardline, complete result code, and end yardline in the draft intent.

#### `I` Incomplete

Prompt sequence:

1. Intended For jersey, required.
2. Yardline, optional.
3. Broken Up?, optional.
   - If yes, collect exactly one defender jersey.
4. Hurried?, optional.
   - If yes, collect up to three defender jerseys.
5. Summary.

#### `X` Intercepted

Prompt sequence:

1. Intended For jersey, required.
2. Yardline, optional.
3. Broken Up?, optional.
   - If yes, collect exactly one defender jersey.
4. Hurried?, optional.
   - If yes, collect up to three defender jerseys.
5. Start the shared interception return flow.

#### `S` Sack

Prompt sequence:

1. Sacked By jersey, required.
   - Allow one or two defenders.
2. Sack yardline, required.
3. Summary.

#### `F` Sack Fumble

Prompt sequence:

1. Sacked By jersey, required.
   - Allow one or two defenders.
2. Sack yardline, required.
3. Start fumble flow using the sack yardline as the fumble spot.

#### `R` Rush Conversion

Behavior:

- Stop the pass flow.
- Transform into FCQI Rush flow.
- Use the resolved passer as the default rusher.
- Preserve down, distance, clock, possession, and starting yardline.
- Do not submit or build a pass event.
- Do not re-prompt for rusher unless the operator edits it.

### Kick Receive Result Codes

Kick receive result codes are scoped to the moment a kickoff or punt first arrives. They are not generic terminal result codes and should not be forced through Shared Return Flow unless the receive result is `R` Return.

Applicable to:

- Kickoff receiving
- Punt receiving

Kick receive result codes:

| Code | Meaning |
| --- | --- |
| `R` | Return |
| `T` | Touchback |
| `C` | Fair Catch |
| `O` | Out of Bounds |
| `M` | Muffed |
| `D` | Downed |

#### `R` Return

Flow:

1. Returner.
2. Result = Return.
3. Start Shared Return Flow.

#### `T` Touchback

Flow:

1. Kick received context.
2. Result = Touchback.
3. Play ends.

No returner is required unless future rules/context specifically require one. The final spot comes from rules/settings or operator confirmation.

#### `C` Fair Catch

Flow:

1. Returner.
2. Result = Fair Catch.
3. Play ends.

No return yards are created. Do not collect a return terminal result code.

#### `D` Downed

Flow:

1. Downing player.
2. Result = Downed.
3. Play ends.

No return flow starts.

#### `M` Muffed

Flow:

1. Returner.
2. Result = Muffed.
3. Recovery details.
4. Return continuation if applicable.

Muffed is not automatically terminal.

#### `O` Out Of Bounds

Out Of Bounds is a kick result. It is not a return terminal result. The exact flow depends on kick family and rules/settings, but it should end with a kick dead-ball spot rather than Shared Return Flow.

Future implementation should prefer a `KickReceiveFlow` that branches to `SharedReturnFlow` only for `R` Return.

### Shared Return Flow

Return flow is shared by:

- fumble return
- interception return
- field goal return
- kickoff return after Kick Receive `R`
- punt return after Kick Receive `R`
- PAT/try return

Fields:

- `type`: `Fumble | Interception | Field Goal | Kickoff | Punt | Try`
- `returner`
- `fromSpot`
- terminal result
- terminal-result details
- `toSpot` / final spot

Return terminal result behavior:

- `T` Tackle: at minimum support one tackler and optional second tackler where applicable.
- `O` Out of Bounds: tacklers optional, out-of-bounds wording.
- `F` Fumble: starts fumble continuation.
- `C` Lateral: starts lateral continuation.
- `.` End of Play: no tackler.

Returned fumbles can recurse into another fumble/return flow only when that continuation is fully implemented. Otherwise FCQI must block safely.

Future implementation should prefer shared helper modules such as `src/quick-input/returnFlowModel.ts` and `src/quick-input/returnFlowMachine.ts`, or a shared return branch inside `footballConfirmedQuickInputMachine.ts`.

### Shared Lateral Flow

Lateral flow is shared by any live-ball play family or return continuation. It may begin from Rush `C`, Complete Pass nested `C`, Return `C`, or another live-ball continuation that allows a lateral.

Lateral segment fields:

- `lateralFromPlayer`
- `lateralToPlayer`
- `lateralFromSpot`
- `lateralToSpot`
- `continuationType`: `rush`, `receiving`, `fumbleReturn`, `interceptionReturn`, `kickReturn`, `puntReturn`, `fieldGoalReturn`, or `misc`
- `continuationResult`
- `finalSpot` or the next lateral segment

If lateral support is not implemented yet:

- block safely
- show a clear not-implemented message
- do not build incomplete events

FCQI should store participants and spots, not official stat allocations. The projection/stat layer derives original play or return yards, lateral miscellaneous yards, and continuation-family yards using `docs/football-lateral-stat-allocation.md`.

Allocation boundary:

- The original play or return family owns the first advancement segment.
- Only `lateralFromSpot -> lateralToSpot` is miscellaneous yards.
- The lateral receiver owns advancement after `lateralToSpot` in the continuation stat family.
- Receiving a lateral does not create a new attempt.
- All allocated segments must add back to the total play gain or return gain.

### Yardage Rule

FCQI should not prompt for yards on normal scrimmage plays.

Yardage is derived from:

- start spot
- end spot
- possession/action team

Exceptions may exist only when the football action cannot be derived from spots. Any exception must be explicitly documented in this design and in the intent schema.

### Result-Code Validation Rules

- Rush result code must be one of `T`, `O`, `F`, `C`, `.`.
- Primary Pass result code must be one of `C`, `I`, `S`, `F`, `R`, `X`.
- Complete result code must be one of `T`, `O`, `F`, `C`, `.`.
- `T` tackle requires at least one tackler.
- `O` allows zero tacklers.
- `.` skips tacklers.
- Broken up allows exactly one defender.
- Hurried allows up to three defenders.
- Sack and sack fumble require one or two defenders.
- Fumble, lateral, and return flows must block safely if not fully implemented.
- Terminal result code must be interpreted by scope.
- Never interpret `C` without `inputScope`.
- Never interpret `T` without `inputScope`.
- Kick receive result code must be one of `R`, `T`, `C`, `O`, `M`, `D`.
- Kick receive `T` Touchback, `C` Fair Catch, and `D` Downed are terminal receive results and do not continue into Shared Return Flow.
- Kick receive `R` Return starts Shared Return Flow.
- Return flow must preserve return type because stats differ by return family.
- Lateral from a return must preserve continuation type for stat allocation.
- `Shift+E` queued penalty marker must be resolved before final confirmation.

## Flow Lifecycle

1. **Start**
   - User presses a hotkey or play button, for example `R` for rush.
   - FCQI creates a new draft session with `flowType`, `startedAt`, `gameId`, possession, down/distance, spot, and active roster snapshot metadata.

2. **Prompt**
   - UI prompts for the next token, such as rusher jersey, tackler jersey, end spot, result code, returner jersey, or yardage.
   - Numeric entry is buffered locally.

3. **Commit Token**
   - Pressing Enter commits only the current token.
   - Enter does not submit the play.
   - After commit, the state machine validates the token and either accepts it, opens disambiguation, shows an error, or advances to the next prompt.

4. **Roster Resolution**
   - Jersey tokens are resolved against the active roster and current action context.
   - Zero matches blocks progress.
   - One match resolves immediately.
   - Multiple matches opens the duplicate-player modal with a recommended default preselected.

5. **Draft Completion**
   - When all required tokens are collected, FCQI builds a normalized draft event payload.
   - The draft is not sent to the backend.

6. **Summary Review**
   - User sees a human-readable summary such as:
     - `HOM #22 Jordan Smith rush for 7 yards to H32. Tackled by VIS #44 Caleb Moss.`
   - Summary includes down/distance, spot, possession, result, selected players, and any incomplete warnings.

7. **Penalty Attachment**
   - User can add one or more penalties before final confirmation.
   - Penalties are attached to the draft event, not submitted independently.

8. **Final Confirm**
   - Only the explicit confirm action calls the existing submit pathway.
   - Cancel discards the draft.
   - Edit returns to the relevant step without losing already confirmed tokens.

## State Machine

Recommended FCQI states:

| State | Purpose | Allowed next states |
| --- | --- | --- |
| `idle` | No active quick-input draft | `flow.starting` |
| `flow.starting` | Resolve play type and initial context | `token.awaiting`, `cancelled` |
| `token.awaiting` | Waiting for current token input | `token.committing`, `cancelled` |
| `token.committing` | Enter pressed; parse current input token | `token.validating`, `token.error` |
| `token.validating` | Validate type, range, roster lookup, field spot, etc. | `token.accepted`, `jersey.disambiguating`, `token.error` |
| `jersey.disambiguating` | Duplicate jersey modal open | `token.accepted`, `token.awaiting`, `cancelled` |
| `token.accepted` | Token is normalized and stored in draft | `token.awaiting`, `draft.ready` |
| `token.error` | Token rejected with focused feedback | `token.awaiting`, `cancelled` |
| `draft.ready` | Required tokens are complete | `summary.reviewing`, `token.awaiting` |
| `summary.reviewing` | Human-readable summary shown | `penalty.editing`, `submitting.confirmed`, `token.awaiting`, `cancelled` |
| `penalty.editing` | Add/edit/remove penalties on the draft | `summary.reviewing`, `cancelled` |
| `submitting.confirmed` | User explicitly confirmed final submit | `submitted`, `submit.error` |
| `submit.error` | Submit failed; draft remains editable | `summary.reviewing`, `cancelled` |
| `submitted` | Existing submit pathway accepted the play | `idle` |
| `cancelled` | Draft discarded | `idle` |

Important behavior:

- `Enter` moves `token.awaiting -> token.committing`.
- `Enter` in `summary.reviewing` should not submit unless the confirm button has focus or the UI explicitly says Enter confirms the summary.
- `Escape` closes the active modal or cancels the draft only after confirmation if meaningful draft data exists.

## Jersey Validation Rules

1. Jersey input accepts only numeric jersey tokens unless the roster model later defines non-numeric game-specific identifiers.
2. Valid jersey number range should reuse existing `validateJerseyNumber` behavior from `src/utils/validation.js`.
3. Lookup must use the active game roster snapshot, not stale global roster data.
4. Lookup must be team-scoped by action context:
   - Offensive actors use the possession/offense roster.
   - Defensive actors use the non-possession/defense roster.
   - Special teams actors use the relevant kicking or receiving team roster, depending on the play phase.
5. Zero matches:
   - Block progress.
   - Show `No active [team] player found for #[jersey]`.
   - Offer only explicit recovery actions: edit jersey, switch team if the action allows it, or cancel.
6. One match:
   - Resolve automatically and store the full player identity in the draft.
7. Multiple matches:
   - Always open the duplicate-player modal.
   - The modal may preselect a default, but must not bypass operator confirmation.
8. Resolved player draft data should include:
   - `playerId`
   - `team`
   - `jersey`
   - display name
   - offensive/defensive/special teams positions where available
   - `resolutionSource`: `single-match` or `duplicate-confirmed`

## Duplicate Jersey Resolution Rules

The duplicate-player modal should replace prompt-based selection.

Modal requirements:

- Show all matching players for the committed jersey.
- Show name, jersey, team, and all available position fields.
- Preselect the context-derived default.
- Label the default as `Recommended`, not `Auto-selected`.
- Allow keyboard and pointer selection of any matching player.
- Confirming the modal commits that specific player to the draft token.
- Cancelling returns to the jersey input token without committing a player.

Duplicate examples:

| Context | Matching players | Preselected default |
| --- | --- | --- |
| Rush by `#3` | Jones RB, Smith OLB, Davis PR | Jones RB |
| INT return by `#3` | Jones RB, Smith OLB, Davis PR | Smith OLB |
| Punt return by `#3` | Jones RB, Smith OLB, Davis PR | Davis PR |

The modal still appears in all three cases.

## Position-Priority Defaulting Rules

Position priority should be centralized in one helper, likely near `src/utils/positionPriority.js`, instead of duplicated inside each flow or modal.

Recommended API:

```js
chooseDefaultPlayerForAction(matches, {
  actionRole: 'offense' | 'defense' | 'specialTeams',
  playType,
  subType,
  possession,
  team,
})
```

Defaulting categories:

| Action context | Prefer | Examples |
| --- | --- | --- |
| `offense` | offensive position fields or offensive priority score | rush, passer, receiver, sack victim |
| `defense` | defensive position fields or defensive priority score | tackler, interceptor, forced fumble, defensive recovery |
| `specialTeams` | special teams position fields or special teams priority score | punter, kicker, punt returner, kick returner, long snapper |

Recommended position ordering:

- Offensive skill: `RB`, `TB`, `HB`, `FB`, `QB`, `WR`, `TE`
- Offensive line: `LT`, `LG`, `C`, `RG`, `RT`, `OL`, `OT`, `OG`
- Defensive front/linebacker: `DE`, `DT`, `NT`, `DL`, `MLB`, `OLB`, `ILB`, `LB`
- Defensive secondary: `CB`, `DB`, `FS`, `SS`, `S`
- Special teams: `PR`, `KR`, `K`, `P`, `LS`

When multiple players tie:

1. Prefer exact action role.
2. Prefer more specific position over generic side.
3. Preserve roster order as the final deterministic tie-breaker.

## Token Collection Examples

### Rush

Required tokens:

- rusher jersey
- result type
- final spot

Optional tokens:

- tackler 1 jersey
- tackler 2 jersey
- forced fumble / recovery details
- penalties

Flow:

1. User presses `R`.
2. Prompt: `Rusher #`.
3. User types `3`, presses Enter.
4. Roster lookup finds duplicate `#3`.
5. Modal opens with offensive player preselected.
6. User confirms or chooses another player.
7. Prompt advances through result and spot.
8. FCQI derives yardage from the start spot, final spot, and possession/action team.
9. Summary review appears.
10. User adds penalties or confirms submit.

### Interception Return

Required tokens:

- interceptor jersey
- return end spot or return yards

Defaulting:

- Duplicate `#3` modal preselects defensive player.

### Punt Return

Required tokens:

- punter jersey
- punt result
- returner jersey when returned
- end spot or return yards

Defaulting:

- Punter uses special teams/kicking team context.
- Returner uses special teams/receiving team context.

## Play Summary Confirmation Rules

Summary must be human-readable first and payload-oriented second.

Summary should include:

- Play type and subtype.
- Team in possession or acting team.
- Resolved player names and jerseys.
- Start context: period, clock if available, down/distance, spot.
- Result context: yards, end spot, first down/score/turnover if known.
- Penalties attached to the draft.
- Warnings for unusual but allowed choices, such as a defensive-position player selected for an offensive action.

Summary actions:

- `Confirm Submit`: submits through the existing canonical submit path.
- `Edit`: returns to the step/token that produced the selected summary segment.
- `Add Penalty`: opens penalty attachment.
- `Cancel`: discards the draft after confirmation if draft data exists.

The summary must not call `submitEvent` on render, on draft completion, or on ordinary Enter from the last token field.

## Penalty Entry Behavior

Penalty handling should be draft-scoped and confirmation-based. FCQI defines two penalty entry modes: immediate penalty and queued penalty.

### Immediate Penalty

Immediate penalty mode is used when the operator enters a penalty directly as its own event or before/after a play.

Examples:

- pre-snap penalty
- dead-ball penalty
- post-play penalty
- penalty-only event

Behavior:

- Starts from `E`.
- Opens the penalty flow immediately.
- Produces either a penalty-only intent or an attached penalty intent, depending on whether a play draft is active and whether the operator chooses to attach it.
- Still requires human-readable summary confirmation before build or submit.
- Does not call submit merely because required penalty fields are complete.
- Penalty-only events should use the same confirmation pattern: collect penalty details, summarize, confirm submit.

### Queued Penalty

Queued penalty mode is used when a penalty is noticed during an active play flow and the operator should not lose the current play-entry context.

Hotkey:

- `Shift+E`

Behavior:

- Does not interrupt the current play flow.
- If no unresolved queued penalty is active, adds a queued penalty marker to the active FCQI draft, such as `queuedPenaltyRequested: true`.
- If an unresolved queued penalty is already active, toggles the marker off and returns to normal play collection.
- The Input Assistant should show `Penalty queued — resolve before confirmation` and use a prominent yellow warning treatment while the marker is active.
- At the end of the play, before final confirmation, the queued penalty must be resolved into typed penalty objects or removed.
- Summary confirmation shows the play plus queued/resolved penalties.
- Queued penalties must be editable and removable before final confirm.
- No event is submitted until final play confirmation.

Current implementation note:

- Full queued penalty modal and attachment resolution are intentionally future work.
- A safe placeholder such as `queuedPenaltyRequested: boolean` is acceptable when the machine/UI needs to remember the operator request, but it must not build or submit an incomplete penalty event.

### Confirmed Penalty Entry Model

Penalty entry collects:

1. Penalty name
2. Team
3. Resolution

Resolution operator codes:

- `A` = Accepted
- `D` = Declined
- `O` = Offsetting

Declined penalties are terminal after the operator selects the declined resolution. They can attach to the play summary, but they do not require enforcement fields and do not alter play enforcement.

Offsetting penalties require at least one penalty on each team. A single-team offsetting penalty is invalid.

When the operator chooses `O` Offsetting, FCQI must ask:

`Does the previous play count?`

Options:

- `Y` = Yes, play counts
- `N` = No, play is cancelled

This decision must be stored explicitly as typed data, such as `offsetting.previousPlayCounts` or an equivalent `playCounts` boolean. Do not infer it from summary wording.

Offsetting during the play:

- Previous play does not count.
- Play stats are nullified.
- Ball returns to previous spot unless projection/rules later determine otherwise.
- Down is repeated unless rules specify otherwise.

Offsetting after the play:

- Previous play counts.
- Play stats remain.
- Offsetting fouls are recorded after the play.
- Enforcement/projection keeps the play result as the base state.

The summary should clearly distinguish whether the play counts.

Accepted penalties collect:

- player, optional and nullable
- enforced from
- spot of foul, only when enforced from `Spot of Foul`
- final spot
- down consequence

Player is optional. If provided, the jersey/player must resolve through the active roster. If omitted, the penalty is team-only.

Enforced-from options:

- `Previous Spot`
- `Spot of Foul`
- `Succeeding Spot`

Immediate penalty rule:

- Immediate penalties force `Previous Spot`.

Queued penalty rule:

- Queued penalties attached to a play allow `Previous Spot`, `Spot of Foul`, or `Succeeding Spot`.

Previous Spot means the previous play is nullified. All stats from the previous play are nullified, and enforcement is from the previous play line of scrimmage.

Succeeding Spot means the play counts in its entirety. Keep play stats and apply penalty enforcement from the play result final spot.

Spot of Foul means the play counts only up to the foul spot. For example, start `H46`, rush to `V35`, holding by `H56` at `V45`: rushing stats count from `H46` to `V45` for a 9-yard gain, then the 10-yard penalty is enforced from `V45` to `H45`.

Down consequence options:

- `Repeat Down`
- `Loss of Down`
- `Auto 1st Down`

Immediate penalty rule:

- Immediate penalties force `Repeat Down`.

Queued penalty rule:

- Queued penalties attached to a play allow `Repeat Down`, `Loss of Down`, or `Auto 1st Down`.

Repeat Down does not increment the down. Loss of Down increments the down. Auto 1st Down sets down to first and sets the line to gain 10 yards from the penalty final spot.

Future penalty-table behavior:

- Build a searchable penalty table with penalty name, common code, default yardage, default enforcement, default down consequence, live/dead-ball hints, automatic-first flags, and loss-of-down flags.
- Selecting a penalty should autofill most fields.
- All autofilled fields remain user-editable.
- The operator can override yardage, enforcement spot, player, team, final spot, and down consequence.

Shared behavior:

- Adding a penalty does not submit the play.
- Penalty modal writes typed penalty objects into `draft.penalties`.
- Summary re-renders with penalty text.
- Multiple penalties are allowed.
- Penalties can be edited or removed before final confirmation.

Important:

- Use the typed penalty structures already represented by `src/types/penalties.ts`, `src/utils/penaltyRules.ts`, and `src/components/PenaltiesModal.tsx` where possible.
- Avoid the older direct `submit_play_enhanced.php` path inside `usePlayInputFlow` for FCQI final submission unless that endpoint is explicitly confirmed as canonical.

## How This Differs From Basketball Quick Input

Basketball quick input is a good model for:

- hotkey-started intent flows
- modal prompts
- compact operator workflows
- flow-specific keyboard handling
- context-aware defaults

Football differs because:

- Football plays have more conditional branches per play type.
- A single play can involve offensive, defensive, and special teams actors.
- Jersey duplication is more common because football rosters are larger.
- A default player can be useful but cannot safely imply selection.
- Penalties are often part of the same play record and must remain editable before submit.
- Down/distance, spot, drive, turnover, and scoring consequences are high-risk enough to require a confirmation summary.
- FCQI produces a draft event first; Basketball-style immediate flow completion must not imply submit.

## Likely Files and Components To Change Later

New likely files:

- `src/quick-input/footballConfirmedQuickInputMachine.ts`
- `src/quick-input/footballQuickInputSchema.ts`
- `src/quick-input/footballQuickInputSummary.ts`
- `src/quick-input/playerResolution.ts`
- `src/components/FootballConfirmedQuickInput.jsx`
- `src/components/FootballQuickInputSummaryModal.jsx`
- `src/components/FootballDuplicatePlayerModal.jsx` or a refactor of `PlayerDisambiguationModal.jsx`

Existing files likely to modify:

- `src/pages/FootballScorerShell.jsx`
- `src/components/scorer/ScorerLayoutShell.jsx` only if the input slot needs a stable target surface, not for logic.
- `src/contexts/FootballFlowContext.jsx`
- `src/hooks/usePlayInputFlow.jsx`
- `src/components/FootballFlowModal.jsx`
- `src/components/PlayInputFlows/RushInputFlow.jsx`
- `src/components/PlayInputFlows/PassInputFlow.jsx`
- `src/components/PlayInputFlows/PuntInputFlow.jsx`
- `src/components/PlayInputFlows/KickInputFlow.jsx`
- `src/components/PlayInputFlows/GameControlInputFlow.jsx`
- `src/components/PlayerInput.jsx`
- `src/components/PlayerDisambiguationModal.jsx`
- `src/utils/positionPriority.js`
- `src/hooks/usePlayerLookup.js`
- `src/types/penalties.ts`
- `src/components/PenaltiesModal.tsx`

Backend/canonical contract files to verify before wiring:

- Current UI submit path in `src/contexts/FootballGameContext.jsx`
- Canonical envelope submit endpoint if using `/Users/bryanshepherd/strata_football`
- `docs/football-envelope-api.md` if present in the target branch

## Proposed Implementation Sequence

1. Add a pure state machine and tests with no UI.
2. Add roster-resolution helpers and duplicate-default tests.
3. Add summary builder and summary tests.
4. Replace prompt-based duplicate handling with a reusable modal.
5. Add FCQI UI behind a preview/dev flag or preview route.
6. Wire final confirm to existing submit path only after draft payload shape is reviewed.
7. Deprecate direct auto-submit behavior in FCQI-controlled flows.

## Test Cases

### State Machine

- Starts in `idle`.
- `R` starts rush flow and enters `token.awaiting`.
- Enter commits current token but does not submit.
- Completing required tokens enters `draft.ready`.
- `draft.ready` enters `summary.reviewing`.
- Submit function is not called until `Confirm Submit`.
- Cancel from meaningful draft asks for discard confirmation.
- Submit failure returns to `submit.error` with the draft retained.

### Jersey Validation

- Empty jersey token is rejected.
- Non-numeric jersey token is rejected.
- Jersey above valid range is rejected.
- Missing active roster blocks progress with a clear error.
- Zero roster matches blocks progress.
- One roster match commits the player.
- Multiple roster matches opens duplicate modal.

### Duplicate Resolution

- Rush by duplicate `#3` recommends RB over OLB and PR.
- INT return by duplicate `#3` recommends OLB over RB and PR.
- Punt return by duplicate `#3` recommends PR over RB and OLB.
- Recommended player is preselected but not auto-confirmed.
- User can choose a non-recommended player.
- Cancel returns to the jersey token without committing.

### Summary Confirmation

- Rush summary includes rusher name, jersey, yards, end spot, and tacklers if present.
- Pass summary includes passer, receiver when applicable, completion status, yards, and interception/fumble status.
- Punt summary includes punter, result, returner if present, and end spot.
- Summary displays attached penalties.
- Confirm submit calls the submit adapter exactly once.
- Editing a summary segment returns to the correct token.

### Penalties

- `E` starts immediate penalty entry.
- `Shift+E` queues a penalty marker during an active play draft without interrupting the current play flow.
- Queued penalties must be resolved, edited, or removed before final confirmation.
- Penalty entry and attachment do not submit.
- Multiple penalties can be attached.
- Penalty can be removed before submit.
- Penalty-only flow still requires summary confirmation.

## Game Control Menu

Game Control is the FCQI operator surface for non-play game operations. It starts from the `G` hotkey or the Game Control button and uses the same modal shell, hotkey badges, and progress display as play flows.

Menu codes:

- `E` = Emergency
- `Q` = Quarter Functions
- `B` = Ball Context
- `D` = Drive Start
- `P` = Set Possession
- `C` = Coin Toss
- `R` = Roster Functions

Coin Toss is pregame/start-game only. Until reliable pregame detection is available, production UI should hide Coin Toss by default and keep a TODO to show it only when the game has not started.

### Emergency

Emergency is reserved for repair/manual state-change operations such as possession correction, drive repair, or live-state correction after an operator error. Emergency actions may not emit normal scoring events. Until a canonical control submit path is approved, Emergency must safe-block with `Emergency controls not implemented yet`.

### Quarter Functions

Quarter Functions submenu:

- `S` = Start Quarter
- `E` = End Quarter

Future control metadata should include `type: "gameControl"`, subtype `startQuarter` or `endQuarter`, period context, and clock context. Until the canonical control submit path exists, these options safe-block with start/end quarter not-implemented messages.

### Ball Context

Ball Context collects:

1. Down
2. Distance
3. Spot

Distance is not authoritative stored state. Setting distance should calculate line to gain from the entered spot:

```txt
lineToGain = Spot + Distance
```

The calculation uses the current possession/action-team field perspective. The UI must not manually patch the scoreboard; accepted backend/projection state owns visible scorer updates.

### Drive Start

Drive Start is for manually starting a new drive when projection cannot infer it. Until a canonical control submit path exists, it should safe-block with `Drive start control submit not implemented yet`.

### Set Possession

Set Possession collects a canonical team (`H` or `V`) for now. Future UI should accept operator aliases as documented in `docs/football-operator-team-aliases.md`. Until a canonical control submit path exists, it should safe-block with `Set possession control submit not implemented yet`.

### Roster Functions

Roster Functions are planned for:

- `S` = Starters
- `R` = Rosters
- `U` = Uni Change

For the scaffold, these remain disabled/TBD or safe-block with `Roster functions not implemented yet`.

### Regression

- Existing hotkeys still start the correct play flows.
- Existing scoring and envelope logic are unchanged.
- Existing tests for down/distance, drive rules, penalties, and validation continue to pass.
