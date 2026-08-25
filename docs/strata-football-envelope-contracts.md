# Strata Football Envelope Contracts

Date: 2026-06-20
Linear: STR-57

## 1. Purpose

This document defines the first canonical StrataFootball contracts for the clean rebuild:
- `GameEnvelope`
- `ScoringEvent`
- `SubmitEventRequest`
- `SubmitEventResponse`
- `RosterEnvelope`
- `ReportEnvelope`

These contracts must be finalized before rebuilding UI scoring flows or backend submit behavior. The backend accepted envelope is authoritative. The UI may show unsaved local previews, but it must replace local state with the accepted envelope returned by the backend after submit.

## 2. Basketball Pattern To Mirror

StrataBasketball is the communication model, not the football domain model.

Reference files:
- `/Users/bryanshepherd/strata-basketball-ui/src/services/basketballEnvelopeSyncService.js`
- `/Users/bryanshepherd/strata-basketball-ui/src/services/basketballEnvelopeService.js`
- `/Users/bryanshepherd/strata-basketball-ui/src/contexts/BasketballGameContext.jsx`
- `/Users/bryanshepherd/strata-basketball-ui/src/types/basketballEnvelope.js`
- `/Users/bryanshepherd/strata-basketball-ui/documentation/contracts/basketball-handler-apis.md`
- `/Users/bryanshepherd/strata-basketball-ui/documentation/contracts/basketball-scorer.openapi.yml`

Transferable pattern:
- Load one envelope by game id.
- Normalize and validate the envelope before UI use.
- Submit one event/intent shape through one client path.
- Assign stable event identity and sequence.
- Project accepted events into live state, stats, logs, and reports.
- Return the accepted updated envelope.
- Render UI from the latest envelope and derived projections.
- Avoid separate local/server sources of truth.

Football differences:
- Football has down/distance, line to gain, yard-line math, drives, kicks, penalties, and possession-boundary rules that must be projected by football-specific backend logic.
- Basketball currently has local envelope mutation plus optional sync. Football should move authority server-side earlier because football scoring has higher multi-step state risk.

## 3. Contract Ownership

Canonical backend repo:
- `/Users/bryanshepherd/strata_football`

Target backend-owned contract paths:
- `/Users/bryanshepherd/strata_football/contracts/football/game-envelope.schema.json`
- `/Users/bryanshepherd/strata_football/contracts/football/scoring-event.schema.json`
- `/Users/bryanshepherd/strata_football/contracts/football/submit-event-request.schema.json`
- `/Users/bryanshepherd/strata_football/contracts/football/submit-event-response.schema.json`
- `/Users/bryanshepherd/strata_football/contracts/football/roster-envelope.schema.json`
- `/Users/bryanshepherd/strata_football/contracts/football/report-envelope.schema.json`
- `/Users/bryanshepherd/strata_football/contracts/football/fixtures/*.json`

Current STR-57 artifact:
- `/Users/bryanshepherd/strata-football-ui-new/docs/strata-football-envelope-contracts.md`

Reason:
- STR-56 found the backend repo is currently an empty shell. This document defines the backend-owned target contracts without silently creating backend implementation files from the UI repo.

## 4. Canonical Decisions

Possession vocabulary:
- Persisted/backend values: `H` and `V`.
- UI may display `Home`, `Visitor`, team names, colors, or abbreviations, but display labels are mapping concerns only.
- No persisted `home`, `visitor`, `HOME`, `VISITOR`, `away`, or `A` values in canonical event/envelope payloads.

Yard-line representation:
- Canonical spot string: `H35`, `V20`, or `50`.
- `H35` means the ball is on the home team's 35.
- `V20` means the ball is on the visitor team's 20.
- `50` means midfield.
- Yard-line helpers must convert to possession-relative distance; callers should not infer gain/loss by string comparison.

Line to gain:
- Frontend type field: `lineToGain`.
- Backend/PHP serialization may expose `line_to_gain` only as an intentional adapter field.
- `lineToGain` is `null` only for plays where football rules do not have a line to gain, such as kickoff, try, or pregame.

Event identity:
- UI supplies `clientEventId`.
- Backend supplies accepted `eventId` and `sequence`.
- Duplicate `clientEventId` for the same game/session should return the already accepted event and current accepted envelope.

