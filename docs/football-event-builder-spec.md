# Football Event Builder Specification

## 1. Purpose

The Football Event Builder is the final pre-submit layer of the Football Confirmed Quick Input pipeline.

```text
FCQI Draft Intent
  ↓
FPSG Summary Review
  ↓
Operator Confirm
  ↓
Football Event Builder
  ↓
Canonical Envelope Events
  ↓
Projection / Stats / Game State
```

The Event Builder converts a confirmed FCQI draft intent into a canonical football envelope event body that can be submitted through the football envelope submit path.

It does not render UI text, collect input, validate jerseys, choose duplicate players, calculate stats, mutate the envelope, or project game state. Those responsibilities belong to the surrounding layers:

- FCQI collects tokens, validates roster/player choices, and creates the resolved draft intent.
- FPSG generates the human-readable confirmation summary.
- Operator confirmation authorizes event construction.
- Football Event Builder creates the canonical event body.
- Backend/envelope ingestion accepts or rejects the submit request.
- Projection/rules/stats derive post-submit game state from accepted events.

## 2. Non-Goals

The Event Builder must not:

- submit the event directly
- auto-submit when a draft becomes complete
- mutate `GameEnvelope`
- calculate official `postState`
- assign backend `eventId`, `sequence`, `status`, or `acceptedAt`
- update score, stats, drives, down/distance, or possession
- enforce football rules beyond structural validation
- parse human-readable FPSG text back into data
- infer unresolved players from jersey numbers
- silently coerce invalid team, spot, or penalty values

## 3. Source Documents

This specification builds on:

- `docs/football-confirmed-quick-input-design.md`
- `docs/football-play-summary-grammar.md`
- `docs/football-lateral-stat-allocation.md`
- `docs/football-operator-team-aliases.md`
- `docs/strata-football-envelope-contracts.md`

The canonical event shape should follow the `ScoringEvent` and `SubmitEventRequest` drafts in `docs/strata-football-envelope-contracts.md`.

## 4. Layer Contract

Recommended conceptual API:

```ts
buildFootballEvent(input: {
  gameId: string;
  draftIntent: FootballConfirmedDraftIntent;
  envelopeSnapshot: GameEnvelope;
  summaryReview: FootballPlaySummaryReview;
  clientContext: FootballClientContext;
}): FootballEventBuildResult
```

Return shape:

```ts
type FootballEventBuildResult =
  | {
      ok: true;
      submitRequest: SubmitEventRequest;
      event: DraftScoringEvent;
      warnings: BuildWarning[];
    }
  | {
      ok: false;
      errors: BuildError[];
      warnings: BuildWarning[];
    };
```

The builder should be deterministic: the same confirmed draft intent, envelope snapshot, and client context should produce the same draft event body, apart from caller-supplied IDs/timestamps.

## 5. Required Inputs

The Event Builder requires:

- `gameId`
- confirmed FCQI draft intent
- current envelope snapshot used as the draft's base state
- FPSG summary review metadata proving the operator saw the summary
- `clientEventId`
- scorer session/user context where available
- `baseEventSequence`
- `baseEnvelopeVersion` or equivalent optimistic-concurrency marker

The confirmed FCQI draft intent must include:

- play family
- play subtype/result
- acting team or possession team
- period and clock
- pre-play state
- resolved participants
- result details
- attached penalties
- confirmation metadata

## 6. Output: SubmitEventRequest

The builder should produce a `SubmitEventRequest` shaped like:

```json
{
  "schemaVersion": "football.submitEventRequest.v1",
  "gameId": "FB-1001",
  "clientContext": {
    "clientEventId": "client-uuid-1",
    "sessionId": "scorer-session-1",
    "userId": "user-123",
    "submittedAt": "2026-06-20T00:00:00Z",
    "baseEnvelopeVersion": "2026-06-20T00:00:00Z",
    "baseEventSequence": 41
  },
  "event": {
    "clientEventId": "client-uuid-1",
    "type": "rush",
    "subtype": null,
    "period": 1,
    "clock": "08:42",
    "possession": "H",
    "preState": {
      "possession": "H",
      "down": 2,
      "distance": 6,
      "yardLine": "H44",
      "lineToGain": "50",
      "driveId": "DRV-0002",
      "driveNumber": 2
    },
    "participants": {
      "primary": { "playerId": "H-22", "team": "H", "role": "rusher" },
      "secondary": null,
      "defenders": [
        { "playerId": "V-44", "team": "V", "role": "tackler" }
      ]
    },
    "result": {
      "code": "tackle",
      "yards": 4,
      "endYardLine": "H48",
      "firstDown": false,
      "driveEnds": false,
      "scoring": null,
      "turnover": null
    },
    "penalties": [],
    "description": "HOM #22 Jordan Smith rush for 4 yards to the H48, tackled by #44 Caleb Moss."
  }
}
```

