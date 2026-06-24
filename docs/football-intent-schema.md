# Football Draft Intent Schema

## Purpose

`FootballDraftIntent` is the canonical object passed between:

```text
Football Confirmed Quick Input (FCQI)
  -> Football Play Summary Grammar (FPSG)
  -> Football Event Builder
```

FCQI owns collecting and validating this object. FPSG owns rendering human-readable summaries from it. The Football Event Builder owns converting a confirmed intent into canonical envelope event payloads.

Neither FPSG nor the Football Event Builder should invent fields that are not present in this schema. If a summary or event needs data, FCQI must collect, derive, validate, or explicitly leave that field absent before the intent reaches those downstream layers.

## Design Rules

- The intent is a draft, not an event.
- The intent is not submitted by FCQI or FPSG.
- The intent must be structurally complete before summary confirmation.
- Every jersey-based participant must resolve to a roster player or an explicit unknown-player model if that policy is later enabled.
- Penalties attach to the intent before final confirmation.
- Field positions use canonical football spot strings at this boundary.
- FPSG reads this object and emits summary text only.
- The Event Builder reads this object and emits canonical event payloads only.
- Projection, scoring, stats, drives, and post-play game state are not calculated here.
- FCQI operator result codes are compact input shortcuts, not final envelope result codes.
- FCQI must map operator result codes into canonical `FootballDraftIntent` fields before FPSG or the Event Builder reads the intent.
- Nested operator result codes are context-specific. For example, `C` means Complete in the primary Pass result step, but `C` means Lateral in the Complete result step.
- `.` is the canonical FCQI End of Play shortcut and must not be renamed.
- Operator-facing team aliases are input/display conveniences only. The canonical draft intent must store `TeamCode = 'H' | 'V'` and canonical `Spot` values. See `docs/football-operator-team-aliases.md`.

## TypeScript-Style Schema

```ts
type TeamCode = 'H' | 'V';
type Spot = `${TeamCode}${string}` | '50' | 'goal';
type ClockText = `${number}${number}:${number}${number}`;

type FootballPlayFamily =
  | 'rush'
  | 'pass'
  | 'punt'
  | 'kickoff'
  | 'fieldGoal'
  | 'try'
  | 'penalty'
  | 'gameControl';

type FootballPlaySubtype =
  | 'complete'
  | 'incomplete'
  | 'sack'
  | 'interception'
  | 'returned'
  | 'fairCatch'
  | 'downed'
  | 'touchback'
  | 'outOfBounds'
  | 'blocked'
  | 'muffed'
  | 'onside'
  | 'made'
  | 'missed'
  | 'kick'
  | 'rush'
  | 'pass'
  | 'failed'
  | 'defensiveReturn'
  | 'accepted'
  | 'declined'
  | 'offsetting'
  | null;

type FootballDraftIntentStatus =
  | 'collecting'
  | 'readyForSummary'
  | 'summaryGenerated'
  | 'confirmed'
  | 'cancelled';

type FootballDraftIntent = {
  schemaVersion: 'football.draftIntent.v1';
  intentId: string;
  clientEventId: string;
  status: FootballDraftIntentStatus;
  createdAt: string;
  updatedAt: string;
  revision: number;

  game: DraftGameContext;
  source: DraftSourceContext;
  play: DraftPlayContext;
  prePlay: DraftPrePlayContext;
  participants: DraftParticipants;
  result: DraftResult;
  penalties: DraftPenalty[];
  warnings: DraftWarning[];
  confirmation?: DraftConfirmation;
};
```

## Required Fields

Required top-level fields:

- `schemaVersion`
- `intentId`
- `clientEventId`
- `status`
- `createdAt`
- `updatedAt`
- `revision`
- `game`
- `source`
- `play`
- `prePlay`
- `participants`
- `result`
- `penalties`
- `warnings`

Required before `status: "readyForSummary"`:

- all required participants for the play family
- all required result fields for the play family
- canonical team codes
- canonical field positions for every known spot
- no unresolved required jersey token
- penalty records are structurally valid or intentionally absent

Required before `status: "confirmed"`:

- `confirmation.summaryText`
- `confirmation.summaryRevision`
- `confirmation.confirmedAt`
- `confirmation.confirmedByUserId` when the scorer identity is known
- `confirmation.operatorAction: "confirmSubmit"`

## Optional Fields

Optional fields should be present only when known:

- player display metadata, such as jersey, display name, and position
- optional defenders
- optional pass target
- optional returner
- optional fumble details
- optional turnover metadata
- optional scoring metadata
- optional penalty notes
- optional queued penalty request metadata while FCQI is still collecting a draft
- optional warnings
- optional trace/debug metadata

Optional does not mean downstream layers can invent the value. If absent, FPSG should omit or warn, and the Event Builder should either omit or reject based on play-family requirements.

## Team, Possession, And Game Context

```ts
type DraftGameContext = {
  gameId: string;
  homeTeamId?: string;
  visitorTeamId?: string;
  teams: {
    H: DraftTeamSummary;
    V: DraftTeamSummary;
  };
  rules?: DraftRulesSnapshot;
};

type DraftTeamSummary = {
  team: TeamCode;
  teamId?: string;
  name?: string;
  abbr: string;
};

type DraftRulesSnapshot = {
  periods?: number;
  minutesPerPeriod?: number;
  downs?: number;
  yardsToFirstDown?: number;
  kickoffSpot?: Spot;
  touchbackSpot?: Spot;
  patSpot?: Spot;
};

type DraftSourceContext = {
  kind: 'fcqi';
  startedBy: 'hotkey' | 'button' | 'programmatic';
  hotkey?: string;
  startedAt: string;
  baseEnvelopeVersion?: string;
  baseEventSequence: number;
  sessionId?: string;
  userId?: string;
};

type DraftPlayContext = {
  family: FootballPlayFamily;
  subtype: FootballPlaySubtype;
  actionTeam: TeamCode;
  possession: TeamCode | null;
  period: number;
  clock: ClockText | null;
  clockTenths?: number | null;
};
```

Rules:

- `TeamCode` must be `H` or `V`.
- Display labels such as `home`, `visitor`, `HOM`, or `VIS` are not valid canonical team values.
- Operator aliases such as team abbreviations, first-letter shortcuts, or custom spot prefixes must be normalized before they are stored in `FootballDraftIntent`.
- If FCQI preserves alias source metadata, it must be optional metadata and not a replacement for canonical team or spot fields.
- `actionTeam` is the team performing the primary action.
- `possession` is the offensive or kicking possession context when applicable.
- Kickoff and try contexts may use `prePlay.possession: null` while still carrying `play.actionTeam`.
- `baseEventSequence` is required for stale-state protection.

