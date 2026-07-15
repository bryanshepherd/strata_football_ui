# Cross-Sport Scorer Layout Implementation Plan

## Purpose

Standardize Football and Volleyball scorer UI outer geometry against the Basketball canonical shell documented in `docs/cross-sport-scorer-layout-standard.md`.

This plan does not change code. Implementation should preserve sport-specific internals and only normalize the scorer shell structure:

- Scoreboard: top full-width row, content-derived height.
- Middle row: horizontal row taking remaining scorer space.
- Stats/Input/Event Log columns: `20% / 65% / 15%`.
- Input Assistant: bottom full-width row, content-derived height.

## Shared scorer shell proposal

Create a reusable shell component that owns layout geometry only. Sport-specific components stay outside the shell and are passed as slots.

Likely component:

- `src/components/scorer/ScorerLayoutShell.jsx` in each sport UI repo, or a future shared package if Football/Volleyball/Basketball are consolidated.

Proposed API:

```jsx
<ScorerLayoutShell
  scoreboard={<FootballScoreboardSlot envelope={envelope} />}
  stats={<FootballStatsSlot envelope={envelope} />}
  input={<FootballInputSlot envelope={envelope} />}
  eventLog={<FootballEventLogSlot envelope={envelope} />}
  inputAssistant={<FootballInputAssistantSlot envelope={envelope} />}
  header={<OptionalSportHeader />}
  debugPanel={<OptionalDebugPanel />}
/>
```

The shell should not know sport rules, scoring semantics, rosters, play/rally parsing, or event mutation. It should only render slots into the canonical layout and apply sizing/scroll behavior.

## Slot names and expected props

| Slot prop | Required | Expected content | Layout responsibility | Suggested sport data props |
| --- | --- | --- | --- | --- |
| `scoreboard` | Yes | Sport scoreboard/scorebug and primary live game state | Top full-width row; no fixed height | `gameState`, `envelope`, `clock`, `teams`, `liveState` |
| `stats` | Yes | Team/player/set/drive stats panel | Middle left `20%`; internal vertical scroll allowed | `gameState`, `envelope`, `stats`, `rosters` |
| `input` | Yes | Main scoring controls/play/rally input | Middle center `65%`; internal vertical scroll allowed | `gameState`, `envelope`, `flow`, `onSubmitEvent` |
| `eventLog` | Yes | Play/rally/event timeline | Middle right `15%`; internal vertical scroll allowed | `gameState`, `envelope`, `events`, `plays`, `rallies` |
| `inputAssistant` | Yes | Status/help/prompt/sync assistant | Bottom full-width row; content-derived height | `flow`, `lastAction`, `syncStatus`, `parserPrompt`, `parserError` |
| `header` | No | Existing app nav/header outside scorer geometry | Above canonical scorer shell, not a canonical slot | `gameId`, `fixture`, navigation handlers |
| `debugPanel` | No | Existing debug trace or diagnostics | Outside canonical geometry, usually overlay/fixed | `debugMode`, `traceEntries` |

Recommended shell class structure:

```jsx
<main className="min-h-screen bg-white text-slate-950">
  {header}
  <section className="flex min-h-screen flex-col">
    <div className="shrink-0">{scoreboard}</div>
    <div className="flex flex-1 min-h-0">
      <aside className="w-1/5 min-h-0 overflow-y-auto">{stats}</aside>
      <section className="w-[65%] min-h-0 overflow-y-auto">{input}</section>
      <aside className="w-[15%] min-h-0 overflow-y-auto">{eventLog}</aside>
    </div>
    <div className="shrink-0">{inputAssistant}</div>
  </section>
  {debugPanel}
</main>
```

Implementation detail: if the global app header stays above the scorer shell, the scorer shell may need `min-h-[calc(100vh-var(--scorer-header-height))]` or a measured/header wrapper so the middle row truly gets remaining visible scorer space.

## Football migration steps

Current routed Football app uses `FootballScorerShell` from `/Users/bryanshepherd/strata-football-ui-new/src/main.jsx:13`. That shell currently uses a max-width grid with fixed side columns in `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:93`, so it should be migrated before the older `src/App.jsx` shell.

1. Add `ScorerLayoutShell` as a local Football component.
   - Keep it geometry-only.
   - Include `min-h-0` on the middle row and slot wrappers.
   - Use `w-1/5`, `w-[65%]`, and `w-[15%]` directly or replace existing `.w-main-content` / `.w-sidebar-right` with canonical non-responsive definitions.