Backend-only fields must be omitted:

- `eventId`
- `sequence`
- `status`
- `acceptedAt`
- authoritative `postState`

## 7. Event Builder Responsibilities

The Event Builder should:

1. Verify the draft was explicitly confirmed.
2. Verify the FPSG summary was generated from the same draft revision.
3. Copy the authoritative pre-play context from the base envelope or the FCQI snapshot that was validated against it.
4. Normalize team codes to canonical `H` and `V`.
5. Normalize event type and subtype into canonical envelope vocabulary.
6. Map resolved players into `participants`.
7. Map play outcome tokens into `result`.
8. Attach typed penalties.
9. Attach the human-readable FPSG summary as `description` or equivalent display metadata.
10. Return typed errors instead of partial events when required fields are missing.

FCQI result-code boundary:

- FCQI operator result codes are compact input shortcuts and are not the same contract as final envelope `result.code`.
- The Event Builder should receive canonical `FootballDraftIntent.result` fields, not raw modal state.
- When FCQI preserves `result.operator` metadata, the builder may copy it into client-side source/debug metadata if the envelope contract allows it.
- The builder must not reinterpret `C`, `F`, `T`, `X`, or `.` without the intent's context. For example, `C` can mean primary Pass Complete, terminal Lateral, or kick receive Fair Catch depending on `result.operator.inputScope`.
- The builder must not reinterpret `T` without context. `terminal.result:T` means Tackle, while `kick.receiveResult:T` means Touchback.
- The builder must reject incomplete fumble, lateral, or return continuations rather than building a partial event.
- Lateral continuation is shared across live-ball play families and returns. The builder should preserve typed lateral segment data for projection; it should not treat lateral as a pass-only branch.

## 8. Event Builder Boundaries

The builder may validate structural consistency:

- required fields are present
- team codes are canonical
- field positions match canonical spot format
- participant IDs are resolved
- required play-result fields are present
- penalties have required typed fields
- the draft's base sequence matches the envelope snapshot used for review

The builder must not project consequences:

- no down advancement calculation
- no line-to-gain calculation except copying known pre-state
- no drive start/end mutation
- no score mutation
- no player/team stat increments
- no timeout/challenge state mutation

Projection belongs to backend envelope ingestion and the football rules/projection layer.

## 9. Canonical Event Fields

Required draft event fields:

- `clientEventId`
- `type`
- `period`
- `clock`
- `possession`
- `preState`
- `participants`
- `result`
- `penalties`

Recommended draft event fields:

- `subtype`
- `description`
- `source`
- `warnings`
- `confirmation`

Recommended `source` metadata:

```json
{
  "source": {
    "kind": "fcqi",
    "draftIntentId": "draft-uuid-1",
    "draftRevision": 4,
    "summaryRevision": 4,
    "confirmedAt": "2026-06-20T00:00:00Z"
  }
}
```

Recommended `confirmation` metadata:

```json
{
  "confirmation": {
    "summaryText": "HOM #22 Jordan Smith rush for 4 yards to the H48.",
    "confirmedByUserId": "user-123",
    "confirmedAt": "2026-06-20T00:00:00Z"
  }
}
```

If backend contracts do not accept `source` or `confirmation` initially, keep them client-side until the canonical schema explicitly includes them.

## 10. Team and Possession Rules

Canonical persisted teams are:

- `H`
- `V`

The builder should:

- accept only already-normalized team codes from FCQI where possible
- reject `home`, `visitor`, `HOME`, `VISITOR`, `away`, or display abbreviations at the final build boundary
- reject operator aliases or spot prefixes that were not normalized before the draft intent reached this layer
- preserve `possession` as the team responsible for the event's offensive or kicking action
- use `result.nextPossession` only for events that explicitly create a possession change candidate, such as punt, kickoff, interception, fumble recovery by defense, missed field goal, or turnover on downs

The builder should not decide possession changes by itself. It should encode the explicit result metadata needed by the projection layer.

Operator alias boundary:

- FCQI may accept friendly aliases such as team abbreviations or configured spot prefixes.
- The Event Builder must receive canonical `H` / `V` team values and canonical spot strings.
- The Event Builder must not parse operator aliases.
- Optional alias source metadata may be copied only if the canonical envelope contract supports source/debug metadata.

## 11. Pre-State Rules

`preState` must describe the accepted game state before the play:

- `possession`
- `down`
- `distance`
- `yardLine`
- `lineToGain`
- `driveId`
- `driveNumber`

Rules:

- For normal scrimmage plays, `preState` should copy `GameEnvelope.liveState`.
- For kickoff, `lineToGain`, `down`, and `distance` may be `null` when the accepted live state is possession-free.
- For try/PAT, `lineToGain`, `down`, and `distance` may be `null`.
- For game-control events, `preState` should include the live state when relevant but may not require a ball spot.
- If FCQI captured a pre-state snapshot and the envelope has advanced since then, the builder should return a stale-base error rather than building against mismatched state.

## 12. Field Position Rules

Canonical spots:

- `H35`
- `V20`
- `50`
- `goal` only where the canonical envelope contract explicitly allows it, such as `lineToGain`

Rules:

- The builder should accept only canonical spot strings at the final boundary.
- UI shorthand such as `H5`, `V039`, or display text such as `the V43` should be normalized before the Event Builder.
- Operator-facing spot prefixes such as `S32` or `T12` must be normalized to canonical spot strings such as `H32` or `V12` before the Event Builder.
- `result.endYardLine` is required for most ball-changing plays.
- Field-goal and try events may use the attempt spot and result metadata instead of normal scrimmage advancement.
- Touchback, fair-catch, downed, and out-of-bounds results should carry the dead-ball spot in `result.endYardLine`.

The builder must not calculate gain/loss from spot strings when the draft already contains explicit yards. If yards are missing, the builder may leave `result.yards` absent only when the event type allows projection to compute it from `preState.yardLine` and `result.endYardLine`.

## 13. Participant Mapping

Canonical participant shape:

```json
{
  "primary": { "playerId": "H-22", "team": "H", "role": "rusher" },
  "secondary": { "playerId": "H-88", "team": "H", "role": "receiver" },
  "defenders": [
    { "playerId": "V-44", "team": "V", "role": "tackler" }
  ],
  "others": []
}
```

Roles should be explicit and play-specific:

- `rusher`
- `passer`
- `receiver`
- `intendedReceiver`
- `sackVictim`
- `punter`
- `kicker`
- `returner`
- `holder`
- `tackler`
- `assistTackler`
- `sack`
- `interceptor`
- `forcedFumble`
- `fumbler`
- `recoverer`
- `blocker`
- `penalizedPlayer`

Rules:

- Every player participant must have a resolved `playerId`.
- Jersey-only unresolved players are not valid at this layer unless the canonical contract has an explicit unknown-player participant shape.
- `team` must match the roster-resolved team.
- Duplicate jersey resolution metadata should not be needed to build the event, but may be preserved in source/debug metadata.

## 14. Penalty Mapping

Penalties should use typed penalty structures, not free text.

Recommended canonical penalty shape:

```json
{
  "penaltyId": "penalty-client-uuid-1",
  "team": "V",
  "code": "DPI",
  "name": "Defensive Pass Interference",
  "resolution": "accepted",
  "yards": 15,
  "playerId": null,
  "enforcedFrom": "SPOT",
  "spotOfFoul": "V42",
  "finalSpot": "H43",
  "downConsequence": "AUTO_FIRST",
  "source": "queued",
  "status": "accepted",
  "offsetting": null,
  "automaticFirstDown": true,
  "lossOfDown": false,
  "replayDown": false,
  "liveBall": true,
  "carryOverToKO": false,
  "notes": null
}
```

Rules:

- Convert UI `accepted: true` into `status: "accepted"`.
- Convert UI `accepted: false` into `status: "declined"` unless the penalty resolution explicitly marks offsetting.
- Use `status: "offsetting"` for offsetting penalties.
- Preserve `resolution` as `accepted`, `declined`, or `offsetting`.
- Preserve `source` as `immediate` or `queued`.
- Preserve `automaticFirstDown`, `lossOfDown`, `replayDown`, `liveBall`, and carry-over flags.
- Preserve `enforcedFrom`.
- Preserve `spotOfFoul`, `finalSpot`, and `downConsequence` when supplied.
- Declined penalties are terminal and do not require enforcement fields.
- Offsetting penalties require at least one typed penalty on each team; do not build a single-team offsetting penalty.
- Offsetting penalties require explicit typed play-count metadata such as `offsetting.previousPlayCounts` or equivalent `playCounts`.
- Do not infer `previousPlayCounts` from wording.
- If `previousPlayCounts` is missing, reject the build.
- If `previousPlayCounts: false`, treat the offsetting fouls as during the play: the previous play is cancelled/nullified, play stats are nullified, and projection starts from the previous spot unless later rules determine otherwise.
- If `previousPlayCounts: true`, treat the offsetting fouls as after the play: preserve play stats and use the play result as the base state.
- Accepted immediate penalties should have `enforcedFrom: "PREVIOUS"` and `downConsequence: "REPEAT"`.
- Accepted queued penalties may use previous spot, spot of foul, or succeeding spot enforcement and may use repeat down, loss of down, or automatic first down consequences.
- `enforcedFrom: "SPOT"` requires `spotOfFoul`.
- Accepted penalties require `finalSpot`.
- Require `yards` when the penalty definition requires yards.
- Require `spot` when the penalty definition requires a spot.
- Do not infer penalty consequences from FPSG summary text.
- Do not apply penalty yardage to `preState` or `postState` in the builder.
- Do not convert unresolved `queuedPenaltyRequested` metadata into a placeholder `DraftPenalty`.
- Reject or block any confirmed build path that still contains an unresolved queued penalty marker.