## Pre-Play Context

```ts
type DraftPrePlayContext = {
  possession: TeamCode | null;
  down: number | null;
  distance: number | null;
  yardLine: Spot | null;
  lineToGain: Spot | null;
  goalToGo?: boolean;
  redZone?: boolean;
  driveId: string | null;
  driveNumber: number;
};
```

Rules:

- Normal scrimmage plays require `possession`, `down`, `distance`, `yardLine`, and `lineToGain`.
- Kickoff may use `down`, `distance`, and `lineToGain` as `null`.
- Try/PAT may use `down`, `distance`, and `lineToGain` as `null`.
- `yardLine` must be canonical when present.
- FPSG may display the pre-play context but must not modify it.
- The Event Builder must copy this into event `preState` and must not calculate authoritative `postState`.

## Participant Model

```ts
type DraftParticipants = {
  primary?: DraftParticipant;
  secondary?: DraftParticipant;
  defenders: DraftParticipant[];
  returner?: DraftParticipant;
  kicker?: DraftParticipant;
  punter?: DraftParticipant;
  holder?: DraftParticipant;
  fumbler?: DraftParticipant;
  forcedBy?: DraftParticipant;
  recoveredBy?: DraftParticipant;
  penalizedPlayers: DraftParticipant[];
  others: DraftParticipant[];
};

type DraftParticipant = {
  participantId: string;
  playerId: string;
  team: TeamCode;
  role: DraftParticipantRole;
  jersey: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  resolution: DraftPlayerResolution;
};

type DraftParticipantRole =
  | 'rusher'
  | 'passer'
  | 'receiver'
  | 'intendedReceiver'
  | 'sackVictim'
  | 'punter'
  | 'kicker'
  | 'returner'
  | 'holder'
  | 'tackler'
  | 'assistTackler'
  | 'sack'
  | 'passBreakup'
  | 'interceptor'
  | 'fumbler'
  | 'forcedFumble'
  | 'recoverer'
  | 'blocker'
  | 'penalizedPlayer'
  | 'other';

type DraftPlayerResolution = {
  source: 'singleMatch' | 'duplicateConfirmed' | 'explicitUnknown';
  jerseyToken: string;
  teamScope: TeamCode;
  duplicateCandidateIds?: string[];
  recommendedPlayerId?: string;
  selectedRecommended?: boolean;
  actionContext: 'offense' | 'defense' | 'specialTeams' | 'penalty' | 'gameControl';
};
```

Rules:

- Required player participants must have `playerId`.
- `participantId` is a local stable ID inside the intent.
- `playerId` is the roster/canonical player ID used by the Event Builder.
- `jersey` remains available for FPSG display.
- Duplicate resolution metadata is preserved for warnings and auditability.
- If `source: "explicitUnknown"` is not supported by the current roster contract, validation must reject it before confirmation.

## Result Model

```ts
type DraftResult = {
  code: DraftResultCode;
  yards?: number;
  endYardLine?: Spot;
  firstDown?: boolean;
  driveEnds?: boolean;
  nextPossession?: TeamCode;
  operator?: DraftOperatorResultMetadata;

  pass?: DraftPassResult;
  kick?: DraftKickResult;
  return?: DraftReturnResult;
  laterals?: DraftLateralSegment[];
  fumble?: DraftFumbleResult;
  turnover?: DraftTurnoverResult;
  scoring?: DraftScoringResult;
};

type DraftResultCode =
  | 'tackle'
  | 'touchdown'
  | 'outOfBounds'
  | 'complete'
  | 'incomplete'
  | 'sack'
  | 'interception'
  | 'fumble'
  | 'safety'
  | 'returned'
  | 'fairCatch'
  | 'downed'
  | 'touchback'
  | 'blocked'
  | 'muffed'
  | 'onside'
  | 'made'
  | 'missed'
  | 'accepted'
  | 'declined'
  | 'offsetting'
  | 'noPlay';

type BaseTerminalResultCode = 'T' | 'O' | 'F' | 'C' | '.';
type RushOperatorResultCode = BaseTerminalResultCode;
type PrimaryPassOperatorResultCode = 'C' | 'I' | 'S' | 'F' | 'R' | 'X';
type CompletePassOperatorResultCode = BaseTerminalResultCode;
type ReturnOperatorResultCode = BaseTerminalResultCode;
type KickReceiveResultCode = 'R' | 'T' | 'C' | 'O' | 'M' | 'D';

type DraftOperatorResultMetadata = {
  inputScope:
    | 'terminal.result'
    | 'rush.result'
    | 'pass.primaryResult'
    | 'pass.completeResult'
    | 'kick.receiveResult'
    | 'return.result'
    | 'lateral.result';
  code:
    | RushOperatorResultCode
    | PrimaryPassOperatorResultCode
    | CompletePassOperatorResultCode
    | ReturnOperatorResultCode
    | KickReceiveResultCode;
  meaning: string;
};

type DraftPassResult = {
  targetPlayerId?: string;
  completed?: boolean;
  caughtAtYardLine?: Spot;
  completeResultCode?: CompletePassOperatorResultCode;
  intendedYardLine?: Spot;
  brokenUpByPlayerId?: string;
  hurriedByPlayerIds?: string[];
};

type DraftKickResult = {
  kickYards?: number;
  catchYardLine?: Spot;
  kickSpot?: Spot;
  attemptYards?: number;
  blockedByPlayerId?: string;
  receiveResultCode?: KickReceiveResultCode;
};

type DraftReturnResult = {
  type?: 'Fumble' | 'Interception' | 'Field Goal' | 'Kickoff' | 'Punt' | 'Try';
  returnerPlayerId?: string;
  returnYards?: number;
  returnStartYardLine?: Spot;
  returnEndYardLine?: Spot;
  resultCode?: ReturnOperatorResultCode;
  tackledByPlayerIds?: string[];
};

type DraftLateralContinuationType =
  | 'rush'
  | 'receiving'
  | 'fumbleReturn'
  | 'interceptionReturn'
  | 'kickReturn'
  | 'puntReturn'
  | 'fieldGoalReturn'
  | 'misc';

type DraftLateralSegment = {
  lateralFromPlayerId: string;
  lateralToPlayerId: string;
  lateralFromSpot: Spot;
  lateralToSpot: Spot;
  continuationType: DraftLateralContinuationType;
  continuationResult?: DraftOperatorResultMetadata;
  finalSpot?: Spot;
  nextSegmentId?: string;
  segmentId?: string;
};

type DraftFumbleResult = {
  fumblerPlayerId: string;
  forcedByPlayerId?: string;
  spot?: Spot;
  recoveredByPlayerId?: string;
  recoveredByTeam?: TeamCode;
  recoverySpot?: Spot;
  returnYards?: number;
  returnEndYardLine?: Spot;
  turnover?: boolean;
};

type DraftTurnoverResult = {
  type: 'interception' | 'fumble' | 'downs' | 'muffedKick' | 'blockedKick';
  team: TeamCode;
  playerId?: string;
  spot?: Spot;
  returnYards?: number;
  returnEndYardLine?: Spot;
  recoveredBy?: TeamCode;
};

type DraftScoringResult = {
  team: TeamCode;
  points: 1 | 2 | 3 | 6;
  type: 'touchdown' | 'fieldGoal' | 'patKick' | 'twoPoint' | 'safety' | 'defensiveConversion';
};
```