Authoritative state:
- Backend accepted envelope wins.
- Client previews are draft-only and must be visually/statefully distinguishable from accepted state.

Clock:
- Canonical display clock is `MM:SS`.
- Backend may store tenths/seconds internally, but public contract should include display `clock` plus optional `clockTenths`.

## 5. Shared Scalar Types

```json
{
  "TeamCode": ["H", "V"],
  "Spot": "H35 | V20 | 50",
  "Clock": "MM:SS",
  "GameStatus": ["pregame", "inProgress", "halftime", "final", "suspended"],
  "PeriodType": ["quarter", "overtime", "try"],
  "ScoringEventType": [
    "rush",
    "pass",
    "punt",
    "kickoff",
    "fieldGoal",
    "try",
    "penalty",
    "gameControl"
  ]
}
```

## 6. GameEnvelope Schema Draft

`GameEnvelope` is the canonical load response and the accepted state returned after submit.

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-1001",
  "updatedAt": "2026-06-20T00:00:00Z",
  "game": {
    "status": "inProgress",
    "period": 1,
    "periodType": "quarter",
    "scheduledAt": "2026-09-01T23:00:00Z",
    "venue": {
      "name": "Dickerson Stadium",
      "city": "Institute",
      "state": "WV"
    },
    "teams": {
      "H": {
        "teamId": "TEAM-H",
        "name": "Home State",
        "abbr": "HOM",
        "score": 7
      },
      "V": {
        "teamId": "TEAM-V",
        "name": "Visitor Tech",
        "abbr": "VIS",
        "score": 3
      }
    },
    "rules": {
      "periods": 4,
      "minutesPerPeriod": 15,
      "downs": 4,
      "yardsToFirstDown": 10,
      "fieldLength": 100,
      "kickoffSpot": "H35",
      "touchbackSpot": "V20",
      "kickoffTouchbackSpot": "V25",
      "nonKickTouchbackSpot": "V20",
      "patSpot": "V03",
      "overtimeEnabled": true
    }
  },
  "clock": {
    "period": 1,
    "clock": "08:42",
    "clockTenths": 5220,
    "isRunning": false,
    "playClock": 25,
    "lastStartedAt": null
  },
  "liveState": {
    "possession": "H",
    "down": 2,
    "distance": 6,
    "yardLine": "H44",
    "lineToGain": "50",
    "goalToGo": false,
    "redZone": false,
    "driveId": "DRV-0002",
    "driveNumber": 2,
    "nextPlayContext": "H,2,6,H44"
  },
  "rosters": {
    "schemaVersion": "football.rosterEnvelope.v1",
    "teams": {
      "H": { "teamId": "TEAM-H", "players": {} },
      "V": { "teamId": "TEAM-V", "players": {} }
    }
  },
  "events": [],
  "drives": {
    "current": null,
    "completed": []
  },
  "stats": {
    "sourceEventSequence": 0,
    "teams": {},
    "players": {}
  },
  "locks": {
    "activeScorerSessionId": null,
    "lockedByUserId": null,
    "lockedAt": null,
    "expiresAt": null
  }
}
```

Required `GameEnvelope` fields:
- `schemaVersion`
- `gameId`
- `updatedAt`
- `game`
- `clock`
- `liveState`
- `rosters`
- `events`
- `drives`
- `stats`
- `locks`

`events` must be ordered by backend `sequence`. `events` may be empty for pregame and fixture bootstrapping.

## 7. ScoringEvent Schema Draft

`ScoringEvent` is the canonical accepted event shape stored inside `GameEnvelope.events`. UI drafts use the same event body but do not include backend-only acceptance fields until accepted.

```json
{
  "eventId": "EVT-000042",
  "clientEventId": "client-uuid-1",
  "sequence": 42,
  "type": "rush",
  "subtype": null,
  "status": "accepted",
  "createdAt": "2026-06-20T00:00:00Z",
  "acceptedAt": "2026-06-20T00:00:01Z",
  "period": 1,
  "clock": "08:42",
  "possession": "H",
  "preState": {
    "down": 2,
    "distance": 6,
    "yardLine": "H44",
    "lineToGain": "50",
    "driveId": "DRV-0002"
  },
  "participants": {
    "primary": { "playerId": "H-22", "team": "H" },
    "secondary": null,
    "defenders": [
      { "playerId": "V-44", "team": "V", "role": "tackler" }
    ]
  },
  "result": {
    "code": "tackle",
    "yards": 4,
    "endYardLine": "H48",
    "scoring": null,
    "turnover": null,
    "firstDown": false,
    "driveEnds": false
  },
  "penalties": [],
  "postState": {
    "possession": "H",
    "down": 3,
    "distance": 2,
    "yardLine": "H48",
    "lineToGain": "50",
    "driveId": "DRV-0002"
  },
  "description": "H-22 rush for 4 yards to H48."
}
```

Required draft fields before submit:
- `clientEventId`
- `type`
- `period`
- `clock`
- `possession`
- `preState`
- `participants`
- `result`
- `penalties`

Backend-only or backend-finalized fields:
- `eventId`
- `sequence`
- `status`
- `acceptedAt`
- `postState`
- `description`

## 8. SubmitEventRequest Schema Draft

All MVP scoring flows submit through this shape.

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
    "type": "rush",
    "subtype": null,
    "period": 1,
    "clock": "08:42",
    "possession": "H",
    "preState": {
      "down": 2,
      "distance": 6,
      "yardLine": "H44",
      "lineToGain": "50",
      "driveId": "DRV-0002"
    },
    "participants": {
      "primary": { "playerId": "H-22", "team": "H" },
      "secondary": null,
      "defenders": []
    },
    "result": {
      "code": "tackle",
      "yards": 4,
      "endYardLine": "H48"
    },
    "penalties": []
  }
}
```

