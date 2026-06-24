# Football Play Summary Grammar Engine

## Purpose

The Football Play Summary Grammar Engine generates human-readable summaries from Football Confirmed Quick Input draft intents before event creation.

It is a presentation and confirmation layer only. It must not create events, mutate scoring state, apply down/distance rules, submit payloads, or infer official statistical outcomes beyond the normalized FCQI draft fields it receives.

## Proposed Name

**Football Play Summary Grammar**, abbreviated **FPSG**.

The engine should live conceptually between FCQI token collection and final submit:

```text
FCQI tokens -> resolved draft intent -> FPSG summary -> operator confirmation -> event creation
```

## Inputs and Outputs

Input should be a resolved FCQI draft intent with:

- play family, such as `rush`, `pass`, `punt`, `kickoff`, `fieldGoal`, `pat`, or `penalty`
- play subtype/result, such as `complete`, `incomplete`, `sack`, `interception`, `touchback`, `fairCatch`, or `blocked`
- acting team and possession context
- start context: period, clock, down, distance, start field position
- resolved players with player IDs, jerseys, team, display names, and positions
- result context: yards, end field position, score flags, turnover flags, first-down flags
- attached penalties
- warnings from FCQI validation, if any

Output should be:

- one primary summary sentence
- zero or more appended penalty clauses
- zero or more confirmation warnings
- optional structured segments for clickable editing later

Example output:

```text
HOM #22 Jordan Smith rush for 7 yards to the V43, tackled by #44 Caleb Moss and #9 Amir Cole.
```

## Grammar Principles

- Use concise football play-by-play language.
- Prefer one sentence for the play result.
- Append penalties after the play sentence unless the play is penalty-only.
- Do not use debug names, payload field names, or backend enum values in user-facing text.
- Do not invent a player name when only a jersey is known.
- Do not hide ambiguity. If a player was manually chosen from duplicate jerseys, summarize the chosen player.
- Do not imply official acceptance of a play until the user confirms.
- Use the draft intent as the source of truth. If a derived consequence is not present, omit it or show a neutral phrase.

## FCQI Result-Code Wording Rules

FCQI result codes are operator input shortcuts. FPSG should summarize the canonical draft intent fields that FCQI produced, not raw shortcuts by themselves.

Rules:

- Result codes are context-specific.
- `C` means Complete at the primary Pass result prompt.
- `C` means Lateral at the Complete Pass result prompt.
- `C` means Fair Catch at the Kick Receive result prompt.
- `T` means Tackle in terminal-result context.
- `T` means Touchback at the Kick Receive result prompt.
- `.` means End of Play and must be summarized without tackled-by wording unless defenders were otherwise explicitly supplied by the draft.
- FPSG may use `result.operator` metadata to choose wording or warnings, but must not invent missing operator metadata.
- FPSG must not interpret `T` or `C` without `inputScope`.
- FPSG must not parse a shortcut from free text or infer a continuation that FCQI did not provide.
- Lateral wording applies to a shared live-ball continuation model across rushes, completed passes, fumble returns, interception returns, kickoff returns, punt returns, field goal returns, and other live-ball returns. See `docs/football-lateral-stat-allocation.md` for typed segment and stat allocation rules.

Base terminal result wording applies after an offensive live-ball action or after a live return has started:

| Operator code | Meaning | Summary behavior |
| --- | --- | --- |
| `T` | Tackle | Include tackler(s) when present or required by the flow. |
| `O` | Out of Bounds | Include `out-of-bounds`; include tacklers only if supplied. |
| `F` | Fumble | Use fumble wording and recovery/return details from the draft. |
| `C` | Lateral | Use lateral/continued-play wording only when lateral detail exists; otherwise show a blocker/warning upstream. |
| `.` | End of Play | End at the spot with no tackled-by phrase. |

Kick receive result wording applies when a kickoff or punt first arrives:

| Operator code | Meaning | Summary behavior |
| --- | --- | --- |
| `R` | Return | Summarize the kick receive, then summarize Shared Return Flow. |
| `T` | Touchback | Use touchback wording; no returner required unless the draft supplies one. |
| `C` | Fair Catch | Use fair-catch wording with returner; no return yards or return terminal result. |
| `O` | Out of Bounds | Use kick out-of-bounds wording and dead-ball spot. |
| `M` | Muffed | Use muffed wording and recovery/continuation details. |
| `D` | Downed | Use downed wording and downing player when supplied. |

Kick receive `T`, `C`, and `D` are terminal receive results. They do not continue into Shared Return Flow.