Rules:

- `result.code` is required for every intent.
- `result.endYardLine` is required for ball-changing plays unless the play family explicitly does not have a ball spot.
- FCQI should not prompt for yards on normal scrimmage plays. Yardage should be derived from `prePlay.yardLine`, the final spot, and possession/action team.
- `result.yards` should be present when FCQI can derive it, or omitted only when the canonical event/projection layer can compute it from spots.
- FPSG may format missing yardage from known spots only as display text when allowed by its rules.
- The Event Builder may pass missing yards through only when the canonical event/projection layer can compute them from `prePlay.yardLine` and `result.endYardLine`.
- `scoring` should exist only when the operator confirmed a scoring result.
- `turnover` should exist only when the operator confirmed a turnover result.
- `operator` metadata is optional but recommended when FCQI maps a shortcut into a different canonical result, such as Rush `.` mapping into a neutral dead-ball/tackle-like result or Pass Complete `C` mapping to lateral.
- `operator.inputScope` is required whenever an operator shortcut is preserved. Never interpret `T` or `C` without scope: `terminal.result:T` means Tackle, `terminal.result:C` means Lateral, `kick.receiveResult:T` means Touchback, and `kick.receiveResult:C` means Fair Catch.
- `laterals` is the shared live-ball continuation model for rushes, completed passes, fumble returns, interception returns, kickoff returns, punt returns, field goal returns, and any other live-ball continuation.
- `laterals` stores participants and spots only. Official stat allocation must be derived later using `docs/football-lateral-stat-allocation.md`.
- Lateral intent data must support the universal segment model: original play or return advancement, miscellaneous lateral exchange, then continuation-family advancement by the lateral receiver.
- FPSG and the Event Builder may read `operator` metadata for warnings and display context, but they must not invent it if FCQI did not provide it.

### FCQI Result-Code Semantics

Base terminal result codes:

- `T` = Tackle
- `O` = Out of Bounds
- `F` = Fumble
- `C` = Lateral
- `.` = End of Play

Base terminal result codes apply after an offensive live-ball action or after a live return has started. They do not describe the first receive result on a kickoff or punt.

Rush operator result codes:

- `T` = Tackle
- `O` = Out of Bounds
- `F` = Fumble
- `C` = Lateral
- `.` = End of Play

Primary Pass operator result codes:

- `C` = Complete
- `I` = Incomplete
- `S` = Sack
- `F` = Sack Fumble
- `R` = Rush Conversion
- `X` = Intercepted

Complete Pass nested result codes:

- `T` = Tackle
- `O` = Out of Bounds
- `F` = Fumble
- `C` = Lateral
- `.` = End of Play

Shared return terminal result codes:

- `T` = Tackle
- `O` = Out of Bounds
- `F` = Fumble
- `C` = Lateral
- `.` = End of Play

Kick receive result codes:

- `R` = Return
- `T` = Touchback
- `C` = Fair Catch
- `O` = Out of Bounds
- `M` = Muffed
- `D` = Downed

Important:

- `C` means Complete only at `pass.primaryResult`.
- `C` means Lateral at `pass.completeResult`, `terminal.result`, and return terminal result scopes.
- `C` means Fair Catch at `kick.receiveResult`.
- `T` means Tackle at terminal result scopes.
- `T` means Touchback at `kick.receiveResult`.
- Never interpret `C` or `T` without `inputScope`.

Rush mapping requirements:

- `T` maps to canonical `result.code: "tackle"` and requires at least one tackler.
- `O` maps to canonical `result.code: "outOfBounds"` and allows zero tacklers.
- `F` maps to a fumble-bearing result and requires fumble detail flow.
- `C` starts lateral flow; if unsupported, it blocks and should not produce a ready intent.
- `.` ends the play without tacklers and should preserve the operator source code when mapped to a canonical neutral result.

Pass mapping requirements:

- `C` primary pass requires receiver, optional caught-at spot, complete result code, and end yardline.
- `I` requires intended receiver and may include intended yardline, pass breakup, and hurry metadata.
- `X` follows incomplete-pass targeting prompts, then starts interception return flow.
- `S` requires one or two sack defenders and sack yardline.
- `F` follows sack prompts, then starts fumble flow using sack yardline as the fumble spot.
- `R` stops pass collection and transforms into Rush FCQI with the resolved passer as default rusher; it must not produce a pass intent.

Shared continuation requirements:

- Fumble flow requires `forcedBy`, `recoverTeam`, `recoverPlayer`, `recoverSpot`, and `returned`.
- Kick receiving uses `KickReceiveResultCode`. `T` Touchback, `C` Fair Catch, and `D` Downed are terminal receive results and do not create Shared Return Flow.
- Kick receive `R` Return starts Shared Return Flow.
- Kick receive `M` Muffed requires recovery details and may continue into return flow when applicable.
- Kick receive `O` Out of Bounds is a kick result, not a return terminal result.
- Shared Return Flow uses `type`, `returner`, `fromSpot`, terminal result, terminal-result details, and `toSpot`.
- Return flow must preserve `type` because interception, fumble, kickoff, punt, field-goal, and try returns allocate different stats.
- Lateral flow uses ordered `DraftLateralSegment` entries with `lateralFromPlayerId`, `lateralToPlayerId`, `lateralFromSpot`, `lateralToSpot`, `continuationType`, `continuationResult`, and either `finalSpot` or a next segment.
- Lateral from a return must preserve continuation type for stat allocation.
- Unsupported fumble, return, or lateral continuations must block safely and must not build incomplete events.