Idempotency rules:
- `clientContext.clientEventId` is required.
- If a duplicate `clientEventId` is submitted for the same `gameId`, return the already accepted event and current envelope.
- If `baseEventSequence` is stale and cannot be safely applied, return `409` with the current accepted envelope.

## 9. SubmitEventResponse Schema Draft

```json
{
  "schemaVersion": "football.submitEventResponse.v1",
  "success": true,
  "status": "accepted",
  "acceptedEvent": {
    "eventId": "EVT-000042",
    "clientEventId": "client-uuid-1",
    "sequence": 42,
    "type": "rush"
  },
  "gameEnvelope": {
    "schemaVersion": "football.gameEnvelope.v1",
    "gameId": "FB-1001"
  },
  "warnings": [],
  "errors": []
}
```

Error response:

```json
{
  "schemaVersion": "football.submitEventResponse.v1",
  "success": false,
  "status": "rejected",
  "acceptedEvent": null,
  "gameEnvelope": {
    "schemaVersion": "football.gameEnvelope.v1",
    "gameId": "FB-1001"
  },
  "warnings": [],
  "errors": [
    {
      "code": "STALE_SEQUENCE",
      "message": "Submitted baseEventSequence is stale.",
      "field": "clientContext.baseEventSequence"
    }
  ]
}
```

Response rules:
- On success, `gameEnvelope` is the authoritative post-submit state.
- On duplicate idempotent submit, `status` should be `duplicateAccepted` and include the already accepted event.
- On validation failure, return `success: false`, typed `errors`, and the current authoritative envelope when available.

## 10. RosterEnvelope Schema Draft

```json
{
  "schemaVersion": "football.rosterEnvelope.v1",
  "gameId": "FB-1001",
  "updatedAt": "2026-06-20T00:00:00Z",
  "teams": {
    "H": {
      "teamId": "TEAM-H",
      "name": "Home State",
      "abbr": "HOM",
      "players": {
        "H-22": {
          "playerId": "H-22",
          "team": "H",
          "jersey": "22",
          "firstName": "Jordan",
          "lastName": "Smith",
          "displayName": "Jordan Smith",
          "position": "RB",
          "active": true
        }
      },
      "jerseyIndex": {
        "22": "H-22"
      }
    },
    "V": {
      "teamId": "TEAM-V",
      "name": "Visitor Tech",
      "abbr": "VIS",
      "players": {},
      "jerseyIndex": {}
    }
  },
  "unknownPlayerPolicy": {
    "allowUnknown": true,
    "idPrefix": "unknown"
  }
}
```