Rush operator result wording:

| Operator code | Meaning | Summary behavior |
| --- | --- | --- |
| `T` | Tackle | Include tackler(s). |
| `O` | Out of Bounds | Include `out-of-bounds`; include tacklers only if supplied. |
| `F` | Fumble | Use fumble wording and recovery/return details from the draft. |
| `C` | Lateral | Use lateral/continued-play wording only when lateral detail exists; otherwise show a blocker/warning upstream. |
| `.` | End of Play | End at the spot with no tackled-by phrase. |

Primary Pass operator result wording:

| Operator code | Meaning | Summary behavior |
| --- | --- | --- |
| `C` | Complete | Use complete pass templates and then apply nested Complete result wording. |
| `I` | Incomplete | Use incomplete templates with intended receiver, breakup, and hurry details when present. |
| `S` | Sack | Use sack templates with one or two sack defenders. |
| `F` | Sack Fumble | Use sack-with-fumble templates and fumble detail wording. |
| `R` | Rush Conversion | FPSG should summarize the resulting Rush intent, not a Pass intent. |
| `X` | Intercepted | Use interception templates and return wording when present. |

Complete Pass nested result wording:

| Operator code | Meaning | Summary behavior |
| --- | --- | --- |
| `T` | Tackle | Include receiver, yardage/end spot, and tackler(s). |
| `O` | Out of Bounds | Include receiver, yardage/end spot, and `out-of-bounds`; include tacklers only if supplied. |
| `F` | Fumble | Include completion, end spot, then fumble detail. |
| `C` | Lateral | Treat as lateral, not another completion. |
| `.` | End of Play | Include completion and end spot without tackled-by wording. |

Shared Return Flow begins only after a live return starts, such as interception return, fumble return, field-goal return, PAT/try return, or kick receive `R` Return. Return terminal result wording mirrors base terminal result wording for `T`, `O`, `F`, `C`, and `.`.

## Lateral Wording And Stat Boundary

FPSG should summarize lateral segments in play order:

```text
[carrier] lateral to [next carrier] at [spot], [next carrier] to [final spot].
```

For multiple laterals, repeat the lateral phrase in sequence and keep the terminal result last.

FPSG must not describe all post-catch or post-return advancement as miscellaneous yards. Only the spot difference from `lateralFromSpot` to `lateralToSpot` is miscellaneous for stat allocation. The lateral receiver's advancement after receiving the lateral belongs to the continuation stat family represented by the typed lateral segment:

- rushing yards for rush/pass lateral continuation
- interception return yards for interception return continuation
- fumble return yards for fumble return continuation
- kickoff return yards for kickoff return continuation
- punt return yards for punt return continuation
- field goal return yards for field goal return continuation

Receiving a lateral does not create a new attempt in summary wording. For example, a completed-pass lateral should read as receiving advancement, lateral exchange, then rushing continuation, not as a second reception or a miscellaneous-yard continuation.

The summary text is not the stat source of truth. Projection must allocate yards from typed intent fields and canonical spots using `docs/football-lateral-stat-allocation.md`.

## StatBroadcast-Style Wording Rules

Use wording similar to compact stat-crew play-by-play:

- Start with the acting team abbreviation only when useful for clarity.
- Put the primary actor first.
- Use lower-case play verbs: `rush`, `pass`, `sacked`, `punt`, `kickoff`.
- Use `for X yards` for gains and losses when the result is yardage-based.
- Use `for no gain` for zero-yard rushes, completions, sacks, and returns.
- Use `loss of X yards` instead of `for -X yards`.
- Use `to the V43` or `at the H25` for field position.
- Use `out-of-bounds`, `fair catch`, `touchback`, `downed`, `blocked`, and `returned` as result words.
- Use `TD` only in compact contexts; use `touchdown` in the primary confirmation sentence.
- Use `PAT` for point-after try labels, but use `extra point` in prose if the subtype is a kick.
- Avoid commas unless they separate a main result from tacklers, penalties, or special notes.
- Avoid all-caps except team abbreviations, standard abbreviations, and penalty codes.

Preferred sentence shape:

```text
[TEAM] [primary player] [action phrase] [result phrase] [field position phrase][, defender phrase][, special result].
```

## Abbreviation Rules

Team abbreviations:

- Use the scoreboard abbreviation when available.
- Fall back to `HOM` and `VIS`.
- Never use raw `home` or `visitor` in summaries.

Common football abbreviations:

- `TD`: compact touchdown marker, but prefer `touchdown` in prose.
- `PAT`: point after touchdown.
- `FG`: field goal, only in labels; use `field goal` in sentences.
- `INT`: interception, only in labels; use `intercepted` or `interception` in sentences.
- `FUM`: fumble, only in labels; use `fumble` or `fumbled` in sentences.
- `OOB`: do not use in primary prose; write `out-of-bounds`.

Penalty abbreviations:

- Use the penalty table `name` for prose.
- Show the penalty `code` only in compact secondary text or when the name is unavailable.
- Example: `Penalty: Holding on HOM, 10 yards from the spot, accepted.`

## Player Name Formatting Rules

Preferred player format:

```text
#[jersey] [First Last]
```

Examples:

- `#22 Jordan Smith`
- `#3 Jones` when only one name token is available
- `#3` when the roster record has no usable display name

Rules:

- Always include the jersey number when available.
- Use the roster display name if present.
- Do not add position in the primary sentence unless needed for a warning or duplicate-player clarity.
- For opponent defenders, omit team abbreviation unless same-number ambiguity would make the sentence unclear.
- For multiple players, use natural joining:
  - one: `tackled by #44 Caleb Moss`
  - two: `tackled by #44 Caleb Moss and #9 Amir Cole`
  - three or more: `tackled by #44 Caleb Moss, #9 Amir Cole, and #7 Noah Reed`
- Unknown player fallback:
  - `#22` if jersey exists
  - `unknown player` only if neither jersey nor name exists

## Field Position Formatting Rules

The grammar should accept normalized yardline codes from existing field-position helpers, such as `H05`, `V39`, `H00`, and `V50`.

User-facing format:

- `H05` -> `the H5`
- `V39` -> `the V39`
- `H00` -> `the H goal line`
- `V00` -> `the V goal line`
- `H50` or `V50` -> `midfield`
- empty or invalid spot -> omit the field-position phrase and include a warning segment

Phrase selection:

- Use `to the [spot]` for where the ball ended.
- Use `at the [spot]` for possession starts, fair catches, touchbacks, and dead-ball spots.
- Use `from the [spot]` for kicks, punts, and penalty enforcement.
- Use `in the end zone` only if the draft explicitly marks an end-zone result or the spot is a touchdown/touchback context.

Do not calculate field position inside FPSG. The draft intent should provide the start and end spots after validation.

## Yardage Formatting Rules

- Positive yards: `for 7 yards`
- One yard: `for 1 yard`
- Zero yards: `for no gain`
- Negative yards: `for loss of 3 yards`
- Unknown yards with known end spot: omit yardage and use spot: `to the V43`
- Unknown yards and unknown spot: `result pending` warning, not a fabricated value

## Rush Templates

Standard rush:

```text
[TEAM] [rusher] rush [yardage phrase] to [end spot].
```

With tacklers:

```text
[TEAM] [rusher] rush [yardage phrase] to [end spot], tackled by [defenders].
```

No gain:

```text
[TEAM] [rusher] rush for no gain to [end spot], tackled by [defenders].
```

Loss:

```text
[TEAM] [rusher] rush for loss of [yards] yards to [end spot], tackled by [defenders].
```

Touchdown:

```text
[TEAM] [rusher] rush [yardage phrase] for a touchdown.
```

Out-of-bounds:

```text
[TEAM] [rusher] rush [yardage phrase] to [end spot], out-of-bounds.
```

End of play:

```text
[TEAM] [rusher] rush [yardage phrase] to [end spot].
```

First down note when supplied by draft:

```text
[TEAM] [rusher] rush [yardage phrase] to [end spot] for a first down.
```

## Pass Templates

Complete pass:

```text
[TEAM] [passer] pass complete to [receiver] [yardage phrase] to [end spot].
```

Complete pass with tacklers:

```text
[TEAM] [passer] pass complete to [receiver] [yardage phrase] to [end spot], tackled by [defenders].
```

Complete pass out-of-bounds:

```text
[TEAM] [passer] pass complete to [receiver] [yardage phrase] to [end spot], out-of-bounds.
```

Complete pass end of play:

```text
[TEAM] [passer] pass complete to [receiver] [yardage phrase] to [end spot].
```

Complete pass with caught-at spot when supplied:

```text
[TEAM] [passer] pass complete to [receiver] caught at [caught spot], [yardage phrase] to [end spot].
```

Incomplete pass:

```text
[TEAM] [passer] pass incomplete intended for [receiver].
```