## Penalty Model

```ts
type DraftPenalty = {
  penaltyId: string;
  team: TeamCode;
  code: string;
  name?: string;
  resolution: DraftPenaltyResolution;
  yards?: number;
  playerId?: string | null;
  spot?: Spot;
  spotOfFoul?: Spot;
  finalSpot?: Spot;
  enforcedFrom?: DraftPenaltyEnforcementSpot;
  downConsequence?: DraftPenaltyDownConsequence;
  source: DraftPenaltySource;
  status: DraftPenaltyStatus;
  accepted: boolean;
  offsetting?: DraftPenaltyOffsetting;
  automaticFirstDown?: boolean;
  lossOfDown?: boolean;
  replayDown?: boolean;
  liveBall?: boolean;
  safetyByRule?: boolean;
  carryOverToKO?: boolean;
  notes?: string;
  penalizedPlayerId?: string;
};

type DraftPenaltyResolution = 'accepted' | 'declined' | 'offsetting';

type DraftPenaltyEnforcementSpot =
  | 'PREVIOUS'
  | 'SPOT'
  | 'END'
  | 'TRY'
  | 'FREE_KICK'
  | 'SUCCESSFUL_TD';

type DraftPenaltyDownConsequence = 'REPEAT' | 'LOSS_OF_DOWN' | 'AUTO_FIRST';

type DraftPenaltySource = 'immediate' | 'queued';

type DraftPenaltyStatus = 'accepted' | 'declined' | 'offsetting' | 'pending';

type DraftPenaltyOffsetting = {
  previousPlayCounts: boolean;
};
```

Rules:

- Penalties must be typed objects, not free text.
- `penaltyId`, `team`, `code`, `name`, `resolution`, `source`, `status`, and `accepted` are required.
- `accepted` mirrors `status === "accepted"` for compatibility with existing UI penalty structures.
- `status: "offsetting"` should use `accepted: false`.
- Penalty definitions may require `yards` and `spot`.
- `automaticFirstDown`, `lossOfDown`, and `replayDown` are explicit flags; downstream layers must not infer them from text.
- Penalty-only intents use `play.family: "penalty"` and still require summary confirmation.
- Declined penalties are terminal and do not require `yards`, `enforcedFrom`, `spotOfFoul`, `finalSpot`, or down enforcement details.
- Offsetting penalties require at least one penalty on each team; a single-team offsetting penalty is invalid.
- Offsetting penalties require an explicit `offsetting.previousPlayCounts` boolean or equivalent typed `playCounts` field.
- `previousPlayCounts: false` means offsetting fouls during the play: the previous play is cancelled, play stats are nullified, the ball returns to the previous spot unless projection/rules later determine otherwise, and down is repeated unless rules specify otherwise.
- `previousPlayCounts: true` means offsetting fouls after the play: the previous play counts, play stats remain, and projection keeps the play result as the base state while recording offsetting fouls after the result.
- Accepted immediate penalties force `enforcedFrom: "PREVIOUS"` and `downConsequence: "REPEAT"`.
- Accepted queued penalties attached to a play allow `enforcedFrom: "PREVIOUS"`, `enforcedFrom: "SPOT"`, or the succeeding/end-spot equivalent, and allow `downConsequence: "REPEAT"`, `"LOSS_OF_DOWN"`, or `"AUTO_FIRST"`.
- `enforcedFrom: "SPOT"` requires `spotOfFoul`.
- Accepted penalties require `finalSpot`.
- `playerId` is optional and nullable. If present, it must resolve through the active roster; if absent, the penalty is team-only.
- `source: "queued"` means the penalty was resolved from a queued marker. The unresolved marker itself is not a `DraftPenalty`.

### Immediate And Queued Penalty Semantics

Immediate penalty mode starts from `E` and opens penalty entry immediately. It can produce a penalty-only intent or attach typed penalty objects to a play draft, but still requires summary confirmation before build or submit.

Queued penalty mode starts from `Shift+E` during an active play flow. It records that the operator noticed a penalty without interrupting current token collection.

Queued penalty rules:

- A queued penalty marker is draft metadata, not a valid final penalty object by itself.
- A queued penalty may be represented during collection as `queuedPenaltyRequested: true` or equivalent FCQI-only metadata.
- `Shift+E` toggles the unresolved marker: first press queues it, second press removes it.
- Before final confirmation, every queued penalty must be resolved into a `DraftPenalty`, edited, or removed.
- `status: "pending"` blocks confirmation.
- FPSG should show queued or resolved penalties in summary review.
- The Event Builder must not build an event from an unresolved queued penalty marker.

### Penalty Enforcement Semantics

`Previous Spot` nullifies the previous play. The play does not count statistically, and enforcement starts from the pre-play yardline.

`Succeeding Spot` means the play counts in its entirety. Projection keeps play stats and enforces from the play result final spot.

`Spot of Foul` means the play is counted only up to the spot of foul. Projection must trim or augment the play result to the foul spot, count stats only through that spot, and enforce from that spot.

Example:

- Start: `H46`
- Rush: `#22` to `V35`
- Holding by `H56` at `V45`
- Stats count from `H46` to `V45`: gain of 9 yards
- Enforce 10 yards from `V45` to `H45`

Down consequences:

- `REPEAT`: down does not increment.
- `LOSS_OF_DOWN`: down increments.
- `AUTO_FIRST`: down becomes first, and the line to gain is 10 yards from the penalty final spot.

## Warnings And Confirmation Metadata

```ts
type DraftWarning = {
  code: DraftWarningCode;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
  field?: string;
  source: 'fcqi' | 'fpsg' | 'eventBuilder';
};

type DraftWarningCode =
  | 'UNRESOLVED_PLAYER'
  | 'DUPLICATE_PLAYER_CONFIRMED'
  | 'NON_RECOMMENDED_DUPLICATE_PLAYER_SELECTED'
  | 'UNUSUAL_POSITION_FOR_ACTION'
  | 'MISSING_OPTIONAL_DEFENDER'
  | 'MISSING_YARDS'
  | 'MISSING_SPOT'
  | 'INVALID_SPOT'
  | 'PENALTY_PENDING'
  | 'PENALTY_MISSING_YARDS'
  | 'PENALTY_MISSING_SPOT'
  | 'STALE_BASE_SEQUENCE'
  | 'SUMMARY_STALE'
  | 'UNSUPPORTED_PLAY_FAMILY';

type DraftConfirmation = {
  summaryText: string;
  summaryRevision: number;
  confirmedAt: string;
  confirmedByUserId?: string;
  operatorAction: 'confirmSubmit';
  penaltiesReviewed: boolean;
  warningsAcknowledged: string[];
};
```