Penalty-only events should use `type: "penalty"` with `result.code` reflecting the accepted/declined/offsetting resolution.

Enforcement semantics for downstream projection:

- Previous Spot nullifies the previous play. The play does not count statistically, and enforcement starts from the pre-play yardline.
- Succeeding Spot keeps the play stats and applies enforcement from the play result final spot.
- Spot of Foul counts the play only through the foul spot, then applies enforcement from the foul spot.
- Repeat Down does not increment the down.
- Loss of Down increments the down.
- Auto 1st Down sets down to first and line to gain 10 yards from the penalty final spot.

Future penalty table:

- The Event Builder should accept typed values resolved from a future searchable penalty table.
- The table should provide penalty name, common code, default yardage, default enforcement, default down consequence, live/dead-ball hints, automatic-first flags, and loss-of-down flags.
- Autofilled table values remain operator-editable before confirmation.

## 15. Result Mapping by Play Family

### Rush

Event:

- `type: "rush"`
- `subtype: null`
- `participants.primary`: rusher
- `participants.defenders`: tacklers and assist tacklers

Result fields:

- `code`: `tackle`, `touchdown`, `outOfBounds`, `fumble`, `safety`, or equivalent canonical result
- `yards`
- `endYardLine`
- `firstDown`
- `driveEnds`
- `scoring`
- `turnover`
- `fumble` when present

FCQI operator result mapping:

- Rush `T` maps to canonical tackle-like result fields and requires at least one tackler.
- Rush `O` maps to `outOfBounds` and allows zero tacklers.
- Rush `F` requires complete fumble details before build.
- Rush `C` requires complete lateral continuation before build; if lateral is not implemented, the builder must reject it.
- Rush `.` may map to a neutral dead-ball/tackle-like canonical code, but should preserve source operator metadata when available and must not require tackled-by text.

### Pass

Event:

- `type: "pass"`
- `subtype`: `complete`, `incomplete`, `sack`, `interception`, or `touchdown`
- `participants.primary`: passer
- `participants.secondary`: receiver or intended receiver when present
- `participants.defenders`: tacklers, pass breakups, sack participants, interceptor

Result fields:

- `code`: `complete`, `incomplete`, `sack`, `interception`, `touchdown`
- `yards`
- `endYardLine`
- `firstDown`
- `scoring`
- `turnover`
- `targetPlayerId` if the canonical schema wants target separate from secondary

Primary FCQI pass result mapping:

- `C` = Complete.
- `I` = Incomplete.
- `S` = Sack.
- `F` = Sack Fumble.
- `R` = Rush Conversion.
- `X` = Intercepted.

Builder rules:

- `R` Rush Conversion should arrive as a Rush intent. The builder must not build a pass event for a converted rush.
- Complete pass requires receiver and end yardline.
- Complete pass may carry optional caught-at yardline.
- Complete pass nested result code must be one of `T`, `O`, `F`, `C`, `.`.
- Complete nested `C` means Lateral and must not be treated as Complete.
- Complete nested `F` requires complete fumble details before build.
- Complete nested `C` requires complete lateral details before build.
- Incomplete and intercepted passes require intended receiver.
- Broken up allows exactly one defender.
- Hurried allows up to three defenders.
- Interception must include the return-flow data required by the canonical interception event or be rejected as incomplete.

### Sack

Sack may be represented as:

- `type: "pass"`
- `subtype: "sack"`

Result fields:

- `code: "sack"`
- `yards`: negative or omitted if computed from spot
- `endYardLine`
- `fumble` if the sack includes a fumble

Participants:

- `primary`: passer/sack victim
- `defenders`: sack participants