Incomplete pass without receiver:

```text
[TEAM] [passer] pass incomplete.
```

Complete pass touchdown:

```text
[TEAM] [passer] pass complete to [receiver] [yardage phrase] for a touchdown.
```

Pass broken up when defender is known:

```text
[TEAM] [passer] pass incomplete intended for [receiver], broken up by [defender].
```

Pass hurried when defenders are known:

```text
[TEAM] [passer] pass incomplete intended for [receiver], hurried by [defenders].
```

Pass broken up and hurried:

```text
[TEAM] [passer] pass incomplete intended for [receiver], broken up by [defender], hurried by [defenders].
```

## Sack Templates

Single-defender sack:

```text
[TEAM] [passer] sacked by [defender] for loss of [yards] yards to [end spot].
```

Shared sack:

```text
[TEAM] [passer] sacked by [defenders] for loss of [yards] yards to [end spot].
```

Sack with fumble:

```text
[TEAM] [passer] sacked by [defenders] for loss of [yards] yards to [end spot], fumbled.
```

Sack with no yardage available:

```text
[TEAM] [passer] sacked by [defenders] at [end spot].
```

## Interception Templates

Interception without return:

```text
[TEAM] [passer] pass intercepted by [interceptor] at [spot].
```

Interception with return:

```text
[TEAM] [passer] pass intercepted by [interceptor] at [interception spot], returned [yardage phrase] to [end spot].
```

Interception return touchdown:

```text
[TEAM] [passer] pass intercepted by [interceptor] at [interception spot], returned [yardage phrase] for a touchdown.
```

Interception with tacklers:

```text
[TEAM] [passer] pass intercepted by [interceptor] at [interception spot], returned [yardage phrase] to [end spot], tackled by [defenders].
```

If the intercepted pass target is known:

```text
[TEAM] [passer] pass intended for [receiver] intercepted by [interceptor] at [interception spot].
```

## Fumble Templates

Rush/pass fumble without recovery known:

```text
[TEAM] [ball carrier] fumbled at [spot].
```

Fumble recovered by offense:

```text
[TEAM] [ball carrier] fumbled at [spot], recovered by [recovery player] for [recovering team].
```

Fumble recovered by defense:

```text
[TEAM] [ball carrier] fumbled at [spot], recovered by [recovery player] for [recovering team] at [recovery spot].
```

Fumble return:

```text
[TEAM] [ball carrier] fumbled at [spot], recovered by [recovery player] for [recovering team] and returned [yardage phrase] to [end spot].
```

Fumble return touchdown:

```text
[TEAM] [ball carrier] fumbled at [spot], recovered by [recovery player] for [recovering team] and returned [yardage phrase] for a touchdown.
```

Forced fumble when defender is known:

```text
[TEAM] [ball carrier] fumbled at [spot], forced by [defender], recovered by [recovery player] for [recovering team].
```

Miscellaneous offensive fumble retained by offense:

```text
[TEAM] fumble by [ball carrier], recovered by [recovery player] for no change of possession.
```

## Punt Templates

Standard punt:

```text
[TEAM] [punter] punt [distance] yards to [catch spot].
```

Punt returned:

```text
[TEAM] [punter] punt [distance] yards to [catch spot], [returner] return [yardage phrase] to [end spot].
```

Punt fair catch:

```text
[TEAM] [punter] punt [distance] yards to [catch spot], fair catch by [returner].
```

Punt downed:

```text
[TEAM] [punter] punt [distance] yards to [catch spot], downed.
```

Punt downed with downing player:

```text
[TEAM] [punter] punt [distance] yards to [catch spot], downed by [player].
```

Punt out-of-bounds:

```text
[TEAM] [punter] punt [distance] yards out-of-bounds at [end spot].
```

Punt touchback:

```text
[TEAM] [punter] punt [distance] yards into the end zone, touchback.
```

Blocked punt:

```text
[TEAM] [punter] punt blocked by [defender] at [block spot].
```

Muffed punt:

```text
[TEAM] [punter] punt [distance] yards to [catch spot], muffed by [returner].
```

## Kickoff Templates

Standard kickoff:

```text
[TEAM] [kicker] kickoff [distance] yards to [catch spot].
```

Kickoff returned:

```text
[TEAM] [kicker] kickoff [distance] yards to [catch spot], [returner] return [yardage phrase] to [end spot].
```

Kickoff returned with tacklers:

```text
[TEAM] [kicker] kickoff [distance] yards to [catch spot], [returner] return [yardage phrase] to [end spot], tackled by [defenders].
```