Rules:

- `blocker` warnings must prevent confirmation.
- FPSG should preserve existing warnings and may add display warnings.
- Event Builder should preserve existing warnings and may add build warnings.
- `confirmation.summaryRevision` must match `revision`.
- If any field changes after confirmation, FCQI must clear `confirmation` and increment `revision`.

## Validation Rules

General validation:

- `schemaVersion` must be `football.draftIntent.v1`.
- `intentId` and `clientEventId` are required and stable for the draft lifecycle.
- `revision` increments after every material change.
- `status: "confirmed"` requires valid confirmation metadata.
- `source.baseEventSequence` is required.
- `play.family` must be supported.
- `play.actionTeam` must be `H` or `V`.
- `play.possession` must be `H`, `V`, or `null`.
- `prePlay` must match the base envelope snapshot used by FCQI.
- Every required `Spot` must be canonical.
- Operator team aliases must not appear in persisted canonical team fields.
- Operator spot prefixes must not appear in persisted canonical spot fields.

Participant validation:

- Rush requires `participants.primary` with role `rusher`.
- Pass requires `participants.primary` with role `passer`.
- Complete pass requires a receiver.
- Incomplete pass should include an intended receiver when known.
- Sack requires a passer/sack victim and at least one sack defender when known.
- Interception requires an interceptor.
- Punt requires a punter.
- Kickoff requires a kicker.
- Field goal requires a kicker.
- PAT kick requires a kicker.
- Two-point pass requires passer and receiver.
- Two-point rush requires rusher.
- Penalty-only requires at least one penalty.

Result validation:

- Rush requires `result.code`, `result.endYardLine`, and yardage or computable spots.
- Rush FCQI operator result code must be one of `T`, `O`, `F`, `C`, `.`.
- Rush `T` requires at least one tackler.
- Rush `O` allows zero tacklers.
- Rush `.` skips tacklers.
- Complete pass requires `result.code: "complete"`, receiver, and end spot.
- Primary Pass FCQI operator result code must be one of `C`, `I`, `S`, `F`, `R`, `X`.
- Complete Pass nested operator result code must be one of `T`, `O`, `F`, `C`, `.`.
- Complete Pass `C` at the nested result-code step means Lateral, not Complete.
- Complete Pass requires receiver and end yardline.
- Incomplete pass requires `result.code: "incomplete"`.
- Incomplete and intercepted pass require intended receiver.
- Broken up allows exactly one defender.
- Hurried allows up to three defenders.
- Sack requires `result.code: "sack"` and an end spot.
- Sack and sack fumble require one or two sack defenders and a sack yardline.
- Interception requires `result.turnover`.
- Interception must launch return flow and must not be marked ready until return requirements are satisfied or safely blocked.
- Fumble with possession change requires `result.turnover` and `result.fumble`.
- Sack fumble and completed-pass fumble must launch fumble flow.
- Completed-pass lateral must launch the shared lateral flow.
- Any lateral from rush, pass, fumble return, interception return, kickoff return, punt return, field goal return, or another live-ball continuation must include complete `DraftLateralSegment` data before confirmation.
- Each lateral segment requires from-player, to-player, from-spot, to-spot, continuation type, and a terminal final spot or next segment.
- Lateral validation must not allocate official rushing, receiving, return, or miscellaneous yards; allocation is derived by projection using `docs/football-lateral-stat-allocation.md`.
- Lateral validation must not imply that all post-catch or post-return advancement is miscellaneous. Only `lateralFromSpot -> lateralToSpot` is miscellaneous; `lateralToSpot -> nextTerminalSpot` belongs to the continuation stat family.
- Receiving a lateral must not create a new rushing, receiving, or return attempt.
- Fumble, lateral, and return flows must block safely if not fully implemented.
- Rush conversion must relaunch Rush FCQI with the resolved passer as the default rusher and must not build a pass event.
- Punt receiving requires a scoped kick receive result code. Punt receive `R` starts Shared Return Flow; `C` Fair Catch and `D` Downed end without return terminal result flow.
- Kickoff receiving requires a scoped kick receive result code, end spot or rules-derived touchback spot, and `nextPossession`. Kickoff receive `R` starts Shared Return Flow.
- Kick touchback and fair catch are terminal receive results, not generic offensive terminal results.
- Field goal requires made/missed/blocked result and attempt context.
- PAT requires try subtype and scoring or failed result.
- Penalty-only requires accepted/declined/offsetting penalty resolution.

Penalty validation:

- Every penalty requires `penaltyId`, `team`, `code`, `enforcedFrom`, `status`, and `accepted`.
- `status: "pending"` blocks confirmation.
- Penalties requiring yards must include `yards`.
- Penalties requiring a spot must include `spot`.
- Offsetting penalties require at least two penalties.

Downstream validation:

- FPSG must not render data that is not in the intent.
- Event Builder must not build event fields from FPSG prose.
- Event Builder must reject confirmed intents with stale summary revisions.
- Event Builder must reject confirmed intents whose base sequence no longer matches the envelope snapshot.