### Interception

Interception may be represented as:

- `type: "pass"`
- `subtype: "interception"`

Result fields:

- `code: "interception"`
- `endYardLine`: final dead-ball spot
- `turnover`: object with recovery/interception team and return fields
- `interceptionSpot`
- `returnYards`
- `returnEndYardLine`
- `scoring` when returned for touchdown

Participants:

- `primary`: passer
- `secondary`: intended receiver when known
- `defenders`: interceptor and return tacklers

### Fumble

Fumble can attach to rush, pass, sack, punt return, kickoff return, field-goal return, or game-control context.

Result fields:

- `code`: base play result or `fumble`
- `fumble`: object containing fumbler, forced-by, recovery, recovery team, recovery spot, return yards, and return end spot
- `turnover`: present when possession changes
- `scoring`: present for fumble return touchdown or safety

Rules:

- Do not model a fumble as a separate event when it belongs to the confirmed play.
- A standalone correction/recovery event should be a separate future workflow, not part of this builder spec.
- Sack fumble and completed-pass fumble must be modeled as fumble details attached to the confirmed play.
- If recovery, recovery team, recovery spot, or required return detail is missing, reject the build.

### Kick Receive, Shared Return, And Lateral Continuations

Kick receive flow is distinct from Shared Return Flow. It applies when a kickoff or punt first arrives and uses scoped kick receive result codes:

- `R` = Return
- `T` = Touchback
- `C` = Fair Catch
- `O` = Out of Bounds
- `M` = Muffed
- `D` = Downed

Kick receive builder rules:

- `R` Return starts Shared Return Flow and must include returner/from-spot context before build.
- `T` Touchback is terminal receive result; no returner is required unless future rules/context explicitly require one.
- `C` Fair Catch is terminal receive result; returner is required, no return yards are created, and no return terminal result is collected.
- `D` Downed is terminal receive result; downing player should be preserved when supplied, and no return flow starts.
- `M` Muffed requires recovery details and may continue into return flow when applicable.
- `O` Out of Bounds is a kick result, not a return terminal result.
- Kick touchback and fair catch are terminal receive results, not generic offensive terminal results.

Return flow is shared by fumble return, interception return, field goal return, PAT/try return, kickoff return after Kick Receive `R`, and punt return after Kick Receive `R`.

Required return fields before build:

- `type`: `Fumble | Interception | Field Goal | Kickoff | Punt | Try`
- `returner`
- `fromSpot`
- terminal result
- terminal-result details
- `toSpot`

Return terminal result semantics mirror base terminal result semantics where applicable:

- `T` Tackle: at minimum support one tackler and optional second tackler where applicable.
- `O` Out of Bounds: tacklers optional, out-of-bounds wording.
- `F` Fumble: starts fumble continuation.
- `C` Lateral: starts lateral continuation.
- `.` End of Play: no tackler.

Return flow must preserve return type because stats differ by return family.

Lateral flow is shared by rushes, completed passes, fumble returns, interception returns, kickoff returns, punt returns, field goal returns, and other live-ball continuations.

Lateral segment fields before build:

- `lateralFromPlayer`
- `lateralToPlayer`
- `lateralFromSpot`
- `lateralToSpot`
- `continuationType`
- `continuationResult`
- `finalSpot` or next lateral segment

Rules:

- If return or lateral support is not implemented for a selected continuation, FCQI should block before confirmation.
- If an unresolved continuation reaches the builder, the builder must return a typed blocking error.
- The builder must not invent missing returner, lateral receiver, continuation result, or final spot data.
- The builder should preserve lateral segments on the draft event using the canonical intent fields. Projection/stat engines should allocate original-family yards, miscellaneous lateral-exchange yards, and continuation-family yards using `docs/football-lateral-stat-allocation.md`.
- The builder must not collapse all post-catch or post-return advancement into miscellaneous yards. Only `lateralFromSpot -> lateralToSpot` is miscellaneous.
- The builder must preserve enough typed segment data for projection to verify that original-family yards plus miscellaneous lateral yards plus continuation-family yards equal total play gain or return gain.
- Receiving a lateral must not create an additional attempt in builder output metadata.

### Punt

Event:

- `type: "punt"`
- `subtype`: `returned`, `fairCatch`, `downed`, `touchback`, `outOfBounds`, `blocked`, `muffed`

Result fields:

- `code`
- `kick.receiveResultCode`: `R`, `T`, `C`, `O`, `M`, or `D` when produced by FCQI
- `kickYards`
- `catchYardLine`
- `returnYards`
- `endYardLine`
- `nextPossession`
- `driveEnds: true`
- `turnover` when blocked or muffed recovery changes normal possession

