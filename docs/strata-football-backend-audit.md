# Strata Football Backend Repo Audit

Date: 2026-06-20
Linear: STR-56

## Summary

The canonical backend repo was missing locally and was cloned to `/Users/bryanshepherd/strata_football` from `https://github.com/bryanshepherd/strata_football.git`.

The cloned backend repo is currently only an initial shell: clean `main`, remote `origin`, commit `33ec8fc`, and `README.md` containing only `# strata_football`. It has no PHP routes, no database layer, no schema, no tests, no reports, no roster endpoints, and no submit endpoint.

The practical backend code to audit today is still mixed into `/Users/bryanshepherd/strata-football-ui-new`:
- New envelope-oriented PHP scaffold under `api/`.
- Legacy database-backed PHP under `legacy/api/`.
- Frontend API clients and documentation that still reference endpoints not present in the canonical backend repo.

Recommendation: make `/Users/bryanshepherd/strata_football` the backend source of truth, but seed it deliberately from the UI-workspace PHP scaffold only after the contract shape is finalized. Do not promote the legacy database API as-is. Use the StrataBasketball envelope pattern as the communication model: load an authoritative envelope, submit one event/intent shape, project on the backend, and return the accepted updated envelope.

## Backend Repo Location And Branch/Remote

Canonical backend repo:
- Local path: `/Users/bryanshepherd/strata_football`
- Remote: `origin https://github.com/bryanshepherd/strata_football.git`
- Branch: `main`
- HEAD: `33ec8fc Initial commit`
- Worktree status: clean after clone.

Current file inventory:
- `/Users/bryanshepherd/strata_football/README.md`

Current README content:
- `# strata_football`

Conclusion:
- The canonical backend repo exists and is aligned to the expected remote.
- It does not yet contain the backend/API implementation needed by the football UI.

## Endpoint Inventory

### Canonical Backend Repo

`/Users/bryanshepherd/strata_football` currently contains no endpoint files.

Missing from canonical backend repo:
- Load game state/envelope endpoint.
- Submit event/play endpoint.
- Roster endpoint.
- Stats endpoint.
- Reports endpoint.
- Active-drive endpoint.
- Drive-penalties endpoint.
- Penalty-chart endpoint.
- Game-control endpoint.
- Delete/insert/update play endpoints.
- Clock update endpoint.

### UI-Workspace New PHP Scaffold

Files currently under `/Users/bryanshepherd/strata-football-ui-new/api/`:
- `api/routes/load_game_state.php`
- `api/bootstrap.php`
- `api/config.php`
- `api/Http/Response.php`
- `api/Repositories/GameRepository.php`
- `api/Services/GameStateService.php`
- `api/Support/GameEnvelope.php`
- `api/Support/LiveControllerResolver.php`
- `api/Support/PlayCollection.php`
- `api/Support/Schema/GameEnvelopeSchema.php`
- `api/Support/Schema/GameSchemaValidator.php`
- `api/Support/Schema/PlaySchema.php`
- `api/Support/Schema/SchemaValidationException.php`
- `api/Support/Schema/SchemaValidatorInterface.php`

Implemented route:
- `api/routes/load_game_state.php`
  - Accepts `gameId` or `game_id`.
  - Reads config from `api/bootstrap.php`.
  - Loads a game through `GameRepository` and `GameStateService`.
  - Returns `{ success: true, game: $envelope }`.

Endpoint gaps in the new scaffold:
- No submit route.
- No event append/project route.
- No roster route.
- No reports/stats route.
- No active-drive or drive-penalty route.
- No delete/insert/update play route.
- No clock route.

### UI-Workspace Legacy PHP API

Files currently under `/Users/bryanshepherd/strata-football-ui-new/legacy/api/`:
- `legacy/api/StrataFootballAPI.php`
- `legacy/api/YardLineConverter.php`
- `legacy/api/end_scoring.php`
- `legacy/api/get_games.php`
- `legacy/api/load_game_state.php`
- `legacy/api/start_scoring.php`
- `legacy/api/submit_play.php`

Legacy endpoint behavior:
- `legacy/api/get_games.php`: list games from MySQL `strata_football`.
- `legacy/api/start_scoring.php`: transfer game to `game_state`, initialize stats, acquire game lock.
- `legacy/api/load_game_state.php`: call `StrataFootballAPI::loadGameState($gameId)`.
- `legacy/api/submit_play.php`: call `StrataFootballAPI::submitPlay($gameId, $playData)`.
- `legacy/api/end_scoring.php`: finalize scoring and release lock.

