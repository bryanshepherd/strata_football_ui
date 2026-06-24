# STR-66 Football Layout Migration

## Scope

This implementation covers the Football scorer shell in `/Users/bryanshepherd/strata-football-ui-new`.

Volleyball scaffolding is not implemented in this repo. The STR-66 Volleyball work should happen in the chosen Volleyball UI location after that app surface is selected.

## Shared shell contract

Football now has a geometry-only scorer shell at `src/components/scorer/ScorerLayoutShell.jsx`.

The shell owns only the canonical slot structure:

- Scoreboard: top full-width row.
- Middle row:
  - Stats: `20%`.
  - Input: `65%`.
  - Event Log: `15%`.
- Input Assistant: bottom full-width row.

Sport-specific content is passed into the shell as React slot props. The shell does not know football rules, rosters, play entry, event mutation, or fixture semantics.

## Routed Football migration

`src/pages/FootballScorerShell.jsx` now renders the routed football scorer through `ScorerLayoutShell`.

Slot mapping:

| Canonical slot | Football content |
| --- | --- |
| Scoreboard | `Scorebug` plus `ClockDownDistanceStrip` |
| Stats | `RosterLookup` as the interim stats-slot occupant |
| Input | `DriveStatusBand` plus `PlayEntryWorkspace` |
| Event Log | `GameLogColumn` |
| Input Assistant | `FootballInputAssistantSlot` with status, down/distance, and last-event context |

The migration preserves the existing routed football internals and only changes their outer shell placement.

## Validation

Added layout-focused coverage in:

- `src/components/scorer/ScorerLayoutShell.test.jsx`
- `src/pages/FootballScorerShell.test.jsx`

Validated commands:

```bash
npm run test:run -- src/components/scorer/ScorerLayoutShell.test.jsx src/pages/FootballScorerShell.test.jsx
```