2. Extract routed Football slot wrappers from `FootballScorerShell.jsx`.
   - `FootballScoreboardSlot`: wrap `Scorebug` plus `ClockDownDistanceStrip`.
   - `FootballStatsSlot`: initially wrap `RosterLookup` if no live stats panel is ready, but label this as an interim mismatch. Preferred target is `TeamPlayerStats` or a routed-shell-compatible equivalent.
   - `FootballInputSlot`: wrap `DriveStatusBand` plus `PlayEntryWorkspace`, preserving current content order.
   - `FootballEventLogSlot`: wrap `GameLogColumn`.
   - `FootballInputAssistantSlot`: create a bottom assistant using existing flow/status data or migrate the older `InputAssistant` component if compatible.

3. Replace the current grid in `FootballScorerShell`.
   - Remove or bypass `xl:grid-cols-[280px_minmax(0,1fr)_340px]`.
   - Render `ScorerLayoutShell` below `ScorerHeader`.
   - Preserve `FootballDebugTracePanel` behavior as an external fixed/debug panel.

4. Preserve existing Football internals.
   - Do not rewrite `Scorebug`, `ClockDownDistanceStrip`, `DriveStatusBand`, `PlayEntryWorkspace`, `GameLogColumn`, or event data handling while standardizing shell geometry.
   - Only change where those components are placed.

5. Reconcile the legacy `src/App.jsx` shell.
   - Decide whether it is obsolete, a PHP integration shell, or a fallback.
   - If still used anywhere, apply the same shell component there after routed shell migration.
   - Existing legacy mappings are already close for Stats/Input/Event Log, but `Scoreboard` and `InputAssistant` must move out of the center column.

6. Update Football CSS.
   - Remove or scope breakpoint overrides in `/Users/bryanshepherd/strata-football-ui-new/src/index.css:121` and `/Users/bryanshepherd/strata-football-ui-new/src/index.css:131` if they would silently change the canonical `20/65/15` desktop geometry.
   - Prefer shell-local classes over global `.w-main-content` and `.w-sidebar-right` if those classes are shared with legacy surfaces.

7. Validate Football visually and behaviorally.
   - Confirm scoreboard spans full width.
   - Confirm middle row columns are `20/65/15`.
   - Confirm assistant spans full width at bottom.
   - Confirm Football play input, event log, debug panel, and fixture switching still work.

## Existing Football slot mapping

| Canonical slot | Routed Football component target | Legacy Football component target | Notes |
| --- | --- | --- | --- |
| Scoreboard | `Scorebug` + `ClockDownDistanceStrip` | `Scoreboard` | Routed shell should promote scorebug/clock to top full-width. Legacy shell already has a scoreboard component but places it inside the center column. |
| Stats | Preferred: `TeamPlayerStats` or new routed-compatible stats wrapper. Interim: `RosterLookup` | `TeamPlayerStats` | Routed shell currently lacks a true stats panel. Using `RosterLookup` keeps the slot occupied but is not semantically complete. |
| Input | `DriveStatusBand` + `PlayEntryWorkspace` | `EventControls`; optionally keep `DriveSummaryChips` inside Input | Drive/field context is sport-specific and should stay inside the Input slot, not become a new outer-shell region. |
| Event Log | `GameLogColumn` | `GameLog` | Routed `GameLogColumn` has its own max-height; this should be reviewed once slot wrapper owns scroll. |
| Input Assistant | New wrapper or migrated `InputAssistant` | `InputAssistant` | Routed shell currently has no assistant. Legacy assistant is center-column-only and should become full-width when used. |

## Volleyball initial UI scaffold steps

Volleyball currently has adapter/package support but no scorer UI. The initial scaffold should start with the canonical shell rather than copying Football's current routed grid.

1. Choose the Volleyball UI location.
   - If the standalone repo becomes a UI app, add React/Vite app structure under `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui`.
   - If Volleyball lives in StrataSportsSuite first, create the scorer route/app area there and keep adapter imports explicit.

2. Add the shared `ScorerLayoutShell`.
   - Use the same geometry contract as Football.
   - Keep shell independent of volleyball adapter types.

3. Create placeholder-but-real slot components.
   - `VolleyballScoreboard`: match/set score, current set, serving team, sideout/rotation status.
   - `VolleyballTeamPlayerStats` or `VolleyballSetStats`: set-by-set team stats first; player stats can be added later.
   - `VolleyballEventControls`: visual wrapper around quick input/rally controls.
   - `VolleyballRallyLog` or `VolleyballEventLog`: current set rallies and accepted rally events.
   - `VolleyballInputAssistant`: parser prompts, validation errors, replay confirmation state, sync status.

4. Wire adapter state without broad behavior.
   - Use `parseVolleyballInputSequence` and `applyVolleyballInputIntent` from the adapter as input-domain helpers.
   - Keep UI state local for the initial scaffold unless a canonical backend envelope endpoint exists.
   - Do not invent production XML/stat delivery behavior in the layout step.

5. Build a minimal fixture envelope.
   - Provide one local demo/test envelope for rendering slot states.
   - Mark it clearly as fixture data if committed.
   - Avoid fake production data or implied real-game readiness.

