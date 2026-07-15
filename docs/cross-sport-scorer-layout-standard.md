# Cross-Sport Scorer UI Layout Standard

## Do Not Change Yet

This document is documentation/audit only. It defines the Basketball-derived scorer layout standard and maps current Football and Volleyball surfaces against it. Do not refactor, re-slot, rename, or change app behavior from this report alone.

## Basketball canonical layout summary

The canonical scorer layout is based on `docs/stratabasketball-ui-dimensions-audit.md`.

Basketball uses a single scorer shell with:

- Scoreboard: top row, full width, content-derived height.
- Middle row: horizontal flex row that takes the remaining scorer space.
- Stats: left middle column, `20%`.
- Input: center middle column, `65%`.
- Event Log: right middle column, `15%`.
- Input Assistant: bottom row, full width, content-derived height. Sticky/persistent behavior is acceptable when already present.

Basketball slot mapping:

| Slot | Basketball component | Canonical placement | Canonical sizing |
| --- | --- | --- | --- |
| Scoreboard | `Scoreboard` | Top row, full width | Content-derived height |
| Stats | `TeamPlayerStats` | Middle row left column | `20%` width |
| Input | `EventControls` | Middle row center column | `65%` width |
| Event Log | `GameLog` | Middle row right column | `15%` width |
| Input Assistant | `InputAssistant` | Bottom row, full width | Content-derived height |

Source references from the Basketball audit:

- Basketball shell: `/Users/bryanshepherd/strata-basketball-ui/src/App.jsx:333`.
- Basketball middle flex row: `/Users/bryanshepherd/strata-basketball-ui/src/App.jsx:338`.
- Basketball Stats/Input/Event Log columns: `/Users/bryanshepherd/strata-basketball-ui/src/App.jsx:340`, `/Users/bryanshepherd/strata-basketball-ui/src/App.jsx:345`, `/Users/bryanshepherd/strata-basketball-ui/src/App.jsx:350`.
- Basketball custom width classes: `/Users/bryanshepherd/strata-basketball-ui/src/index.css:48`.

## Width standard

| Slot | Standard width |
| --- | --- |
| Stats | `20%` |
| Input | `65%` |
| Event Log | `15%` |

The standard is intentionally percentage-based so sport-specific content can differ while the scorer muscle memory remains consistent.

## Height standard

| Slot | Standard height behavior |
| --- | --- |
| Scoreboard | Content-derived top row |
| Middle row | Remaining available scorer space |
| Input Assistant | Content-derived bottom row |

The recommended shell shape is:

```jsx
<div className="min-h-screen flex flex-col">
  <ScoreboardSlot />
  <div className="flex flex-1 min-h-0">
    <div className="w-1/5 min-h-0 overflow-y-auto"><StatsSlot /></div>
    <div className="w-main-content min-h-0 overflow-y-auto"><InputSlot /></div>
    <div className="w-sidebar-right min-h-0 overflow-y-auto"><EventLogSlot /></div>
  </div>
  <InputAssistantSlot />
</div>
```

`min-h-0` is important on the middle row and scrollable children when using nested flex layouts. Without it, children with `h-full` or large content can force the page taller than the viewport instead of scrolling internally.

## Football current layout map

The routed Football app currently renders `FootballScorerShell`, not `src/App.jsx`: `/Users/bryanshepherd/strata-football-ui-new/src/main.jsx:13`.

### Routed Football shell

`FootballScorerShell` uses a max-width CSS grid rather than the Basketball full-width top/middle/bottom structure:

- Shell root: `min-h-screen bg-zinc-100 text-zinc-950`, with optional debug bottom padding at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:84`.
- Header row: `ScorerHeader` is rendered above the content grid at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:85`.
- Main layout grid: `mx-auto grid max-w-[1500px] gap-4 px-4 py-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:93`.
- Left column: `RosterLookup` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:94`.
- Center column: `Scorebug`, `ClockDownDistanceStrip`, `DriveStatusBand`, and `PlayEntryWorkspace` inside `section className="min-w-0 space-y-4"` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:96`.
- Right column: `GameLogColumn` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:103`.

| Basketball slot | Current Football equivalent | Current placement | Current dimensions/overflow | Gap against standard |
| --- | --- | --- | --- | --- |
| Scoreboard | `Scorebug` plus `ClockDownDistanceStrip` | Center column, above drive/input sections | `Scorebug` is a content-height section with `grid ... md:grid-cols-[1fr_auto_1fr]` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:195`; `ClockDownDistanceStrip` uses `md:grid-cols-5` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:239` | Not top full-width; scoreboard information is confined to the center grid column |
| Stats | `RosterLookup` is the closest left-column panel; no team/player stats panel in routed shell | Left grid column | Fixed grid track of `280px` at `xl`; no explicit scroll on the aside; roster rows are content-derived at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:397` | Left slot is roster lookup, not sport stats; width is fixed `280px`, not `20%` |
| Input | `PlayEntryWorkspace` | Center grid column below score/drive sections | Content-derived section; inner grid uses `lg:grid-cols-[1fr_240px]` and min input workspace `min-h-[240px]` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:299` and `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:303` | Input is center column, but width is `minmax(0,1fr)` between fixed sidebars, not `65%`; scoreboard and drive bands share the same center column |
| Event Log | `GameLogColumn` | Right grid column | Fixed grid track of `340px` at `xl`; log body has `max-h-[calc(100vh-170px)] overflow-auto` at `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:353` and `/Users/bryanshepherd/strata-football-ui-new/src/pages/FootballScorerShell.jsx:358` | Right slot exists but width is fixed `340px`, not `15%` |
| Input Assistant | None in routed shell | Missing | No bottom assistant/status/help row | Missing canonical bottom full-width assistant |

### Legacy/alternate Football shell

`src/App.jsx` contains Basketball-named component equivalents, but it is not the routed app entry today. It is still useful as a migration reference.

| Basketball slot | Football component in `src/App.jsx` | Current placement | Current dimensions/overflow | Gap against standard |
| --- | --- | --- | --- | --- |
| Scoreboard | `Scoreboard` | Inside the 65% middle column | Root scoreboard is `bg-black text-white px-8 py-4 w-full` at `/Users/bryanshepherd/strata-football-ui-new/src/components/Scoreboard.jsx:132`; rendered inside `w-main-content bg-white flex flex-col` at `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:295` | Component exists but is not a top full-width row |
| Stats | `TeamPlayerStats` | Left column | Parent `w-1/5` at `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:286`; component root `p-2 overflow-y-auto h-full` at `/Users/bryanshepherd/strata-football-ui-new/src/components/TeamPlayerStats.jsx:272` | Width matches `20%` |
| Input | `EventControls` | Center column, below Scoreboard and DriveSummaryChips | Parent `w-main-content` at `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:295`; component root `bg-white p-4 h-full overflow-y-auto` at `/Users/bryanshepherd/strata-football-ui-new/src/components/EventControls.jsx:53` | Width matches `65%`, but the center column also owns Scoreboard and Assistant |
| Event Log | `GameLog` | Right column | Parent `w-sidebar-right` at `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:312`; component root `bg-white h-full flex flex-col` and list `flex-1 overflow-y-auto` at `/Users/bryanshepherd/strata-football-ui-new/src/components/GameLog.jsx:119` and `/Users/bryanshepherd/strata-football-ui-new/src/components/GameLog.jsx:141` | Width matches `15%` |
| Input Assistant | `InputAssistant` | Bottom of center column only | Root `bg-white border-t border-gray-200 p-4` at `/Users/bryanshepherd/strata-football-ui-new/src/components/InputAssistant.jsx:158`; rendered at `/Users/bryanshepherd/strata-football-ui-new/src/App.jsx:308` | Component exists but is not bottom full-width |

Football width definitions in `src/index.css`:

- `.w-main-content { width: 65%; }`: `/Users/bryanshepherd/strata-football-ui-new/src/index.css:7`.
- `.w-sidebar-right { width: 15%; }`: `/Users/bryanshepherd/strata-football-ui-new/src/index.css:11`.
- Football currently overrides these at breakpoints: `.w-main-content` becomes `70%` and `.w-sidebar-right` becomes `10%` below `1024px`, then both become `100%` below `768px`: `/Users/bryanshepherd/strata-football-ui-new/src/index.css:121` and `/Users/bryanshepherd/strata-football-ui-new/src/index.css:131`.

## Volleyball current layout map

No current Volleyball scorer UI layout was found.

The standalone Volleyball repo is package-only:

- Root package: `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/package.json:1`.
- Workspaces only include `packages/*`: `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/package.json:6`.
- Available scripts are adapter `test` and `typecheck`; there is no `dev`, `build`, React app, or route script: `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/package.json:9`.
- The adapter exposes parser/result types such as `VolleyballInputPrompt`, `VolleyballInputIntent`, and `VolleyballInputParseResult` at `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/packages/strata-volleyball-adapter/src/input.ts:15`.
- The adapter parses raw rally input and applies it to an envelope at `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/packages/strata-volleyball-adapter/src/input.ts:544` and `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/packages/strata-volleyball-adapter/src/input.ts:586`.

The suite checkout has Volleyball as planned/scaffolded, not a live scorer shell:

- Sports registry describes Volleyball as an "Upcoming scoreboard" with `availability: "planned"` at `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/apps/dashboard/src/data/sports.ts:89`.
- Dashboard primary nav marks Volleyball disabled at `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/apps/dashboard/src/components/dashboard/DashboardShell.tsx:11`.
- XML export scaffolding exists with `rootTag: "vbgame"` at `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/apps/dashboard/src/services/xml/builders/exportVolleyballXml.ts:3`.

| Basketball slot | Current Volleyball equivalent | Current placement | Current dimensions/overflow | Gap against standard |
| --- | --- | --- | --- | --- |
| Scoreboard | None in UI. Domain data exists in adapter envelope types, and suite text says upcoming scoreboard | Missing | No UI component, width, height, parent, or overflow behavior | Must be created for scorer UI |
| Stats | None in UI | Missing | No UI component, width, height, parent, or overflow behavior | Must be created or mapped to a future set/team/player stats panel |
| Input | No UI component. Adapter parser is closest domain equivalent | No layout placement; parser functions only | No width/height. Parser prompt/intent types are non-visual at `/Applications/XAMPP/xamppfiles/htdocs/strata-volleyball-ui/packages/strata-volleyball-adapter/src/input.ts:43` | Must wrap parser in a visual input controls slot |
| Event Log | No UI component. Rally events exist in adapter envelope operations | Missing | No UI component, width, height, parent, or overflow behavior | Must be created as rally/event log |
| Input Assistant | No UI component. Parser prompts/errors are closest data source | Missing | No UI component, width, height, parent, or overflow behavior | Must be created as bottom full-width assistant/status panel |

## Recommended standardized slot mapping

| Slot | Basketball | Football target | Volleyball target |
| --- | --- | --- | --- |
| Scoreboard | `Scoreboard` | Routed shell: extract/promote `Scorebug` plus clock/down-distance state into a full-width top row. Legacy shell: move `Scoreboard` out of the center column to the shell top row. | New `VolleyballScoreboard` or equivalent using match/set score, serving team, rotation/sideout state |
| Stats | `TeamPlayerStats` | Routed shell: replace or augment `RosterLookup` with `FootballTeamPlayerStats` in the 20% left slot. Legacy shell: keep `TeamPlayerStats` in left `20%` slot. | New `VolleyballTeamPlayerStats`, `VolleyballSetStats`, or combined stats panel in the 20% left slot |
| Input | `EventControls` | Routed shell: place `PlayEntryWorkspace` or live `EventControls` in the 65% center slot only. Legacy shell: keep `EventControls`, but remove scoreboard/assistant from the center column. | New `VolleyballEventControls` wrapping quick-input/rally controls in the 65% center slot |
| Event Log | `GameLog` | Routed shell: place `GameLogColumn` in the 15% right slot. Legacy shell: keep `GameLog`. | New `VolleyballRallyLog` or `VolleyballEventLog` in the 15% right slot |
| Input Assistant | `InputAssistant` | Routed shell: create or reuse an assistant/status panel as bottom full-width. Legacy shell: move `InputAssistant` out of the center column to the shell bottom row. | New `VolleyballInputAssistant` using parser prompts/errors/status as bottom full-width |

## Standardization notes

- Use one scorer shell contract across sports: top scoreboard, middle row with three slots, bottom assistant.
- Keep sport-specific internals inside slots. Football can show down/distance and drive context; Volleyball can show set/rally/rotation context; those should not change the outer slot geometry.
- Prefer `flex flex-col min-h-screen` for the shell and `flex flex-1 min-h-0` for the middle row.
- Put `overflow-y-auto` on the Stats, Input, and Event Log slot bodies when their content can exceed available height.
- Avoid relying only on `h-full` inside nested flex children. Pair it with `min-h-0` on flex parents so internal scrolling works.
- If a sport needs responsive behavior, document it explicitly. Basketball currently has no scorer responsive breakpoint changes; Football currently has CSS breakpoint overrides that depart from the 20/65/15 standard.
- Fixed sidebars like Football's routed `280px`/`340px` grid tracks should be treated as non-standard unless a future standard explicitly allows fixed-width sport shells.

## Validation

No build, lint, or test command was run. This pass only read source files and wrote this documentation report.