## Example: Rush

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-rush-1",
  "clientEventId": "client-rush-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:00:00Z",
  "updatedAt": "2026-06-20T00:00:05Z",
  "revision": 2,
  "game": {
    "gameId": "FB-1001",
    "teams": {
      "H": { "team": "H", "teamId": "TEAM-H", "name": "Home State", "abbr": "HOM" },
      "V": { "team": "V", "teamId": "TEAM-V", "name": "Visitor Tech", "abbr": "VIS" }
    }
  },
  "source": {
    "kind": "fcqi",
    "startedBy": "hotkey",
    "hotkey": "R",
    "startedAt": "2026-06-20T00:00:00Z",
    "baseEnvelopeVersion": "2026-06-20T00:00:00Z",
    "baseEventSequence": 41,
    "sessionId": "scorer-session-1",
    "userId": "user-123"
  },
  "play": {
    "family": "rush",
    "subtype": null,
    "actionTeam": "H",
    "possession": "H",
    "period": 1,
    "clock": "08:42"
  },
  "prePlay": {
    "possession": "H",
    "down": 2,
    "distance": 6,
    "yardLine": "H44",
    "lineToGain": "50",
    "driveId": "DRV-0002",
    "driveNumber": 2
  },
  "participants": {
    "primary": {
      "participantId": "p1",
      "playerId": "H-22",
      "team": "H",
      "role": "rusher",
      "jersey": "22",
      "displayName": "Jordan Smith",
      "position": "RB",
      "resolution": {
        "source": "singleMatch",
        "jerseyToken": "22",
        "teamScope": "H",
        "actionContext": "offense"
      }
    },
    "defenders": [
      {
        "participantId": "p2",
        "playerId": "V-44",
        "team": "V",
        "role": "tackler",
        "jersey": "44",
        "displayName": "Caleb Moss",
        "position": "LB",
        "resolution": {
          "source": "singleMatch",
          "jerseyToken": "44",
          "teamScope": "V",
          "actionContext": "defense"
        }
      }
    ],
    "penalizedPlayers": [],
    "others": []
  },
  "result": {
    "code": "tackle",
    "yards": 7,
    "endYardLine": "V49",
    "firstDown": true,
    "driveEnds": false
  },
  "penalties": [],
  "warnings": [],
  "confirmation": {
    "summaryText": "HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.",
    "summaryRevision": 2,
    "confirmedAt": "2026-06-20T00:00:05Z",
    "confirmedByUserId": "user-123",
    "operatorAction": "confirmSubmit",
    "penaltiesReviewed": true,
    "warningsAcknowledged": []
  }
}
```

## Example: Pass Complete

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-pass-complete-1",
  "clientEventId": "client-pass-complete-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:01:00Z",
  "updatedAt": "2026-06-20T00:01:06Z",
  "revision": 3,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "hotkey", "hotkey": "P", "startedAt": "2026-06-20T00:01:00Z", "baseEventSequence": 42 },
  "play": { "family": "pass", "subtype": "complete", "actionTeam": "H", "possession": "H", "period": 1, "clock": "07:58" },
  "prePlay": { "possession": "H", "down": 1, "distance": 10, "yardLine": "V49", "lineToGain": "V39", "driveId": "DRV-0002", "driveNumber": 2 },
  "participants": {
    "primary": {
      "participantId": "p1",
      "playerId": "H-12",
      "team": "H",
      "role": "passer",
      "jersey": "12",
      "displayName": "Mason Reed",
      "position": "QB",
      "resolution": { "source": "singleMatch", "jerseyToken": "12", "teamScope": "H", "actionContext": "offense" }
    },
    "secondary": {
      "participantId": "p2",
      "playerId": "H-88",
      "team": "H",
      "role": "receiver",
      "jersey": "88",
      "displayName": "Eli Grant",
      "position": "TE",
      "resolution": { "source": "singleMatch", "jerseyToken": "88", "teamScope": "H", "actionContext": "offense" }
    },
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": {
    "code": "complete",
    "yards": 12,
    "endYardLine": "V37",
    "firstDown": true,
    "pass": { "targetPlayerId": "H-88", "completed": true }
  },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #12 Mason Reed pass complete to #88 Eli Grant for 12 yards to the V37.", "summaryRevision": 3, "confirmedAt": "2026-06-20T00:01:06Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Pass Incomplete

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-pass-incomplete-1",
  "clientEventId": "client-pass-incomplete-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:02:00Z",
  "updatedAt": "2026-06-20T00:02:04Z",
  "revision": 2,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "hotkey", "hotkey": "P", "startedAt": "2026-06-20T00:02:00Z", "baseEventSequence": 43 },
  "play": { "family": "pass", "subtype": "incomplete", "actionTeam": "H", "possession": "H", "period": 1, "clock": "07:21" },
  "prePlay": { "possession": "H", "down": 1, "distance": 10, "yardLine": "V37", "lineToGain": "V27", "driveId": "DRV-0002", "driveNumber": 2 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-12", "team": "H", "role": "passer", "jersey": "12", "displayName": "Mason Reed", "position": "QB", "resolution": { "source": "singleMatch", "jerseyToken": "12", "teamScope": "H", "actionContext": "offense" } },
    "secondary": { "participantId": "p2", "playerId": "H-04", "team": "H", "role": "intendedReceiver", "jersey": "4", "displayName": "Andre Lane", "position": "WR", "resolution": { "source": "singleMatch", "jerseyToken": "4", "teamScope": "H", "actionContext": "offense" } },
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": {
    "code": "incomplete",
    "endYardLine": "V37",
    "pass": { "targetPlayerId": "H-04", "completed": false }
  },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #12 Mason Reed pass incomplete intended for #4 Andre Lane.", "summaryRevision": 2, "confirmedAt": "2026-06-20T00:02:04Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Sack

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-sack-1",
  "clientEventId": "client-sack-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:03:00Z",
  "updatedAt": "2026-06-20T00:03:05Z",
  "revision": 3,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "button", "startedAt": "2026-06-20T00:03:00Z", "baseEventSequence": 44 },
  "play": { "family": "pass", "subtype": "sack", "actionTeam": "H", "possession": "H", "period": 1, "clock": "06:44" },
  "prePlay": { "possession": "H", "down": 2, "distance": 10, "yardLine": "V37", "lineToGain": "V27", "driveId": "DRV-0002", "driveNumber": 2 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-12", "team": "H", "role": "sackVictim", "jersey": "12", "displayName": "Mason Reed", "position": "QB", "resolution": { "source": "singleMatch", "jerseyToken": "12", "teamScope": "H", "actionContext": "offense" } },
    "defenders": [
      { "participantId": "p2", "playerId": "V-44", "team": "V", "role": "sack", "jersey": "44", "displayName": "Caleb Moss", "position": "LB", "resolution": { "source": "singleMatch", "jerseyToken": "44", "teamScope": "V", "actionContext": "defense" } }
    ],
    "penalizedPlayers": [],
    "others": []
  },
  "result": { "code": "sack", "yards": -6, "endYardLine": "V43" },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #12 Mason Reed sacked by #44 Caleb Moss for loss of 6 yards to the V43.", "summaryRevision": 3, "confirmedAt": "2026-06-20T00:03:05Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Interception

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-int-1",
  "clientEventId": "client-int-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:04:00Z",
  "updatedAt": "2026-06-20T00:04:09Z",
  "revision": 4,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "button", "startedAt": "2026-06-20T00:04:00Z", "baseEventSequence": 45 },
  "play": { "family": "pass", "subtype": "interception", "actionTeam": "H", "possession": "H", "period": 1, "clock": "06:01" },
  "prePlay": { "possession": "H", "down": 3, "distance": 16, "yardLine": "V43", "lineToGain": "V27", "driveId": "DRV-0002", "driveNumber": 2 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-12", "team": "H", "role": "passer", "jersey": "12", "displayName": "Mason Reed", "position": "QB", "resolution": { "source": "singleMatch", "jerseyToken": "12", "teamScope": "H", "actionContext": "offense" } },
    "secondary": { "participantId": "p2", "playerId": "H-88", "team": "H", "role": "intendedReceiver", "jersey": "88", "displayName": "Eli Grant", "position": "TE", "resolution": { "source": "singleMatch", "jerseyToken": "88", "teamScope": "H", "actionContext": "offense" } },
    "defenders": [
      { "participantId": "p3", "playerId": "V-03", "team": "V", "role": "interceptor", "jersey": "3", "displayName": "Smith", "position": "OLB", "resolution": { "source": "duplicateConfirmed", "jerseyToken": "3", "teamScope": "V", "duplicateCandidateIds": ["V-03A", "V-03B", "V-03C"], "recommendedPlayerId": "V-03B", "selectedRecommended": true, "actionContext": "defense" } }
    ],
    "penalizedPlayers": [],
    "others": []
  },
  "result": {
    "code": "interception",
    "endYardLine": "H24",
    "turnover": { "type": "interception", "team": "V", "playerId": "V-03", "spot": "H42", "returnYards": 18, "returnEndYardLine": "H24", "recoveredBy": "V" },
    "nextPossession": "V"
  },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #12 Mason Reed pass intended for #88 Eli Grant intercepted by #3 Smith at the H42, returned for 18 yards to the H24.", "summaryRevision": 4, "confirmedAt": "2026-06-20T00:04:09Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Fumble

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-fumble-1",
  "clientEventId": "client-fumble-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:05:00Z",
  "updatedAt": "2026-06-20T00:05:07Z",
  "revision": 3,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "hotkey", "hotkey": "R", "startedAt": "2026-06-20T00:05:00Z", "baseEventSequence": 46 },
  "play": { "family": "rush", "subtype": null, "actionTeam": "H", "possession": "H", "period": 2, "clock": "11:02" },
  "prePlay": { "possession": "H", "down": 1, "distance": 10, "yardLine": "H30", "lineToGain": "H40", "driveId": "DRV-0003", "driveNumber": 3 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-22", "team": "H", "role": "rusher", "jersey": "22", "displayName": "Jordan Smith", "position": "RB", "resolution": { "source": "singleMatch", "jerseyToken": "22", "teamScope": "H", "actionContext": "offense" } },
    "fumbler": { "participantId": "p1", "playerId": "H-22", "team": "H", "role": "fumbler", "jersey": "22", "displayName": "Jordan Smith", "position": "RB", "resolution": { "source": "singleMatch", "jerseyToken": "22", "teamScope": "H", "actionContext": "offense" } },
    "recoveredBy": { "participantId": "p2", "playerId": "V-44", "team": "V", "role": "recoverer", "jersey": "44", "displayName": "Caleb Moss", "position": "LB", "resolution": { "source": "singleMatch", "jerseyToken": "44", "teamScope": "V", "actionContext": "defense" } },
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": {
    "code": "fumble",
    "yards": 5,
    "endYardLine": "H35",
    "fumble": { "fumblerPlayerId": "H-22", "spot": "H35", "recoveredByPlayerId": "V-44", "recoveredByTeam": "V", "recoverySpot": "H35", "turnover": true },
    "turnover": { "type": "fumble", "team": "V", "playerId": "V-44", "spot": "H35", "recoveredBy": "V" },
    "nextPossession": "V"
  },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #22 Jordan Smith fumbled at the H35, recovered by #44 Caleb Moss for VIS at the H35.", "summaryRevision": 3, "confirmedAt": "2026-06-20T00:05:07Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Punt

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-punt-1",
  "clientEventId": "client-punt-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:06:00Z",
  "updatedAt": "2026-06-20T00:06:05Z",
  "revision": 2,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "hotkey", "hotkey": "U", "startedAt": "2026-06-20T00:06:00Z", "baseEventSequence": 47 },
  "play": { "family": "punt", "subtype": "returned", "actionTeam": "H", "possession": "H", "period": 2, "clock": "09:48" },
  "prePlay": { "possession": "H", "down": 4, "distance": 8, "yardLine": "H32", "lineToGain": "H40", "driveId": "DRV-0003", "driveNumber": 3 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-09", "team": "H", "role": "punter", "jersey": "9", "displayName": "Owen Clark", "position": "P", "resolution": { "source": "singleMatch", "jerseyToken": "9", "teamScope": "H", "actionContext": "specialTeams" } },
    "returner": { "participantId": "p2", "playerId": "V-03", "team": "V", "role": "returner", "jersey": "3", "displayName": "Davis", "position": "PR", "resolution": { "source": "duplicateConfirmed", "jerseyToken": "3", "teamScope": "V", "duplicateCandidateIds": ["V-03A", "V-03B", "V-03C"], "recommendedPlayerId": "V-03C", "selectedRecommended": true, "actionContext": "specialTeams" } },
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": {
    "code": "returned",
    "endYardLine": "V31",
    "nextPossession": "V",
    "driveEnds": true,
    "kick": { "kickYards": 42, "catchYardLine": "V26" },
    "return": { "returnerPlayerId": "V-03", "returnYards": 5, "returnStartYardLine": "V26", "returnEndYardLine": "V31" }
  },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #9 Owen Clark punt 42 yards to the V26, #3 Davis return for 5 yards to the V31.", "summaryRevision": 2, "confirmedAt": "2026-06-20T00:06:05Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Kickoff

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-kickoff-1",
  "clientEventId": "client-kickoff-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:07:00Z",
  "updatedAt": "2026-06-20T00:07:04Z",
  "revision": 2,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } }, "rules": { "touchbackSpot": "V25" } },
  "source": { "kind": "fcqi", "startedBy": "hotkey", "hotkey": "K", "startedAt": "2026-06-20T00:07:00Z", "baseEventSequence": 48 },
  "play": { "family": "kickoff", "subtype": "touchback", "actionTeam": "H", "possession": "H", "period": 1, "clock": "15:00" },
  "prePlay": { "possession": null, "down": null, "distance": null, "yardLine": null, "lineToGain": null, "driveId": null, "driveNumber": 0 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-09", "team": "H", "role": "kicker", "jersey": "9", "displayName": "Owen Clark", "position": "K", "resolution": { "source": "singleMatch", "jerseyToken": "9", "teamScope": "H", "actionContext": "specialTeams" } },
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": { "code": "touchback", "endYardLine": "V25", "nextPossession": "V" },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #9 Owen Clark kickoff into the end zone, touchback.", "summaryRevision": 2, "confirmedAt": "2026-06-20T00:07:04Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Field Goal

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-fg-1",
  "clientEventId": "client-fg-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:08:00Z",
  "updatedAt": "2026-06-20T00:08:06Z",
  "revision": 2,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "hotkey", "hotkey": "K", "startedAt": "2026-06-20T00:08:00Z", "baseEventSequence": 49 },
  "play": { "family": "fieldGoal", "subtype": "made", "actionTeam": "H", "possession": "H", "period": 2, "clock": "00:02" },
  "prePlay": { "possession": "H", "down": 4, "distance": 5, "yardLine": "V18", "lineToGain": "V13", "driveId": "DRV-0004", "driveNumber": 4 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-09", "team": "H", "role": "kicker", "jersey": "9", "displayName": "Owen Clark", "position": "K", "resolution": { "source": "singleMatch", "jerseyToken": "9", "teamScope": "H", "actionContext": "specialTeams" } },
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": {
    "code": "made",
    "endYardLine": "V18",
    "driveEnds": true,
    "kick": { "attemptYards": 35, "kickSpot": "V18" },
    "scoring": { "team": "H", "points": 3, "type": "fieldGoal" }
  },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #9 Owen Clark 35-yard field goal good.", "summaryRevision": 2, "confirmedAt": "2026-06-20T00:08:06Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: PAT

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-pat-1",
  "clientEventId": "client-pat-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:09:00Z",
  "updatedAt": "2026-06-20T00:09:04Z",
  "revision": 2,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } }, "rules": { "patSpot": "V03" } },
  "source": { "kind": "fcqi", "startedBy": "button", "startedAt": "2026-06-20T00:09:00Z", "baseEventSequence": 50 },
  "play": { "family": "try", "subtype": "kick", "actionTeam": "H", "possession": "H", "period": 2, "clock": "00:00" },
  "prePlay": { "possession": "H", "down": null, "distance": null, "yardLine": "V03", "lineToGain": null, "driveId": null, "driveNumber": 4 },
  "participants": {
    "primary": { "participantId": "p1", "playerId": "H-09", "team": "H", "role": "kicker", "jersey": "9", "displayName": "Owen Clark", "position": "K", "resolution": { "source": "singleMatch", "jerseyToken": "9", "teamScope": "H", "actionContext": "specialTeams" } },
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": { "code": "made", "kick": { "kickSpot": "V03" }, "scoring": { "team": "H", "points": 1, "type": "patKick" } },
  "penalties": [],
  "warnings": [],
  "confirmation": { "summaryText": "HOM #9 Owen Clark extra point good.", "summaryRevision": 2, "confirmedAt": "2026-06-20T00:09:04Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Example: Penalty-Only

```json
{
  "schemaVersion": "football.draftIntent.v1",
  "intentId": "intent-penalty-only-1",
  "clientEventId": "client-penalty-only-1",
  "status": "confirmed",
  "createdAt": "2026-06-20T00:10:00Z",
  "updatedAt": "2026-06-20T00:10:05Z",
  "revision": 2,
  "game": { "gameId": "FB-1001", "teams": { "H": { "team": "H", "abbr": "HOM" }, "V": { "team": "V", "abbr": "VIS" } } },
  "source": { "kind": "fcqi", "startedBy": "hotkey", "hotkey": "E", "startedAt": "2026-06-20T00:10:00Z", "baseEventSequence": 51 },
  "play": { "family": "penalty", "subtype": "accepted", "actionTeam": "V", "possession": "H", "period": 3, "clock": "12:11" },
  "prePlay": { "possession": "H", "down": 2, "distance": 7, "yardLine": "H43", "lineToGain": "50", "driveId": "DRV-0005", "driveNumber": 5 },
  "participants": {
    "defenders": [],
    "penalizedPlayers": [],
    "others": []
  },
  "result": { "code": "accepted", "endYardLine": "H48", "firstDown": false },
  "penalties": [
    {
      "penaltyId": "pen-1",
      "team": "V",
      "code": "OFF",
      "name": "Offside",
      "yards": 5,
      "enforcedFrom": "PREVIOUS",
      "status": "accepted",
      "accepted": true,
      "automaticFirstDown": false,
      "lossOfDown": false,
      "replayDown": false,
      "liveBall": true
    }
  ],
  "warnings": [],
  "confirmation": { "summaryText": "Penalty: Offside on VIS, 5 yards from the previous spot, accepted.", "summaryRevision": 2, "confirmedAt": "2026-06-20T00:10:05Z", "operatorAction": "confirmSubmit", "penaltiesReviewed": true, "warningsAcknowledged": [] }
}
```

## Game Control Intent Guidance

Game Control is the non-play FCQI family for operator controls that affect game state rather than recording a normal football play. Canonical internal team codes remain `H` / `V`.

Future drafts should use:

```ts
type GameControlSubtype =
  | 'startQuarter'
  | 'endQuarter'
  | 'setBallContext'
  | 'startDrive'
  | 'setPossession'
  | 'coinToss'
  | 'emergency'
  | 'rosterFunction';

type DraftGameControlResult = {
  action:
    | 'startQuarter'
    | 'endQuarter'
    | 'setBallContext'
    | 'startDrive'
    | 'setPossession'
    | 'coinToss'
    | 'emergency'
    | 'rosterFunction';
  period?: number;
  clock?: ClockText | null;
  down?: number;
  distance?: number;
  spot?: Spot;
  lineToGain?: Spot;
  possession?: TeamCode;
  driveId?: string;
};
```

Ball Context semantics:

- Collect `down`, `distance`, and `spot`.
- Calculate `lineToGain = spot + distance` from the current possession/action-team perspective.
- Do not persist operator aliases; draft intents store canonical team and spot values.
- Do not manually patch scorer UI. The accepted backend/projection response owns the live state.

Visibility and scaffold rules:

- `Coin Toss` is pregame/start-game only and should be hidden unless reliable pregame detection is available.
- Emergency is reserved for manual repair/correction controls.
- Roster Functions are planned for Starters, Rosters, and Uni Change.
- Until a canonical game-control submit path exists, FCQI should safe-block these controls and should not create partial control events.