Roster rules:
- Player ids are stable contract ids, not jersey numbers.
- Jersey lookup uses `jerseyIndex`.
- Unknown players must be explicit and traceable; no silent `null` coercion in accepted events.

## 11. ReportEnvelope Schema Draft

```json
{
  "schemaVersion": "football.reportEnvelope.v1",
  "gameId": "FB-1001",
  "sourceEventSequence": 42,
  "generatedAt": "2026-06-20T00:00:00Z",
  "summary": {
    "status": "final",
    "score": { "H": 24, "V": 17 },
    "periods": [
      { "period": 1, "H": 7, "V": 0 },
      { "period": 2, "H": 3, "V": 10 },
      { "period": 3, "H": 7, "V": 0 },
      { "period": 4, "H": 7, "V": 7 }
    ]
  },
  "teams": {
    "H": {
      "firstDowns": 18,
      "rushAttempts": 32,
      "rushYards": 146,
      "passCompletions": 15,
      "passAttempts": 24,
      "passYards": 188,
      "totalYards": 334,
      "punts": 4,
      "penalties": 6,
      "penaltyYards": 45,
      "turnovers": 1
    },
    "V": {
      "firstDowns": 14,
      "rushAttempts": 25,
      "rushYards": 101,
      "passCompletions": 17,
      "passAttempts": 31,
      "passYards": 156,
      "totalYards": 257,
      "punts": 5,
      "penalties": 4,
      "penaltyYards": 30,
      "turnovers": 2
    }
  },
  "players": {},
  "scoringSummary": [],
  "driveSummary": []
}
```

Report rules:
- Reports derive from accepted envelope events and projections.
- `sourceEventSequence` identifies the accepted event sequence used to generate the report.
- Report routes should not depend on scorer UI providers.

## 12. Fixture Examples

Fixtures should live under backend-owned `/contracts/football/fixtures/` when implementation begins.

### Pregame

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-PREGAME",
  "updatedAt": "2026-06-20T00:00:00Z",
  "game": {
    "status": "pregame",
    "period": 0,
    "periodType": "quarter",
    "teams": {
      "H": { "teamId": "TEAM-H", "name": "Home State", "abbr": "HOM", "score": 0 },
      "V": { "teamId": "TEAM-V", "name": "Visitor Tech", "abbr": "VIS", "score": 0 }
    },
    "rules": { "periods": 4, "minutesPerPeriod": 15, "downs": 4, "yardsToFirstDown": 10 }
  },
  "clock": { "period": 0, "clock": "15:00", "clockTenths": 9000, "isRunning": false, "playClock": null },
  "liveState": { "possession": null, "down": null, "distance": null, "yardLine": null, "lineToGain": null, "goalToGo": false, "redZone": false, "driveId": null, "driveNumber": 0 },
  "rosters": { "schemaVersion": "football.rosterEnvelope.v1", "teams": { "H": { "players": {} }, "V": { "players": {} } } },
  "events": [],
  "drives": { "current": null, "completed": [] },
  "stats": { "sourceEventSequence": 0, "teams": {}, "players": {} },
  "locks": { "activeScorerSessionId": null, "lockedByUserId": null, "lockedAt": null, "expiresAt": null }
}
```

### In-Progress Normal Field Position

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-NORMAL",
  "updatedAt": "2026-06-20T00:10:00Z",
  "game": { "status": "inProgress", "period": 1, "teams": { "H": { "score": 7 }, "V": { "score": 3 } }, "rules": { "downs": 4, "yardsToFirstDown": 10 } },
  "clock": { "period": 1, "clock": "08:42", "clockTenths": 5220, "isRunning": false, "playClock": 25 },
  "liveState": { "possession": "H", "down": 2, "distance": 6, "yardLine": "H44", "lineToGain": "50", "goalToGo": false, "redZone": false, "driveId": "DRV-0002", "driveNumber": 2 },
  "events": [],
  "drives": { "current": { "driveId": "DRV-0002", "team": "H", "startYardLine": "H25", "startClock": "12:00", "plays": 4, "yards": 19 }, "completed": [] }
}
```

