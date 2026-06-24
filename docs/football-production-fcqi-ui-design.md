# Football Production FCQI UI Design

## Purpose

This document defines the intended production operator interface for Football Confirmed Quick Input (FCQI) inside the canonical scorer Input slot.

The current `/football-layout-preview` FCQI Rush panel is a temporary developer harness for exercising pure FCQI modules. It should remain available for testing and diagnostics, but it is not the production operator UX.

Production FCQI should feel similar to Basketball scoring:

- click or hotkey starts a flow
- modal-driven prompts
- one input at a time
- duplicate player selection in a focused modal/card
- final play summary modal before build/submit
- Input Assistant guides the operator
- no visible machine/debug panel in normal production use

## Production FCQI Goals

- Let trained scorers enter common football events quickly without leaving the canonical scorer shell.
- Keep operator focus on one decision at a time.
- Preserve Football's confirmation requirement before submit.
- Reuse the pure FCQI pipeline:
  - `footballConfirmedQuickInputMachine`
  - `playerResolution`
  - `footballPlaySummaryGrammar`
  - `footballEventBuilder`
- Keep final submit explicit and separate from token entry.
- Make duplicate jersey handling visible, fast, and reversible.
- Keep penalties attached to the draft play before final confirmation.
- Make the Input Assistant the primary instruction surface during active flows.

## Non-Goals

- Do not redesign `/football-layout-preview`.
- Do not expose machine state, current step, client event IDs, or raw build JSON in normal production UI.
- Do not auto-submit when required tokens are complete.
- Do not calculate official post-play game state in the UI.
- Do not mutate envelope state before backend acceptance.
- Do not replace the pure FCQI modules with component-local logic.
- Do not revive legacy prompt-based duplicate handling.

## Difference From Preview Harness

The current preview harness is intentionally developer-facing:

- visible machine state
- visible current step
- visible client event state
- inline jersey/yards/end-spot fields
- inline duplicate selector
- collapsible build result JSON
- “built request only” proof text

Production FCQI should be operator-facing:

- play buttons and hotkeys are the visible entry point
- prompts appear in modal flow surfaces
- the current token input is the only active field
- duplicate selection is modal/card based
- final summary appears in a confirmation modal
- build/debug JSON is hidden unless dev/debug mode is enabled
- final confirm calls the production submit adapter after Event Builder success

## Input Slot Layout

The canonical scorer Input slot should contain production play controls, not a debug panel.

Recommended layout:

- Top row: compact play-family buttons.
- Main area: quiet waiting state when no flow is active.
- Active flow overlay: modal centered over the Input slot or scorer shell.
- Inline context strip: possession, down/distance, spot, clock.
- Secondary action row: Add Penalty, Cancel Draft, Edit Previous.

Primary buttons:

| Button | Hotkey | Starts |
| --- | --- | --- |
| Rush | `R` | Rush flow |
| Pass | `P` | Pass flow |
| Punt | `U` | Punt flow |
| Kick | `K` | Kickoff/field goal/PAT branch |
| Penalty | `E` | Penalty attachment or penalty-only flow |
| Game Control | `G` | Timeout/clock/control flow |

Inactive production buttons should not show debug internals. Disabled states should explain availability through tooltip or Input Assistant text, not by dumping state.

## Play Button And Hotkey Behavior

- Clicking a play button and pressing its hotkey should enter the same FCQI start action.
- Hotkeys should be ignored while typing in a text input unless the active modal explicitly owns the key.
- Starting a flow should snapshot current game context into the draft:
  - game ID
  - possession/action team
  - period and clock
  - down/distance/spot/line-to-gain
  - base envelope version/sequence
  - active roster snapshot
- Starting a new play while a draft exists should require explicit discard or resume.
- `Enter` commits the current token only.
- `Escape` closes the active modal or asks to cancel a meaningful draft.
- Final submit must require an explicit Confirm Submit action from summary review.

## Modal Flow Behavior

Production FCQI should use a flow modal similar to Basketball's intent flow, adapted for Football confirmation.

Each prompt modal should show:

- play family label
- concise prompt text
- one input field or one choice group
- current play context
- accepted tokens summary
- actions: Back, Cancel, Add Penalty when allowed

Examples:

- `Rush: Rusher #`
- `Rush: Gain/Loss Yards`
- `Rush: End Spot`
- `Rush: Tackler # optional`
- `Pass: Passer #`
- `Pass: Receiver #`
- `Punt: Punter #`
- `Kick: Kick Type`

Prompt rules:

- Only one primary input is active at a time.
- Accepted tokens are shown as compact chips, not editable form fields.
- Editing a chip returns to that token step and preserves later tokens only when still valid.
- Validation errors stay in the modal near the active input.
- The operator can cancel, but canceling a non-empty draft asks for confirmation.

## Duplicate Jersey Modal Behavior