Legacy response model:
- `loadGameState()` returns keys such as `game_info`, `live_state`, `current_drive`, `recent_plays`, `team_stats`, `player_stats`, `game_rules`, and `lock_info`.
- `submitPlay()` returns `success`, `play_id`, `message`, and `updated_game_state`.

Legacy limitations:
- Direct PDO construction with `mysql:host=localhost;dbname=strata_football`, user `root`, empty password.
- Session-dependent access and locking.
- Table-mutating submit flow across `plays`, `drives`, `game_state`, `team_statistics`, `game_statistics`, and `games`.
- Placeholder stats updates in `updatePlayerStats()` and `updateTeamStats()`.
- Not envelope-first and not compatible with the STR-55 target without a wrapper or rewrite.

### Frontend-Referenced Endpoints Not Present In Canonical Backend

The current UI and docs reference:
- `/strata_football/api/load_game_state.php`
- `/strata_football/api/submit_play_enhanced.php`
- `/strata_football/api/get_rosters.php`
- `/strata_football/api/get_active_drive.php`
- `/strata_football/api/get_drive_penalties.php`
- `/strata_football/api/get_penalty_chart.php`
- `/strata_football/api/delete_play.php`
- `/strata_football/api/insert_play.php`
- `/strata_football/api/update_game_clock.php`
- `/strata_football/api/football/submit_event.php`
- `/strata_football/php/reports/quickie_report.php`

None of those are implemented in `/Users/bryanshepherd/strata_football` today.

## Database/Config Assumptions

Canonical backend repo:
- No config files.
- No database code.
- No schema files.
- No migrations.
- No environment sample.

New UI-workspace PHP scaffold:
- `api/config.php` assumes file-backed canonical JSON game envelopes in `storage/games`.
- `api/config.php` expects schema path `schema/game.schema.json`.
- `api/config.php` configures permissive JSON/CORS response headers.
- `api/Repositories/GameRepository.php` reads `{gameId}.json` files and validates decoded JSON.
- This is closer to the clean rebuild direction, but it is currently incomplete and not in the canonical backend repo.

Legacy UI-workspace PHP:
- Assumes MySQL database `strata_football`.
- Assumes local `root` user with empty password.
- Assumes tables including `games`, `game_state`, `game_rules`, `drives`, `plays`, `team_statistics`, `game_statistics`, `players`, `teams`, and `users`.
- Assumes PHP session fields including `UserID`, `Role`, and `ParentAdminID`.
- Uses game locks on the `games` table.

Deployment assumptions still unresolved:
- STR-48 documented frontend/API namespace `/strata_football/`.
- STR-48 observed local XAMPP folder `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/StrataFootball`.
- No top-level `/Applications/XAMPP/xamppfiles/htdocs/strata_football` folder was observed during the baseline pass.

## Existing Football Envelope/State Model

### New PHP Scaffold Envelope

The new PHP scaffold is envelope-oriented:
- `api/Support/GameEnvelope.php` wraps a canonical `game` object.
- `GameEnvelope::fromArray()` requires a top-level `game` key.
- `GameEnvelope::toArray()` canonicalizes field ordering through `GameEnvelopeSchema`.
- `api/Support/Schema/GameEnvelopeSchema.php` orders `venue`, `liveController`, `officials`, `rules`, and `plays`.
- `api/Services/GameStateService.php` exposes `getGameEnvelope()` and `getLiveSnapshot()`.
- `api/Support/PlayCollection.php` derives drive segments from `driveStart` and `driveEnd` events embedded in plays.
- `api/Support/Schema/PlaySchema.php` recognizes `driveStart`, `driveEnd`, game-control payloads, and `sequenceKey`.
- `api/Support/Schema/GameSchemaValidator.php` validates venue, officials, rules, liveController, plays, contexts, score, generated metadata, and event payloads such as rush, pass, receive, return, penalty, freekick, punt, field goal, PAT, tackle, fumble, sack, and game control.

This scaffold is the strongest football-specific salvage candidate.

Gaps:
- No append/submit/projection service.
- No idempotency or sequence ownership beyond validation helpers.
- No accepted-envelope response after submit.
- No database or file write path for accepted events.
- `api/routes/load_game_state.php` returns `{ success, game }`, which does not match the current frontend loader contract and does not match the recommended basketball-style `{ status, data }` envelope convention.