6. Add route and navigation only after shell renders.
   - If in StrataSportsSuite, keep the currently disabled Volleyball dashboard state until the scorer can load a real or explicit fixture route.
   - If in standalone repo, add `/` or `/scorer` route consistent with Football.

7. Validate scaffold.
   - Render desktop and narrow viewport screenshots.
   - Confirm all five slots exist even if some are initially empty-state panels.
   - Confirm no slot creates page-level overflow when internal scroll is expected.

## Volleyball components to create

| Component | Slot | Initial props | Purpose |
| --- | --- | --- | --- |
| `VolleyballScoreboard` | Scoreboard | `envelope`, `matchState`, `teams`, `currentSet` | Full-width top match/set score display |
| `VolleyballSetStats` or `VolleyballTeamPlayerStats` | Stats | `envelope`, `sets`, `teams`, `players` | Left-column set/team/player stats |
| `VolleyballEventControls` | Input | `envelope`, `inputBuffer`, `onInput`, `onApplyIntent` | Center rally entry controls and quick-input surface |
| `VolleyballRallyLog` | Event Log | `sets`, `rallies`, `events`, `currentSet` | Right-column rally/event history |
| `VolleyballInputAssistant` | Input Assistant | `parseResult`, `prompt`, `error`, `syncStatus`, `lastAction` | Bottom full-width status/help/prompt panel |
| `VolleyballScorerShell` | Composition | Slot data and handlers | Sport-specific assembly around `ScorerLayoutShell` |

## Responsive behavior recommendation

Desktop/tablet landscape should preserve Basketball's canonical `20/65/15` middle row. Avoid Football's current fixed `280px / 1fr / 340px` grid and avoid silent desktop breakpoint changes to `70/20/10`.

Recommended behavior:

- `>= 1024px`: canonical horizontal row, `20% / 65% / 15%`.
- `768px - 1023px`: keep horizontal row if usable, but allow sport-specific compact internals inside each slot.
- `< 768px`: use a documented stacked mode only if necessary:
  - Scoreboard full width.
  - Input first.
  - Input Assistant sticky or immediately below Input.
  - Stats and Event Log as collapsible panels or stacked below.

If stacked mode is implemented, it should be explicit in `ScorerLayoutShell` props, for example `mobileMode="stacked"` or `mobileMode="tabs"`, not accidental CSS overrides hidden in sport CSS.

## Risks

- Football routed shell has no true bottom input assistant; creating one may require reading flow state from contexts not currently used by `FootballScorerShell`.
- Football routed left column is roster lookup, not stats. Replacing it with `TeamPlayerStats` may need data-shape adaptation from fixture envelope to legacy `gameState`.
- Moving `Scorebug` out of the center column may change perceived visual hierarchy even if behavior is preserved.
- `GameLogColumn` currently owns `max-h-[calc(100vh-170px)]`; moving scroll responsibility to the slot wrapper can create double-scroll unless cleaned up.
- Existing Football CSS breakpoint overrides can conflict with canonical widths.
- Volleyball lacks a UI app, scorer route, and production envelope source; scaffold work could drift into domain implementation if not kept narrow.
- Shared shell extraction across separate repos may create duplication first; a true shared package should wait until both Football and Volleyball prove the contract.

## Files likely to change later

Football:

- `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx`
- `/Users/bryanshepherd/strata-football-ui-new/src/components/scorer/ScorerLayoutShell.jsx`
- `/Users/bryanshepherd/strata-football-ui-new/src/index.css`
- `/Users/bryanshepherd/strata-football-ui-new/src/components/TeamPlayerStats.jsx`
- `/Users/bryanshepherd/strata-football-ui-new/src/components/InputAssistant.jsx`
- `/Users/bryanshepherd/strata-football-ui-new/src/components/GameLog.jsx`
- `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx` if the legacy shell remains live anywhere
- `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.test.jsx`

Volleyball:

- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/package.json` if the standalone repo becomes a UI app
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/main.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/pages/VolleyballScorerShell.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/components/scorer/ScorerLayoutShell.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/components/VolleyballScoreboard.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/components/VolleyballSetStats.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/components/VolleyballEventControls.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/components/VolleyballRallyLog.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/src/components/VolleyballInputAssistant.jsx`
- `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/apps/dashboard/src/data/sports.ts` only when enabling/linking Volleyball navigation

## Validation plan for later implementation

- Run Football unit tests after shell migration.
- Add a layout-focused render test for `ScorerLayoutShell` slot order and class contract.
- Use browser screenshots at desktop and narrow widths to verify the five slots.
- For Volleyball scaffold, add smoke render tests before wiring production data.
- Do not treat successful layout rendering as proof of scorer-domain correctness.

## No code changes in this step

This file is the only intended deliverable for this step. No app behavior, routes, shell code, CSS, or component implementation should change until a separate implementation task is approved.