Duplicate jerseys must always open a selection modal. Recommended defaults are helpful but never auto-confirmed.

Modal content:

- title: `Choose #3`
- subtitle: action context, such as `Rush by HOM`
- candidate cards with:
  - jersey
  - display name
  - team abbreviation
  - position
  - role group when known: offense, defense, special teams
  - recommended label
- actions:
  - Choose Selected
  - Edit Jersey
  - Cancel Draft

Defaulting:

- Offensive action defaults to offensive-position candidate.
- Defensive action defaults to defensive-position candidate.
- Special teams action defaults to special teams candidate.
- Ties preserve roster order.

Keyboard behavior:

- Modal opens with the recommended candidate selected.
- Arrow keys move selection.
- Enter confirms selected candidate.
- Escape returns to the jersey prompt without committing.
- Tab remains trapped inside the modal.

Audit metadata:

- Store all duplicate candidate IDs in `DraftPlayerResolution`.
- Store recommended player ID.
- Store whether the selected player was recommended.
- If a non-recommended player is selected, surface a warning in summary review.

## Summary Confirmation Modal Behavior

After required tokens are complete, FCQI should generate FPSG summary text and open a summary confirmation modal.

Modal content:

- title: `Review Play`
- primary summary sentence from FPSG
- context strip: period, clock, down/distance, start spot
- participant chips: rusher, passer, receiver, defenders, returner as relevant
- result chips: yards, end spot, first down, touchdown, turnover when present
- penalty list, if attached
- warning list, if any

Actions:

- Confirm Submit
- Add Penalty
- Edit Play
- Cancel Draft

Rules:

- Summary modal must appear before any production submit call.
- Confirm Submit calls Event Builder first.
- If Event Builder returns errors, keep the modal open and show blocking errors.
- If Event Builder succeeds, call the production submit adapter exactly once.
- Do not parse summary text back into event fields.
- If the draft revision changes, regenerate summary before confirming.

## Penalty Attachment UX

Penalty attachment should be draft-scoped and available before final confirm.

Entry points:

- `E` during active draft opens penalty attachment.
- Add Penalty button in prompt modal.
- Add Penalty button in summary modal.
- Penalty button from idle starts penalty-only flow.

Penalty modal should collect typed fields:

- team
- penalty code/name
- yards when required
- enforcement spot
- accepted/declined/offsetting status
- automatic first down/loss of down/replay down/carry-over flags when applicable
- penalized player when available

Behavior:

- Adding a penalty returns to summary review.
- Multiple penalties are allowed.
- Penalties can be edited or removed before confirm.
- Pending penalties block final confirmation.
- Penalty-only flow still uses summary confirmation.

## Input Assistant Messages By State

The Input Assistant should be the operator's persistent instruction surface.

Recommended messages:

| State | Assistant message |
| --- | --- |
| `idle` | `Select a play type or press a hotkey.` |
| `token.awaiting` rusher | `Enter rusher jersey, then press Enter.` |
| `token.awaiting` yards | `Enter gain or loss yards, then press Enter.` |
| `token.awaiting` end spot | `Enter ending spot, then press Enter.` |
| `token.validating` | `Checking roster and play context.` |
| `jersey.disambiguating` | `Choose the correct # jersey from the roster matches.` |
| `token.error` | Show concise validation error and recovery action. |
| `draft.ready` | `Required fields are complete. Review the play summary.` |
| `summary.reviewing` | `Review the summary, add penalties if needed, then confirm.` |
| `penalty.editing` | `Attach penalty details to this draft play.` |
| `submitting.confirmed` | `Building event request.` |
| `submitted` | `Play accepted. Ready for next event.` |
| `submit.error` | `Submit failed. Draft is still editable.` |
| `cancelled` | `Draft cancelled. Select a play type to continue.` |

Assistant rules:

- Keep messages short.
- Use imperative language.
- Do not expose raw state names in production unless debug mode is enabled.
- Show hotkey hints where useful.
- Show warnings separately from blocking errors.

## Debug And Dev-Only Behavior

Normal production UI must not show:

- raw machine state names
- current step IDs
- `clientEventId`
- `FootballDraftIntent` JSON
- Event Builder output JSON
- base envelope sequence/version
- duplicate candidate IDs

Allowed debug mode behavior:

- gated by explicit dev/debug flag
- expandable diagnostics panel
- current state and transition history
- draft intent JSON
- FPSG warnings
- Event Builder result JSON
- base sequence/version
- no production submit bypass

The `/football-layout-preview` harness remains the fastest place to inspect this information without polluting production scorer UI.

## Accessibility And Keyboard Behavior

Modal requirements:

- Use semantic dialog structure.
- Trap focus while open.
- Return focus to the invoking play button when closed.
- Escape behavior must be predictable:
  - close duplicate modal back to jersey prompt
  - close penalty modal back to current draft
  - ask before discarding meaningful draft