### Legacy SQL State Model

The legacy API is table-state oriented:
- `game_state` holds current period, clock, down, distance, yard line, possession, timeouts, challenges, status, red-zone, and goal-to-go.
- `plays` stores inserted play rows.
- `drives` stores drive summaries and active drive state.
- `team_statistics` and `game_statistics` hold stats.
- `games` stores scores, lock fields, teams, and schedule metadata.

This model contains useful domain concepts but should not be the clean rebuild runtime contract. It can inform migration and database persistence after the envelope contract is stable.

## Comparison To UI-Workspace PHP Scaffolding

| Area | Canonical backend repo `/Users/bryanshepherd/strata_football` | UI new scaffold `/Users/bryanshepherd/strata-football-ui-new/api` | UI legacy API `/Users/bryanshepherd/strata-football-ui-new/legacy/api` | Recommendation |
| --- | --- | --- | --- | --- |
| Repo status | Empty initial shell | Untracked/mixed into UI workspace | Legacy reference code | Move backend ownership to canonical repo. |
| Load endpoint | Missing | Present as `api/routes/load_game_state.php` | Present as `legacy/api/load_game_state.php` | Seed canonical backend from new scaffold, then align response contract. |
| Submit endpoint | Missing | Missing | Present as `legacy/api/submit_play.php` | Rebuild as envelope event submit; do not port legacy submit as-is. |
| Envelope model | Missing | Strong salvage candidate | None | Promote new scaffold concepts into canonical backend. |
| Persistence | Missing | File-backed JSON assumption | MySQL tables | Start file/fixture-backed for contract tests, then map to DB deliberately. |
| Rosters | Missing | Missing | Indirect through players/teams tables | Define roster envelope first; do not rely on legacy implicit joins. |
| Stats/reports | Missing | Missing | Partial stats reads and placeholder updates | Rebuild from accepted envelope/event projection. |
| Drive handling | Missing | `PlayCollection::driveSegments()` from events | `drives` table mutation | Prefer envelope-derived drives, persist projections later. |
| Validation | Missing | `GameSchemaValidator` with football event payloads | Minimal runtime exceptions | Salvage validator but loosen `plays` empty requirement for pregame fixtures. |
| Lock/idempotency | Missing | Missing | Session lock only | Add client event id/idempotency and optional scorer lock in canonical backend. |

## StrataBasketball Envelope Communication Summary

Reference files:
- `/Users/bryanshepherd/strata-basketball-ui/src/services/basketballEnvelopeSyncService.js`
- `/Users/bryanshepherd/strata-basketball-ui/src/services/basketballEnvelopeService.js`
- `/Users/bryanshepherd/strata-basketball-ui/src/contexts/BasketballGameContext.jsx`
- `/Users/bryanshepherd/strata-basketball-ui/src/types/basketballEnvelope.js`
- `/Users/bryanshepherd/strata-basketball-ui/documentation/contracts/basketball-handler-apis.md`
- `/Users/bryanshepherd/strata-basketball-ui/documentation/contracts/basketball-scorer.openapi.yml`
- `/Applications/XAMPP/xamppfiles/htdocs/StrataSportsSuite/packages/strata-basketball-adapter/src/index.ts`

Basketball load pattern:
- `basketballEnvelopeSyncService.js` builds an envelope URL as `/basketball/games/{gameId}/envelope`.
- `fetchRemoteBasketballEnvelopeRecord(gameId)` performs a GET with JSON headers and configured credentials.
- `BasketballGameContext` loads local/seeded envelope data first, optionally fetches remote envelope, reconciles local vs remote by `live.lastUpdated`, imports the chosen envelope, and maps it into legacy UI state.
- `basketballEnvelopeService.js` normalizes every envelope and validates required sections before caching it.

Basketball submit/sync pattern:
- `BasketballGameContext.submitEvent(eventData)` routes through envelope mode.
- `submitEvent()` calls `ingestUiEventIntoEnvelope(eventData)`.
- `ingestUiEventIntoEnvelope()` maps a UI event into one or more envelope events.
- `appendEnvelopeEvent()` assigns an event id if missing, assigns `seq` as previous last `seq + 1`, appends the event, recalculates live state from events, persists the snapshot, and notifies subscribers.
- When remote sync is enabled, `BasketballGameContext` calls `syncEnvelopeNow({ force: true })`.
- `syncEnvelopeNow()` calls `uploadRemoteBasketballEnvelope(gameId, envelope)` with POST to `/basketball/games/{gameId}/envelope`.
- The OpenAPI draft also describes a server-side target pattern for `/api/basketball/events`: submit an event, accept it, replay/project into game state, and return `event_id` plus updated `game_state`.