### Red Zone

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-REDZONE",
  "clock": { "period": 2, "clock": "04:11", "clockTenths": 2510, "isRunning": false, "playClock": 18 },
  "liveState": { "possession": "H", "down": 1, "distance": 10, "yardLine": "V18", "lineToGain": "V08", "goalToGo": false, "redZone": true, "driveId": "DRV-0004", "driveNumber": 4 },
  "events": [],
  "drives": { "current": { "driveId": "DRV-0004", "team": "H", "startYardLine": "H42", "plays": 7, "yards": 40 }, "completed": [] }
}
```

### Goal-To-Go

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-GOALTOGO",
  "clock": { "period": 2, "clock": "01:32", "clockTenths": 920, "isRunning": false, "playClock": 12 },
  "liveState": { "possession": "V", "down": 2, "distance": 5, "yardLine": "H05", "lineToGain": "goal", "goalToGo": true, "redZone": true, "driveId": "DRV-0005", "driveNumber": 5 },
  "events": [],
  "drives": { "current": { "driveId": "DRV-0005", "team": "V", "startYardLine": "V35", "plays": 9, "yards": 60 }, "completed": [] }
}
```

### Halftime

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-HALFTIME",
  "game": { "status": "halftime", "period": 2, "teams": { "H": { "score": 14 }, "V": { "score": 10 } } },
  "clock": { "period": 2, "clock": "00:00", "clockTenths": 0, "isRunning": false, "playClock": null },
  "liveState": { "possession": null, "down": null, "distance": null, "yardLine": null, "lineToGain": null, "goalToGo": false, "redZone": false, "driveId": null, "driveNumber": 5 },
  "events": [],
  "drives": { "current": null, "completed": [] }
}
```

### Final

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-FINAL",
  "game": { "status": "final", "period": 4, "teams": { "H": { "score": 24 }, "V": { "score": 17 } } },
  "clock": { "period": 4, "clock": "00:00", "clockTenths": 0, "isRunning": false, "playClock": null },
  "liveState": { "possession": null, "down": null, "distance": null, "yardLine": null, "lineToGain": null, "goalToGo": false, "redZone": false, "driveId": null, "driveNumber": 12 },
  "events": [],
  "drives": { "current": null, "completed": [] }
}
```