- First active input receives focus on modal open.
- Error text should be associated with the active input.
- Candidate cards should be keyboard selectable.
- Summary modal should make Confirm Submit reachable but not accidental.

Keyboard rules:

- Play hotkeys work only when no text input owns focus.
- Enter commits only the active token during prompt states.
- Enter confirms duplicate selection only when duplicate modal is active.
- Enter confirms summary only when Confirm Submit is focused or the modal explicitly owns that shortcut.
- `E` opens penalty attachment when draft is active.
- `Backspace` should not navigate the browser when modal focus is in custom controls.

## Initial Implementation Scope

Recommended first production slice:

- Rush flow only.
- Play button and `R` hotkey start.
- Rusher jersey prompt.
- Duplicate jersey modal.
- Yards prompt.
- End spot prompt.
- Optional tackler prompt.
- Summary confirmation modal.
- Event Builder integration.
- Submit adapter remains behind explicit integration review.
- Input Assistant state messages.
- Debug JSON behind dev flag only.

Out of initial scope:

- Pass, punt, kickoff, field goal, try, game-control production UI.
- Full penalty rules editor beyond attaching already-typed penalty records.
- Real backend submit until canonical submit adapter is confirmed.
- Official post-play projection in UI.

## Rollout Plan

1. Keep `/football-layout-preview` as developer harness.
2. Build `FootballConfirmedQuickInput` production component in the active scorer Input slot behind a feature flag or dev route flag.
3. Implement Rush-only modal UI using the pure machine.
4. Add production duplicate jersey modal.
5. Add summary confirmation modal.
6. Wire Event Builder output to a submit adapter stub that does not call network in tests.
7. Review canonical submit contract and only then connect final confirm to production submit.
8. Expand play families one at a time:
   - pass
   - sack/interception
   - punt
   - kickoff
   - field goal/PAT
   - penalty-only
9. Retire or archive any remaining legacy modal/input-flow code only after production FCQI covers equivalent behavior.

## Files Likely To Change Later

New production UI components:

- `src/components/FootballConfirmedQuickInput.jsx`
- `src/components/FootballQuickInputPromptModal.jsx`
- `src/components/FootballDuplicatePlayerModal.jsx`
- `src/components/FootballPlaySummaryModal.jsx`
- `src/components/FootballPenaltyAttachmentModal.jsx`
- `src/components/FootballInputAssistantMessages.jsx`

Existing active files:

- `src/pages/FootballScorerShell.jsx`
- `src/components/scorer/ScorerLayoutShell.jsx` only if slot wiring needs a stable prop target
- `src/quick-input/footballConfirmedQuickInputMachine.ts`
- `src/quick-input/playerResolution.ts`
- `src/quick-input/footballPlaySummaryGrammar.ts`
- `src/quick-input/footballEventBuilder.ts`
- `src/quick-input/footballIntentSchema.ts`

Preview/dev-only files:

- `src/pages/FootballLayoutPreview.jsx`
- `src/pages/FootballLayoutPreview.test.jsx`

These should remain developer-harness oriented unless a separate task explicitly redesigns the preview.

Legacy files to avoid using as production source of truth:

- `src/legacy-unused/input-flow-stack/**`
- prompt-based duplicate selection code
- direct auto-submit flow handlers

## Test Plan

Pure module tests:

- FCQI machine transitions for each production-supported flow.
- Player resolution zero/single/duplicate cases.
- FPSG summary output for each completed intent.
- Event Builder success/error paths.

Production component tests:

- renders play buttons and hotkey badges.
- `R` and Rush button open rusher prompt.
- Enter commits jersey token and does not submit.
- duplicate jersey opens modal with recommended candidate selected.
- selecting duplicate candidate advances to next prompt.
- invalid jersey keeps prompt open with error.
- yards/end spot completion opens summary modal.
- summary modal displays FPSG text.
- Add Penalty opens penalty modal and returns to summary.
- Confirm Submit calls Event Builder.
- submit adapter is called exactly once only after explicit confirmation.
- Event Builder errors are displayed and do not call submit.
- Escape/back/cancel behavior preserves or discards draft correctly.

Accessibility tests:

- modal has dialog role and accessible name.
- focus moves to first input on open.
- focus is trapped inside active modal.
- Escape returns to correct previous state.
- duplicate candidates are keyboard selectable.
- errors are associated with inputs.

Regression tests:

- `/football-layout-preview` harness still renders.
- `/` and `/scorer` behavior is unchanged until production FCQI feature flag is enabled.
- existing scorer layout tests continue to pass.
- existing football rules/projection tests continue to pass.

Manual QA:

- run Rush flow with single jersey.
- run Rush flow with duplicate jersey and recommended selection.
- run Rush flow with duplicate jersey and non-recommended selection.
- add one accepted penalty before confirm.
- cancel at each modal state.
- verify no submit occurs before summary confirmation.