Basketball projection pattern:
- `basketballEnvelopeService.js` recalculates `live` state from ordered events.
- `calculateBasketballStats(envelope)` derives team/player stats from the latest envelope.
- `interpretBasketballEvents(envelope)` derives the ordered play log.
- UI rendering consumes derived state, not ad hoc endpoint fragments.

Basketball sequencing/idempotency clues:
- Events carry `id`, `seq`, `timestamp`, and `data`.
- Missing ids are generated client-side.
- Missing `seq` values are normalized or assigned from the current event list.
- Deletion and insertion paths re-sequence events and recalculate live state.
- The current basketball sync code uses last-updated reconciliation and event sequencing; it is not a full conflict-free multi-scorer model.

Basketball state-drift guardrails:
- Envelope is the single source of runtime truth.
- Every mutation recalculates derived live state from events.
- Subscribers are notified from the cached envelope snapshot.
- Remote sync is explicit and retryable through `hasPendingEnvelopeSync`.
- Background sync imports newer remote envelopes only when remote `updatedAt` beats local `live.lastUpdated`.

## Football Target Pattern From Basketball

Football should mirror the communication pattern, not the exact basketball domain model:

1. `GET /strata_football/api/games/{gameId}/envelope`
- Returns canonical football `GameEnvelope`.
- Response should include status metadata and the authoritative envelope.
- Backend owns the stored envelope.

2. `POST /strata_football/api/games/{gameId}/events`
- Accepts one canonical football event/intent shape.
- Requires `clientEventId`, `gameId`, pre-play context, event type/subtype, participants, result, penalties, and client/session metadata.
- Rejects stale or duplicate events deterministically.

3. Backend projection
- Validates the event.
- Appends it to ordered game events/plays.
- Recalculates live controller, down/distance, score, drive segments, stats inputs, and report projections.
- Stores accepted envelope.

4. Accepted-envelope response
- Returns accepted event id/sequence and updated `GameEnvelope`.
- UI replaces local state with returned envelope.
- UI previews are allowed but never authoritative.

5. Idempotency/sequencing
- Use `clientEventId` plus backend-assigned `eventId` and `seq`.
- Duplicate `clientEventId` should return the already accepted event/envelope.
- Sequence conflicts should return a 409 with the current authoritative envelope.

6. Drift avoidance
- No flow should post directly to one-off PHP scripts.
- No UI flow should independently mutate authoritative down/distance or drive state after submit.
- Stats, reports, drive bar, and game log should derive from the returned envelope.

## Recommended Football Backend Ownership Plan

1. Keep `/Users/bryanshepherd/strata_football` as canonical backend/API repo.
2. Move or recreate the envelope-oriented PHP scaffold from `/Users/bryanshepherd/strata-football-ui-new/api` into the backend repo after contract shape is approved.
3. Do not move legacy SQL endpoints as active runtime code. Keep them as reference for:
- table names,
- game lock concepts,
- existing admin/dashboard assumptions,
- game/rules/team/player lookup joins,
- old drive/stat persistence ideas.
4. Create backend routes around football envelope resources, not old `load_game_state.php`/`submit_play.php` names.
5. Add a backend contract test fixture before wiring the UI:
- load empty/pregame envelope,
- submit rush event,
- submit punt/kickoff event,
- submit accepted/declined penalty,
- verify accepted updated envelope.
6. Define persistence separately:
- Phase 1: file-backed JSON envelopes for contract tests.
- Phase 2: database-backed envelope/event store once schema ownership is clear.
7. Generate or copy TypeScript contract types into the UI repo.
8. Add endpoint inventory checks so the UI cannot reference routes absent from backend ownership.

## Salvage Classification

Canonical:
- `/Users/bryanshepherd/strata_football` is canonical by ownership, but currently empty.