Participants:

- `primary`: punter
- `secondary`: returner when present
- `defenders`: tacklers, blockers, recovery players as roles

Rules:

- Punt receiving uses Kick Receive Flow first.
- Punt receive `R` starts Shared Return Flow.
- Punt receive `C` Fair Catch and `D` Downed are terminal receive outcomes and should not include return terminal result fields.
- Punt receive `O` Out of Bounds is a kick result and should carry the dead-ball spot.

### Kickoff

Event:

- `type: "kickoff"`
- `subtype`: `returned`, `touchback`, `fairCatch`, `outOfBounds`, `onside`, `muffed`

Result fields:

- `code`
- `kick.receiveResultCode`: `R`, `T`, `C`, `O`, `M`, or `D` when produced by FCQI
- `kickYards`
- `catchYardLine`
- `returnYards`
- `endYardLine`
- `nextPossession`
- `driveEnds: false` for kickoff-started context unless a current drive explicitly exists

Rules:

- Kickoffs should provide enough metadata for projection to start the receiving team's drive.
- Kickoff receiving uses Kick Receive Flow first.
- Kickoff receive `R` starts Shared Return Flow.
- Kickoff receive `T` Touchback and `C` Fair Catch are terminal receive outcomes and should not include return terminal result fields.
- Kickoff receive `O` Out of Bounds is a kick result and should carry the dead-ball spot.
- The builder must not assign drive result text such as `returned` or `received`.
- Touchback end spot should come from rules/settings or the FCQI draft, not from hard-coded builder logic.

### Field Goal

Event:

- `type: "fieldGoal"`
- `subtype`: `made`, `missed`, `blocked`, `returned`

Result fields:

- `code`
- `attemptYards`
- `kickSpot`
- `endYardLine`
- `points`
- `scoring` for made field goal
- `driveEnds: true`
- `nextPossession` for missed/blocked/returned attempts when known

### Try / PAT

Event:

- `type: "try"`
- `subtype`: `kick`, `rush`, `pass`, `failed`, `blocked`, `defensiveReturn`

Result fields:

- `code`
- `points`
- `scoring`
- `endYardLine`

Rules:

- Try/PAT is a possession-free context, not a normal down-distance play.
- Do not generate a normal line-to-gain.

### Game Control

Event:

- `type: "gameControl"`
- `subtype`: `startQuarter`, `endQuarter`, `setBallContext`, `startDrive`, `setPossession`, `coinToss`, `emergency`, `rosterFunction`, or future canonical subtype

Rules:

- Game-control events should be separate from play events.
- Timeout/challenge UI status should not be folded into a play event unless the canonical contract explicitly supports it.
- Game-control drafts still require FCQI summary confirmation before submit.
- If no canonical game-control submit path exists, the FCQI machine/UI must safe-block instead of building incomplete events.
- Emergency controls are reserved for repair/manual state changes and may not map to normal scoring events.
- Coin Toss should be pregame/start-game only.
- Roster Functions are TBD and should not be routed through the normal play event path.

Ball Context control:

- Collect down, distance, and spot.
- Calculate `lineToGain = spot + distance` from the current possession/action-team perspective.
- Do not treat distance as authoritative by itself.
- Do not manually patch the scoreboard in FCQI; accepted backend/projection state owns scoreboard updates.

Set Possession control:

- Collect canonical `H` or `V` for now.
- Future operator aliases should resolve before Event Builder input; Event Builder should persist only canonical team codes.

## 16. Scoring Metadata

The builder may include scoring metadata only when the confirmed draft explicitly marks a scoring result:

```json
{
  "scoring": {
    "team": "H",
    "points": 6,
    "type": "touchdown"
  }
}
```

Allowed scoring types should include:

- `touchdown`
- `fieldGoal`
- `patKick`
- `twoPoint`
- `safety`
- `defensiveConversion`

The projection layer owns score mutation. The builder only encodes the confirmed scoring fact.

## 17. Turnover Metadata

Turnovers should use structured metadata:

```json
{
  "turnover": {
    "type": "interception",
    "team": "V",
    "playerId": "V-03",
    "spot": "H42",
    "returnYards": 18,
    "returnEndYardLine": "H24",
    "recoveredBy": "V"
  }
}
```

Turnover types:

- `interception`
- `fumble`
- `downs`
- `muffedKick`
- `blockedKick`

Rules:

- Use `result.nextPossession` where the projection layer needs the next team.
- Do not start drives in the builder.
- Do not infer turnover on downs; that belongs to projection unless FCQI records an explicit turnover-on-downs game-control/correction intent.