### Possession Change

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-POSS-CHANGE",
  "clock": { "period": 3, "clock": "10:05", "clockTenths": 6050, "isRunning": false, "playClock": 40 },
  "liveState": { "possession": "V", "down": 1, "distance": 10, "yardLine": "V31", "lineToGain": "V41", "goalToGo": false, "redZone": false, "driveId": "DRV-0007", "driveNumber": 7 },
  "events": [
    {
      "eventId": "EVT-000076",
      "clientEventId": "client-int-1",
      "sequence": 76,
      "type": "pass",
      "subtype": "interception",
      "possession": "H",
      "result": { "turnover": { "type": "interception", "recoveredBy": "V", "returnEndYardLine": "V31" }, "driveEnds": true },
      "postState": { "possession": "V", "down": 1, "distance": 10, "yardLine": "V31", "lineToGain": "V41", "driveId": "DRV-0007" }
    }
  ]
}
```

### Drive After Kickoff

```json
{
  "schemaVersion": "football.gameEnvelope.v1",
  "gameId": "FB-KICKOFF-DRIVE",
  "clock": { "period": 1, "clock": "14:54", "clockTenths": 8940, "isRunning": false, "playClock": 40 },
  "liveState": { "possession": "V", "down": 1, "distance": 10, "yardLine": "V25", "lineToGain": "V35", "goalToGo": false, "redZone": false, "driveId": "DRV-0001", "driveNumber": 1 },
  "events": [
    {
      "eventId": "EVT-000001",
      "clientEventId": "client-ko-1",
      "sequence": 1,
      "type": "kickoff",
      "subtype": "touchback",
      "possession": "H",
      "result": { "endYardLine": "V25", "driveEnds": false },
      "postState": { "possession": "V", "down": 1, "distance": 10, "yardLine": "V25", "lineToGain": "V35", "driveId": "DRV-0001" }
    }
  ],
  "drives": { "current": { "driveId": "DRV-0001", "team": "V", "startYardLine": "V25", "startReason": "kickoffTouchback", "plays": 0, "yards": 0 }, "completed": [] }
}
```

## 13. MVP Submit Event Examples

All examples are `SubmitEventRequest.event` bodies. Production requests wrap these with `schemaVersion`, `gameId`, and `clientContext`.

### Rush

```json
{
  "type": "rush",
  "subtype": null,
  "period": 1,
  "clock": "08:42",
  "possession": "H",
  "preState": { "down": 2, "distance": 6, "yardLine": "H44", "lineToGain": "50", "driveId": "DRV-0002" },
  "participants": { "primary": { "playerId": "H-22", "team": "H" }, "secondary": null, "defenders": [{ "playerId": "V-44", "team": "V", "role": "tackler" }] },
  "result": { "code": "tackle", "yards": 4, "endYardLine": "H48", "firstDown": false },
  "penalties": []
}
```

### Pass

```json
{
  "type": "pass",
  "subtype": "complete",
  "period": 1,
  "clock": "07:55",
  "possession": "H",
  "preState": { "down": 3, "distance": 2, "yardLine": "H48", "lineToGain": "50", "driveId": "DRV-0002" },
  "participants": { "primary": { "playerId": "H-12", "team": "H", "role": "passer" }, "secondary": { "playerId": "H-08", "team": "H", "role": "receiver" }, "defenders": [{ "playerId": "V-02", "team": "V", "role": "tackler" }] },
  "result": { "code": "complete", "yards": 14, "endYardLine": "V38", "firstDown": true },
  "penalties": []
}
```

### Punt

```json
{
  "type": "punt",
  "subtype": "fairCatch",
  "period": 2,
  "clock": "11:02",
  "possession": "H",
  "preState": { "down": 4, "distance": 8, "yardLine": "H32", "lineToGain": "H40", "driveId": "DRV-0003" },
  "participants": { "primary": { "playerId": "H-09", "team": "H", "role": "punter" }, "secondary": { "playerId": "V-04", "team": "V", "role": "returner" }, "defenders": [] },
  "result": { "code": "fairCatch", "kickYards": 42, "endYardLine": "V26", "driveEnds": true, "nextPossession": "V" },
  "penalties": []
}
```

### Kickoff

```json
{
  "type": "kickoff",
  "subtype": "returned",
  "period": 1,
  "clock": "15:00",
  "possession": "H",
  "preState": { "down": null, "distance": null, "yardLine": "H35", "lineToGain": null, "driveId": null },
  "participants": { "primary": { "playerId": "H-09", "team": "H", "role": "kicker" }, "secondary": { "playerId": "V-01", "team": "V", "role": "returner" }, "defenders": [{ "playerId": "H-33", "team": "H", "role": "tackler" }] },
  "result": { "code": "returned", "kickedToYardLine": "V05", "endYardLine": "V27", "returnYards": 22, "nextPossession": "V", "driveEnds": false },
  "penalties": []
}
```

### Field Goal

```json
{
  "type": "fieldGoal",
  "subtype": "made",
  "period": 2,
  "clock": "00:03",
  "possession": "H",
  "preState": { "down": 4, "distance": 5, "yardLine": "V18", "lineToGain": "V13", "driveId": "DRV-0006" },
  "participants": { "primary": { "playerId": "H-09", "team": "H", "role": "kicker" }, "secondary": { "playerId": "H-15", "team": "H", "role": "holder" }, "defenders": [] },
  "result": { "code": "made", "attemptYardLine": "V18", "points": 3, "scoring": { "team": "H", "points": 3, "type": "fieldGoal" }, "driveEnds": true },
  "penalties": []
}
```

### PAT Kick

```json
{
  "type": "try",
  "subtype": "kick",
  "period": 3,
  "clock": "06:44",
  "possession": "H",
  "preState": { "down": null, "distance": null, "yardLine": "V03", "lineToGain": null, "driveId": null },
  "participants": { "primary": { "playerId": "H-09", "team": "H", "role": "kicker" }, "secondary": { "playerId": "H-15", "team": "H", "role": "holder" }, "defenders": [] },
  "result": { "code": "made", "points": 1, "scoring": { "team": "H", "points": 1, "type": "patKick" }, "driveEnds": false },
  "penalties": []
}
```

### Two-Point Try

```json
{
  "type": "try",
  "subtype": "twoPointPass",
  "period": 3,
  "clock": "06:44",
  "possession": "H",
  "preState": { "down": null, "distance": null, "yardLine": "V03", "lineToGain": null, "driveId": null },
  "participants": { "primary": { "playerId": "H-12", "team": "H", "role": "passer" }, "secondary": { "playerId": "H-88", "team": "H", "role": "receiver" }, "defenders": [] },
  "result": { "code": "successful", "points": 2, "scoring": { "team": "H", "points": 2, "type": "twoPointTry" }, "driveEnds": false },
  "penalties": []
}
```

### Penalty

```json
{
  "type": "penalty",
  "subtype": "liveBall",
  "period": 2,
  "clock": "09:18",
  "possession": "H",
  "preState": { "down": 1, "distance": 10, "yardLine": "H35", "lineToGain": "H45", "driveId": "DRV-0004" },
  "participants": { "primary": { "playerId": "V-55", "team": "V", "role": "penalizedPlayer" }, "secondary": null, "defenders": [] },
  "result": { "code": "accepted", "yards": 5, "endYardLine": "H40", "firstDown": false },
  "penalties": [
    {
      "penaltyId": "pen-client-1",
      "code": "OFFSIDE",
      "team": "V",
      "playerId": "V-55",
      "timing": "liveBall",
      "status": "accepted",
      "yards": 5,
      "enforcedFrom": "previousSpot",
      "automaticFirstDown": false,
      "lossOfDown": false,
      "replayDown": true
    }
  ]
}
```

### Game Control

```json
{
  "type": "gameControl",
  "subtype": "clockUpdate",
  "period": 2,
  "clock": "12:00",
  "possession": "H",
  "preState": { "down": 1, "distance": 10, "yardLine": "H25", "lineToGain": "H35", "driveId": "DRV-0003" },
  "participants": { "primary": null, "secondary": null, "defenders": [] },
  "result": { "code": "clockUpdate", "clock": "11:42", "clockTenths": 7020, "isRunning": false },
  "penalties": []
}
```

## 14. TypeScript Type Generation

Preferred path:
- Backend repo owns JSON schemas.
- UI repo generates TypeScript declarations from backend schemas.

Suggested generated UI paths:
- `/Users/bryanshepherd/strata-football-ui-new/src/contracts/football/GameEnvelope.ts`
- `/Users/bryanshepherd/strata-football-ui-new/src/contracts/football/ScoringEvent.ts`
- `/Users/bryanshepherd/strata-football-ui-new/src/contracts/football/SubmitEventRequest.ts`
- `/Users/bryanshepherd/strata-football-ui-new/src/contracts/football/SubmitEventResponse.ts`
- `/Users/bryanshepherd/strata-football-ui-new/src/contracts/football/RosterEnvelope.ts`
- `/Users/bryanshepherd/strata-football-ui-new/src/contracts/football/ReportEnvelope.ts`

Acceptable first pass:
- Copy generated `.ts` files into the UI repo and include the backend contract commit hash in a file header.

Do not:
- Recreate contract fields manually inside flow components.
- Let `apiDataContract.ts` infer contract shape from legacy endpoint responses.
- Support multiple canonical possession or yard-line spellings inside the core contract.

## 15. Implementation Rules For Follow-Up Tickets

- STR-58 scorer shell should render from fixture `GameEnvelope` only.
- STR-59 backend skeleton should implement load and submit around `SubmitEventRequest` and `SubmitEventResponse`.
- STR-60 rules engine should accept `preState` plus `ScoringEvent.result`, then return canonical `postState`.
- STR-61 UI flows should produce event drafts only; they should not decide authoritative post-play state.
- STR-62 penalty workflow should emit typed `penalties[]` inside the same `ScoringEvent`.
- STR-63 report/export should consume `ReportEnvelope` and `sourceEventSequence`.

## 16. Validation Notes

No schema tooling exists yet in the canonical football backend repo. STR-57 validation is limited to Markdown/diff checks until schema files are implemented in backend ownership.