Kickoff touchback:

```text
[TEAM] [kicker] kickoff into the end zone, touchback.
```

Kickoff fair catch:

```text
[TEAM] [kicker] kickoff [distance] yards to [catch spot], fair catch by [returner].
```

Kickoff out-of-bounds:

```text
[TEAM] [kicker] kickoff out-of-bounds at [end spot].
```

Onside kick recovered by kicking team:

```text
[TEAM] [kicker] onside kick recovered by [recovery player] for [recovering team] at [recovery spot].
```

Onside kick recovered by receiving team:

```text
[TEAM] [kicker] onside kick recovered by [recovery player] for [recovering team] at [recovery spot].
```

Muffed kickoff:

```text
[TEAM] [kicker] kickoff [distance] yards to [catch spot], muffed by [returner].
```

## PAT Templates

Good extra point:

```text
[TEAM] [kicker] extra point good.
```

Missed extra point:

```text
[TEAM] [kicker] extra point no good.
```

Blocked extra point:

```text
[TEAM] [kicker] extra point blocked by [defender].
```

Two-point rush:

```text
[TEAM] two-point rush by [rusher] good.
```

Two-point pass:

```text
[TEAM] two-point pass from [passer] to [receiver] good.
```

Failed two-point try:

```text
[TEAM] two-point try failed.
```

Defensive PAT return:

```text
[TEAM] try failed, returned by [returner] for a defensive conversion.
```

## Field Goal Templates

Good field goal:

```text
[TEAM] [kicker] [distance]-yard field goal good.
```

Missed field goal:

```text
[TEAM] [kicker] [distance]-yard field goal no good.
```

Missed wide/short when direction is known:

```text
[TEAM] [kicker] [distance]-yard field goal no good, [wide left|wide right|short].
```

Blocked field goal:

```text
[TEAM] [kicker] [distance]-yard field goal blocked by [defender].
```

Returned missed field goal:

```text
[TEAM] [kicker] [distance]-yard field goal no good, returned by [returner] [yardage phrase] to [end spot].
```

Returned blocked field goal:

```text
[TEAM] [kicker] [distance]-yard field goal blocked by [defender], recovered by [returner] and returned [yardage phrase] to [end spot].
```

## Penalty Templates

Penalty-only accepted:

```text
Penalty: [penalty name] on [TEAM], [yards] yards from [enforcement spot], accepted.
```

Penalty-only declined:

```text
Penalty: [penalty name] on [TEAM], declined.
```

Penalty attached to live play:

```text
[play summary] Penalty: [penalty name] on [TEAM], [yards] yards from [enforcement spot], accepted.
```

Offsetting penalties:

```text
[play summary] Penalties offset: [penalty name] on [TEAM]; [penalty name] on [TEAM].
```

Offsetting penalties during the play:

```text
Offsetting penalties. Previous play does not count.
```

Offsetting penalties after the play:

```text
Offsetting penalties after the play. Previous play counts.
```

Multiple accepted penalties:

```text
[play summary] Penalties: [penalty name] on [TEAM], [yards] yards, accepted; [penalty name] on [TEAM], [yards] yards, accepted.
```

Automatic first down:

```text
Penalty: [penalty name] on [TEAM], [yards] yards, automatic first down.
```

Loss of down:

```text
Penalty: [penalty name] on [TEAM], [yards] yards, loss of down.
```

Replay down:

```text
Penalty: [penalty name] on [TEAM], [yards] yards, replay down.
```

Carry-over:

```text
Penalty: [penalty name] on [TEAM], enforced on the [try|kickoff].
```

Rules:

- Penalty text should use typed penalty fields from the draft.
- Do not parse penalty consequences from free text.
- If penalty status is unknown, use `pending enforcement` and require confirmation warning.
- If penalty name is unavailable, use the code.
- If yards are required but missing, show `yards pending` and include a warning.
- Declined penalties are terminal and should not mention enforcement fields.
- Offsetting penalty summaries must show at least one penalty from each team and should use `Penalties offset`.
- Offsetting summaries must reflect the explicit `previousPlayCounts` decision.
- If `previousPlayCounts` is false, use wording equivalent to `Offsetting penalties. Previous play does not count.`
- If `previousPlayCounts` is true, use wording equivalent to `Offsetting penalties after the play. Previous play counts.`
- Do not infer whether the play counts from summary text; FPSG should consume typed penalty metadata.
- Accepted penalty summaries should include enforcement basis when available: previous spot, spot of foul, or succeeding spot.
- Spot-of-foul accepted penalties should include the foul spot when available.
- Down consequence text should be explicit when present: `replay down`, `loss of down`, or `automatic first down`.
- Unresolved queued penalty markers are not penalty summaries. Show `Penalty queued — resolve before confirmation` and block confirmation until the marker is resolved into typed penalties or removed.