## 18. Description and Summary Text

FPSG owns wording. The Event Builder may copy the confirmed summary into:

- `event.description`
- `event.confirmation.summaryText`

Rules:

- Do not regenerate the summary inside the builder.
- Do not parse `description` to populate event fields.
- If the draft changes after summary generation, require FPSG to regenerate the summary before building.
- `description` should be treated as display metadata, not an authoritative data source.

## 19. Build Errors and Warnings

Errors should block event construction:

- `UNCONFIRMED_DRAFT`
- `SUMMARY_STALE`
- `STALE_BASE_SEQUENCE`
- `MISSING_CLIENT_EVENT_ID`
- `MISSING_PRE_STATE`
- `INVALID_TEAM_CODE`
- `INVALID_SPOT`
- `UNRESOLVED_PLAYER`
- `MISSING_REQUIRED_PARTICIPANT`
- `MISSING_REQUIRED_RESULT`
- `INVALID_PENALTY`
- `UNSUPPORTED_PLAY_FAMILY`

Warnings may allow construction but should be visible:

- `NON_RECOMMENDED_DUPLICATE_PLAYER_SELECTED`
- `UNUSUAL_POSITION_FOR_ACTION`
- `DESCRIPTION_OMITTED`
- `YARDS_OMITTED_COMPUTABLE_FROM_SPOTS`
- `OPTIONAL_DEFENDER_MISSING`
- `PENALTY_NOTES_PRESENT`

Warnings from FCQI and FPSG should be preserved and surfaced in the build result.

## 20. Idempotency and Concurrency

The builder should not generate a new `clientEventId` if FCQI already created one for the draft. The same confirmed draft should submit with the same `clientEventId`.

Rules:

- `clientContext.clientEventId` is required.
- `clientContext.baseEventSequence` is required.
- `clientContext.baseEnvelopeVersion` is recommended.
- If the envelope snapshot sequence does not match the draft's recorded base sequence, return `STALE_BASE_SEQUENCE`.
- Duplicate submit handling is backend-owned. The builder only preserves the idempotency key.

## 21. Unknown Player Policy

FCQI should resolve every jersey before confirmation.

The Event Builder should reject unresolved participants unless the canonical roster contract explicitly supports unknown players with traceable IDs.

If unknown players are allowed later, the builder must require:

- explicit unknown-player confirmation
- jersey
- team
- generated unknown player ID
- reason
- source token

No silent `null`, raw jersey, or display-name-only participant should be accepted.

## 22. Example Events

### Rush

```json
{
  "clientEventId": "fcqi-rush-1",
  "type": "rush",
  "subtype": null,
  "period": 1,
  "clock": "08:42",
  "possession": "H",
  "preState": {
    "possession": "H",
    "down": 2,
    "distance": 6,
    "yardLine": "H44",
    "lineToGain": "50",
    "driveId": "DRV-0002",
    "driveNumber": 2
  },
  "participants": {
    "primary": { "playerId": "H-22", "team": "H", "role": "rusher" },
    "secondary": null,
    "defenders": [
      { "playerId": "V-44", "team": "V", "role": "tackler" }
    ]
  },
  "result": {
    "code": "tackle",
    "yards": 7,
    "endYardLine": "V49",
    "firstDown": true,
    "driveEnds": false,
    "scoring": null,
    "turnover": null
  },
  "penalties": [],
  "description": "HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss."
}
```

### Pass Interception

```json
{
  "clientEventId": "fcqi-pass-int-1",
  "type": "pass",
  "subtype": "interception",
  "period": 2,
  "clock": "04:18",
  "possession": "H",
  "preState": {
    "possession": "H",
    "down": 3,
    "distance": 8,
    "yardLine": "H35",
    "lineToGain": "H43",
    "driveId": "DRV-0005",
    "driveNumber": 5
  },
  "participants": {
    "primary": { "playerId": "H-12", "team": "H", "role": "passer" },
    "secondary": { "playerId": "H-88", "team": "H", "role": "intendedReceiver" },
    "defenders": [
      { "playerId": "V-03", "team": "V", "role": "interceptor" },
      { "playerId": "H-22", "team": "H", "role": "tackler" }
    ]
  },
  "result": {
    "code": "interception",
    "endYardLine": "H24",
    "turnover": {
      "type": "interception",
      "team": "V",
      "playerId": "V-03",
      "spot": "H42",
      "returnYards": 18,
      "returnEndYardLine": "H24",
      "recoveredBy": "V"
    },
    "nextPossession": "V",
    "driveEnds": true
  },
  "penalties": [],
  "description": "HOM #12 Mason Reed pass intended for #88 Eli Grant intercepted by #3 at the H42, returned for 18 yards to the H24."
}
```