Salvageable:
- `/Users/bryanshepherd/strata-football-ui-new/api/Support/GameEnvelope.php`
- `/Users/bryanshepherd/strata-football-ui-new/api/Support/Schema/GameEnvelopeSchema.php`
- `/Users/bryanshepherd/strata-football-ui-new/api/Support/Schema/GameSchemaValidator.php`
- `/Users/bryanshepherd/strata-football-ui-new/api/Support/Schema/PlaySchema.php`
- `/Users/bryanshepherd/strata-football-ui-new/api/Support/PlayCollection.php`
- `/Users/bryanshepherd/strata-football-ui-new/api/Services/GameStateService.php`
- `/Users/bryanshepherd/strata-football-ui-new/api/Repositories/GameRepository.php`
- `/Users/bryanshepherd/strata-football-ui-new/legacy/api/YardLineConverter.php`, as reference only for yard-line semantics.

Obsolete as runtime:
- `/Users/bryanshepherd/strata-football-ui-new/legacy/api/load_game_state.php`
- `/Users/bryanshepherd/strata-football-ui-new/legacy/api/submit_play.php`
- `/Users/bryanshepherd/strata-football-ui-new/legacy/api/start_scoring.php`
- `/Users/bryanshepherd/strata-football-ui-new/legacy/api/end_scoring.php`
- `/Users/bryanshepherd/strata-football-ui-new/legacy/api/get_games.php`
- `/Users/bryanshepherd/strata-football-ui-new/legacy/api/StrataFootballAPI.php`

Missing:
- Canonical backend submit-event route.
- Canonical backend load-envelope route.
- Backend event projection service.
- Backend idempotency/sequence handling.
- Backend roster envelope.
- Backend report/stats projections.
- Backend config/env sample.
- Backend validation/test harness.
- Backend deployment mapping.

## Follow-Up Risks And Blockers

P0 blockers:
- Canonical backend repo has no implementation.
- Current UI endpoint references cannot be satisfied from canonical backend.
- No accepted football submit-event contract exists yet.
- No backend projection/idempotency model exists.

P1 risks:
- The new PHP scaffold is useful but currently stranded in the UI repo and is not wired to submit.
- The legacy API has DB knowledge but mutates many tables directly and can reintroduce drift if promoted unchanged.
- `GameSchemaValidator` currently requires non-empty `plays`, which may block pregame envelope fixtures.
- Deployment namespace remains unresolved between `/strata_football/` and the observed XAMPP `StrataSportsSuite/StrataFootball` folder.

P2 risks:
- Basketball reference still includes local envelope mutation and remote upload behavior; football should move authority server-side earlier to avoid multi-scorer drift.
- The UI dirty tree contains untracked scaffolding and docs that should not be silently copied into backend without review.

## Validation

Backend repo validation:
- `/Users/bryanshepherd/strata_football` contains no PHP files and no package/test command.
- `git status --short` in `/Users/bryanshepherd/strata_football`: clean.

UI-workspace PHP lint:
- PHP syntax lint was run across `api/*.php`, nested `api/**/*.php`, and `legacy/api/*.php`.
- Result: all checked PHP files reported `No syntax errors detected`.
- Non-fatal warning: `api/routes/load_game_state.php` reports that `use Throwable` has no effect.

Diff validation:
- `git diff --check` was run in `/Users/bryanshepherd/strata-football-ui-new`.
- Result: failed due to pre-existing trailing whitespace in unrelated dirty files already documented by STR-48/STR-55.
- Staged STR-56 document validation should be run with `git diff --cached --check` before commit.

## Next Action Checklist

- [ ] Create backend contract issue for `GameEnvelope`, `FootballEvent`, `SubmitEventRequest`, and `SubmitEventResponse`.
- [ ] Move or recreate envelope scaffold in `/Users/bryanshepherd/strata_football`.
- [ ] Add backend file-backed fixture store for pregame and in-progress envelopes.
- [ ] Implement `GET /strata_football/api/games/{gameId}/envelope`.
- [ ] Implement `POST /strata_football/api/games/{gameId}/events` with `clientEventId` idempotency.
- [ ] Port `GameSchemaValidator` and adjust it to support empty pregame play lists.
- [ ] Add projection tests for rush, punt, kickoff, scoring play, and penalty events.
- [ ] Decide whether legacy MySQL tables become projection targets, migration input, or archived reference.
- [ ] Align Vite proxy and XAMPP deployment namespace.
- [ ] Add UI endpoint inventory test once backend route names are approved.