Confirmed penalty-entry wording:

- Accepted: `Penalty: [penalty name] on [TEAM], [yards] yards from [previous spot|spot of foul|succeeding spot], [down consequence], accepted.`
- Declined: `Penalty: [penalty name] on [TEAM], declined.`
- Offsetting: `Penalties offset: [penalty name] on [TEAM]; [penalty name] on [TEAM].`

Projection-sensitive wording:

- Previous Spot nullifies the previous play; summary should avoid implying the live play stats remain enforced.
- Succeeding Spot keeps the live play result, then applies enforcement from the final spot.
- Spot of Foul counts the play only to the foul spot, then applies enforcement from that spot.

## Multi-Defender Templates

Tackle:

```text
tackled by [defenders]
```

Assisted tackle:

```text
tackled by [primary defender], assisted by [assist defenders]
```

Sack:

```text
sacked by [defenders]
```

Pass breakup:

```text
broken up by [defender]
```

Forced fumble:

```text
forced by [defender]
```

Rules:

- Preserve defender order supplied by FCQI.
- Use `and` before the final defender.
- Do not label assists unless the draft explicitly distinguishes primary and assist defenders.
- If more than three defenders are supplied, show the first three and add `and others` only if the UI cannot fit the full list.

## Confirmation Warnings

FPSG should return warnings separately from the primary summary text.

Warnings should appear when:

- field position is missing or invalid
- yards are missing for a yardage-based play
- a required player is unresolved
- a duplicate jersey was resolved to a non-recommended player
- a selected player's position is unusual for the action context
- a penalty is missing required yards, spot, accepted/declined status, or enforcement
- result flags conflict, such as touchdown and touchback both true

Warnings should not block rendering, but FCQI should decide whether they block final confirmation.

## Likely Future Files

Potential implementation files:

- `src/quick-input/footballPlaySummaryGrammar.ts`
- `src/quick-input/footballSummaryFormatters.ts`
- `src/quick-input/footballSummaryTemplates.ts`
- `src/quick-input/footballSummaryGrammar.test.ts`

Integration points:

- `src/quick-input/footballConfirmedQuickInputMachine.ts`
- `src/components/FootballQuickInputSummaryModal.jsx`
- `src/components/PlayerDisambiguationModal.jsx`
- `src/types/penalties.ts`
- `src/utils/apiDataContract.ts`

## Test Cases

Rush:

- rush for positive yards
- rush for no gain
- rush for loss
- rush touchdown
- rush out-of-bounds
- rush with one tackler
- rush with two tacklers
- rush with first-down flag

Pass:

- complete pass with receiver
- complete pass touchdown
- incomplete pass with intended receiver
- incomplete pass without receiver
- pass broken up by defender

Sack:

- single-defender sack
- shared sack
- sack with fumble
- sack with missing yardage but valid end spot

Interception:

- interception without return
- interception with return
- interception return touchdown
- interception with intended receiver

Fumble:

- fumble with no recovery
- fumble recovered by offense
- fumble recovered by defense
- fumble returned for touchdown
- forced fumble

Punt:

- standard punt
- returned punt
- fair catch
- downed punt
- punt out-of-bounds
- punt touchback
- blocked punt
- muffed punt

Kickoff:

- standard kickoff
- kickoff return
- kickoff return with tacklers
- touchback
- fair catch
- out-of-bounds kickoff
- onside recovery by kicking team
- onside recovery by receiving team
- muffed kickoff

PAT and field goal:

- extra point good
- extra point no good
- blocked extra point
- two-point rush good
- two-point pass good
- failed two-point try
- field goal good
- field goal no good
- blocked field goal
- missed or blocked field goal return

Penalty:

- accepted penalty
- declined penalty
- offsetting penalties
- multiple accepted penalties
- automatic first down
- loss of down
- replay down
- carry-over to try
- carry-over to kickoff

Formatting:

- player with full name
- player with jersey only
- multiple defenders natural joining
- `H05`, `V39`, `H00`, `V00`, and midfield field-position formatting
- positive, zero, negative, and missing yardage
- missing required field produces warning without crashing