### Kickoff Touchback

```json
{
  "clientEventId": "fcqi-kickoff-1",
  "type": "kickoff",
  "subtype": "touchback",
  "period": 1,
  "clock": "15:00",
  "possession": "H",
  "preState": {
    "possession": null,
    "down": null,
    "distance": null,
    "yardLine": null,
    "lineToGain": null,
    "driveId": null,
    "driveNumber": 0
  },
  "participants": {
    "primary": { "playerId": "H-09", "team": "H", "role": "kicker" },
    "secondary": null,
    "defenders": []
  },
  "result": {
    "code": "touchback",
    "endYardLine": "V25",
    "nextPossession": "V"
  },
  "penalties": [],
  "description": "HOM #9 kickoff into the end zone, touchback."
}
```

### Penalty Attached To Play

```json
{
  "clientEventId": "fcqi-pass-penalty-1",
  "type": "pass",
  "subtype": "incomplete",
  "period": 2,
  "clock": "11:31",
  "possession": "H",
  "preState": {
    "possession": "H",
    "down": 3,
    "distance": 10,
    "yardLine": "H40",
    "lineToGain": "50",
    "driveId": "DRV-0004",
    "driveNumber": 4
  },
  "participants": {
    "primary": { "playerId": "H-12", "team": "H", "role": "passer" },
    "secondary": { "playerId": "H-88", "team": "H", "role": "intendedReceiver" },
    "defenders": []
  },
  "result": {
    "code": "incomplete",
    "endYardLine": "H40"
  },
  "penalties": [
    {
      "penaltyId": "pen-1",
      "team": "V",
      "code": "DPI",
      "name": "Defensive Pass Interference",
      "yards": 15,
      "spot": "H40",
      "enforcedFrom": "SPOT",
      "status": "accepted",
      "automaticFirstDown": true,
      "lossOfDown": false,
      "replayDown": false,
      "liveBall": true
    }
  ],
  "description": "HOM #12 Mason Reed pass incomplete intended for #88 Eli Grant. Penalty: Defensive Pass Interference on VIS, 15 yards from the spot, automatic first down."
}
```

## 23. Likely Future Files

Potential implementation files:

- `src/quick-input/footballEventBuilder.ts`
- `src/quick-input/footballEventBuilderTypes.ts`
- `src/quick-input/footballEventBuilderValidation.ts`
- `src/quick-input/footballEventBuilder.test.ts`

Likely integration points:

- `src/quick-input/footballConfirmedQuickInputMachine.ts`
- `src/quick-input/footballQuickInputSummary.ts`
- `src/quick-input/footballPlaySummaryGrammar.ts`
- `src/contexts/FootballGameContext.jsx`
- `src/utils/footballRulesEngine.js`
- `src/types/penalties.ts`
- `src/utils/penaltyRules.ts`
- `docs/strata-football-envelope-contracts.md`

## 24. Test Cases

Builder tests:

- rejects unconfirmed draft
- rejects stale summary revision
- rejects stale base event sequence
- rejects missing `clientEventId`
- rejects non-canonical team code
- rejects invalid spot
- rejects unresolved primary player
- rejects unresolved defender
- rejects unsupported play family

Mapping tests:

- builds rush event with rusher, tacklers, yards, and end spot
- builds rush touchdown with scoring metadata
- builds complete pass with passer and receiver
- builds incomplete pass with intended receiver
- builds sack as pass/sack with sack defenders
- builds interception with turnover metadata and next possession
- builds fumble retained by offense
- builds fumble recovered by defense with next possession
- builds punt fair catch with next possession
- builds punt return with returner and tacklers
- builds kickoff touchback without drive result text
- builds kickoff return with next possession
- builds field goal made with scoring metadata
- builds field goal missed with next possession metadata
- builds PAT kick made as try/kick
- builds two-point pass as try/pass
- builds penalty-only accepted event
- builds play with attached accepted penalty
- builds offsetting penalties

Boundary tests:

- does not assign `eventId`
- does not assign `sequence`
- does not assign `status`
- does not assign authoritative `postState`
- does not mutate input envelope
- preserves `clientEventId`
- preserves FPSG description without parsing it
- preserves FCQI warnings in build result

Projection handoff tests:

- built event can be consumed by the football rules/projection layer
- kickoff event leaves drive-result assignment to projection
- penalties carry typed flags used by projection
- turnover metadata is sufficient for projection to start the next drive
