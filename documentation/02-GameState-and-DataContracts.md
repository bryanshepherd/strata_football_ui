# 02-GameState-and-DataContracts.md - Canonical Data Shapes and Contracts

## Core Data Contracts Source

**Primary Source**: `src/utils/apiDataContract.ts` (TypeScript definitions)

This file serves as the source of truth for data transformation between frontend and backend systems.

## 1. StandardGameState

The canonical game state structure used throughout the application.

### TypeScript Interface
```typescript
interface StandardGameState {
  gameId: number;
  period: number;
  timeRemaining: string;
  possession: 'H' | 'V';
  down: number;
  yardsToGo: number;
  yardLinePosition: string;
  score: {
    H: number;
    V: number;
  };
  status: 'pregame' | 'active' | 'halftime' | 'final' | 'suspended';
  timeouts: {
    H: number;
    V: number;
  };
  metadata?: {
    isGoalToGo?: boolean;
    isRedZone?: boolean;
    lastUpdated?: string;
  };
}
```

### Field Documentation

| Field | Type | Required | Default | Description | Example |
|-------|------|----------|---------|-------------|---------|
| gameId | number | Yes | - | Unique game identifier | 999 |
| period | number | Yes | 1 | Current quarter (1-4) or OT (5+) | 2 |
| timeRemaining | string | Yes | "15:00" | Time left in period "MM:SS" | "12:34" |
| possession | 'H' \| 'V' | Yes | 'H' | Team with ball (Home/Visitor) | 'H' |
| down | number | Yes | 1 | Current down (1-4) | 3 |
| yardsToGo | number | Yes | 10 | Yards needed for first down | 7 |
| yardLinePosition | string | Yes | "H35" | Field position | "V42" |
| score | object | Yes | {H:0,V:0} | Current score | {H:14,V:10} |
| status | enum | Yes | 'active' | Game phase | 'active' |
| timeouts | object | Yes | {H:3,V:3} | Timeouts remaining | {H:2,V:3} |
| metadata | object | No | - | Additional game info | see below |

### Frontend ↔ Backend Mapping
- Frontend: `quarter` → Backend: `period`
- Frontend: `clock` → Backend: `timeRemaining`
- Frontend: `distance` → Backend: `yardsToGo`
- Frontend: `spot` → Backend: `yardLinePosition`

## 2. Play Data Structures

### StandardPlayData (Frontend)
```typescript
interface StandardPlayData {
  // Required
  playType: 'rush' | 'pass' | 'punt' | 'kick' | 'penalty' | 'timeout' | 'other';
  description: string;
  
  // Optional Core Fields
  resultCode?: string;
  yardsGained?: number;
  
  // Player Involvement
  primaryPlayerID?: number;
  secondaryPlayerID?: number;
  tertiaryPlayerID?: number;
  
  // Position Information
  startYardLine?: string;
  endYardLine?: string;
  
  // Context
  playContext?: string;
  newContext?: string;
  
  // Flags
  isScoring?: boolean;
  isTurnover?: boolean;
  isFirstDown?: boolean;
  isSafety?: boolean;
  isPenalty?: boolean;
  
  // Timing
  timeElapsed?: number;
  timestamp?: string;
  
  // Debug
  rawData?: any;
}
```

### BackendPlayData
```typescript
interface BackendPlayData {
  // Core Fields (snake_case)
  play_type: string;
  primary_player_id?: number;
  secondary_player_id?: number;
  result?: string;
  
  // Position Fields
  yard_line?: string;
  end_yard_line?: string;
  post_yard_line?: string;
  
  // Yardage
  yards?: number;
  net_yards?: number;
  
  // Down and Distance
  post_down?: number;
  post_distance?: number;
  
  // Required Flags
  has_fumble: boolean;
  is_first_down: boolean;
  is_touchdown: boolean;
  is_turnover: boolean;
  is_safety: boolean;
  is_kickoff: boolean;
  
  // Tackle Data
  tackler1?: number;
  tackler2?: number;
  tackler1_jersey?: string;
  tackler2_jersey?: string;
  
  // Metadata
  timestamp: string;
  possession?: string;
  session_id: string;
  user_id: string;
}
```

### Play Type Result Codes

| Play Type | Result Code | Description | Frontend Name | Backend Name |
|-----------|------------|-------------|---------------|--------------|
| RUSH | T | Tackle | tackle | TACKLE |
| RUSH | O | Out of bounds | out-of-bounds | OUT_OF_BOUNDS |
| RUSH | F | Fumble | fumble | FUMBLE |
| RUSH | . | End of play | end-of-play | END_PLAY |
| PASS | C | Complete | complete | COMPLETE |
| PASS | I | Incomplete | incomplete | INCOMPLETE |
| PASS | S | Sack | sack | SACK |
| PASS | F | Fumble | fumble | FUMBLE |
| PASS | X | Intercepted | intercepted | INTERCEPTED |
| PUNT | R | Returned | returned | RETURNED |
| PUNT | D | Downed | downed | DOWNED |
| PUNT | C | Fair catch | fair-catch | FAIR_CATCH |
| PUNT | T | Touchback | touchback | TOUCHBACK |
| PUNT | M | Muffed | muffed | MUFFED |
| KICK | G | Good | good | GOOD |
| KICK | M | Missed | missed | MISSED |
| KICK | B | Blocked | blocked | BLOCKED |

## 3. Play Participants Structure

### PlayParticipants
```typescript
interface PlayParticipants {
  play_number: number;
  game_id: number;
  participants: PlayerParticipation[];
}
```

### PlayerParticipation
```typescript
interface PlayerParticipation {
  player_id: number;
  jersey_number: string;
  full_name: string;
  position: string;
  team: 'home' | 'visitor';
  participation_type: 'primary' | 'secondary' | 'tackler1' | 'tackler2';
}
```

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| player_id | number | Yes | Unique player ID | 123 |
| jersey_number | string | Yes | Jersey number | "12" |
| full_name | string | Yes | Player full name | "John Smith" |
| position | string | Yes | Player position | "QB" |
| team | enum | Yes | Team side | 'home' |
| participation_type | enum | Yes | Role in play | 'primary' |

## 4. DriveState Structure

### DriveState (Active Drive)
```typescript
interface DriveState {
  plays: number;
  yards: number;
  startYardLine: string;
  startTime: string;
  possessionTeam: 'home' | 'visitor';
}
```

### DriveStats (Historical)
```typescript
interface DriveStats {
  DriveID: number;
  plays: number;
  yards: number;
  startPosition: string;
  endPosition?: string;
  driveResult?: 'TOUCHDOWN' | 'FIELD_GOAL' | 'PUNT' | 'TURNOVER' | 'SAFETY' | 'END_HALF';
  timeOfPossession?: string;
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| plays | number | Yes | 0 | Number of plays in drive |
| yards | number | Yes | 0 | Total yards gained |
| startYardLine | string | Yes | - | Starting field position |
| startTime | string | Yes | - | Time drive started |
| possessionTeam | enum | Yes | - | Team with possession |
| driveResult | enum | No | - | How drive ended |

## 5. Roster Data Structure

### RosterData
```typescript
interface RosterData {
  home: PlayerRoster[];
  visitor: PlayerRoster[];
}
```

### PlayerRoster
```typescript
interface PlayerRoster {
  player_id: number;
  jersey_number: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  class_year?: string;
  height?: string;
  weight?: number;
}
```

| Field | Type | Required | Default | Description | Example |
|-------|------|----------|---------|-------------|---------|
| player_id | number | Yes | - | Unique ID | 456 |
| jersey_number | string | Yes | - | Jersey number | "23" |
| first_name | string | Yes | - | First name | "John" |
| last_name | string | Yes | - | Last name | "Smith" |
| full_name | string | No | computed | Full name | "John Smith" |
| position | string | Yes | - | Position code | "RB" |
| class_year | string | No | - | Year in school | "JR" |
| height | string | No | - | Height | "6'2\"" |
| weight | number | No | - | Weight in lbs | 215 |

## 6. Game Context State (React)

### Full Game Context Structure
```typescript
interface GameContextState {
  gameData: {
    game_info: {
      game_id: number;
      home_team_name: string;
      home_team_short: string;
      home_team_abbr: string;
      visitor_team_name: string;
      visitor_team_short: string;
      visitor_team_abbr: string;
      home_team_id: number;
      visitor_team_id: number;
      game_date: string;
      venue: string;
    };
    
    live_state: {
      game_status: 'pregame' | 'in_progress' | 'halftime' | 'final' | 'suspended';
      quarter: number;
      time_remaining: number; // seconds
      possession: 'home' | 'visitor';
      down: number;
      distance: number;
      yard_line: string;
      home_score: number;
      visitor_score: number;
      home_timeouts: number;
      visitor_timeouts: number;
      play_clock: number;
    };
    
    recent_plays: PlayLogEntry[];
    team_stats: TeamStats;
    player_stats: PlayerStats;
    rosters: RosterData;
  };
  
  isSubmitting: boolean;
  error: string | null;
  debugMode: boolean;
  debugGameId: string;
  apiStatus: 'connected' | 'connecting' | 'error' | 'disconnected';
  currentDrive?: DriveState;
  lastPlayData?: any;
}
```

## 7. Flow Context State

### FootballFlowContext State
```typescript
interface FlowContextState {
  currentFlow: 'rush' | 'pass' | 'punt' | 'kick' | 'penalty' | 'gamecontrol' | null;
  flowStep: string | null;
  eventData: PlayEventData;
  isModalOpen: boolean;
  availableShortcuts: string[];
  lastAction: {
    type: string;
    timestamp: string;
    message?: string;
    data?: any;
  } | null;
  flowHistory: FlowHistoryEntry[];
}
```

### PlayEventData (Dynamic)
```typescript
interface PlayEventData {
  play_type: string;
  [key: string]: any; // Dynamic based on play type
}
```

## 8. Validation Rules

### Field Validation Constraints
```typescript
const ValidationRules = {
  gameState: {
    gameId: { type: 'number', required: true, min: 1 },
    period: { type: 'number', required: true, min: 1, max: 10 },
    possession: { type: 'enum', values: ['H', 'V'], required: true },
    down: { type: 'number', required: true, min: 1, max: 4 },
    yardsToGo: { type: 'number', required: true, min: 0, max: 100 }
  },
  
  playData: {
    playType: { type: 'enum', required: true },
    yardsGained: { type: 'number', min: -50, max: 100 },
    jerseyNumber: { type: 'string', pattern: '^[0-9]{1,2}$' },
    yardLine: { type: 'string', pattern: '^(H|V)\\d{1,2}|50$' }
  }
};
```

## 9. Default Values

### System Defaults
```javascript
const DEFAULT_VALUES = {
  gameState: {
    period: 1,
    timeRemaining: "15:00",
    possession: 'H',
    down: 1,
    yardsToGo: 10,
    yardLinePosition: 'H35',
    score: { H: 0, V: 0 },
    timeouts: { H: 3, V: 3 },
    play_clock: 40,
    status: 'pregame'
  },
  
  playData: {
    has_fumble: false,
    is_first_down: false,
    is_touchdown: false,
    is_turnover: false,
    is_safety: false,
    is_kickoff: false
  },
  
  drive: {
    plays: 0,
    yards: 0,
    startTime: "15:00"
  }
};
```

## 10. Data Transformation Examples

### Frontend to Backend
```javascript
// Frontend (camelCase)
{
  playType: 'rush',
  primaryPlayerID: 123,
  yardsGained: 5,
  endYardLine: 'V37'
}

// Backend (snake_case)
{
  play_type: 'rush',
  primary_player_id: 123,
  yards_gained: 5,
  end_yard_line: 'V37'
}
```

### Yard Line Format Transformations
```javascript
// Input variations
"H35" → Home 35-yard line
"V20" → Visitor 20-yard line
"50" → Midfield
"H 35" → "H35" (normalized)
"h35" → "H35" (uppercase)
```

### Time Format Transformations
```javascript
// Seconds to display
900 → "15:00"
45 → "0:45"

// Display to seconds
"15:00" → 900
"0:45" → 45
```

## 11. Special Field Notes

### Possession Encoding
- Frontend components: 'home' | 'visitor'
- API/Backend: 'H' | 'V'
- Database: 'H' | 'V'

### Quarter vs Period
- UI Display: "Quarter"
- Frontend State: `quarter`
- Backend/API: `period`
- Overtime: period > 4

### Yard Line Notation
- Format: `[H|V][0-99]` or `50`
- H = Home team's side
- V = Visitor team's side
- 50 = Midfield
- Lower numbers = closer to that team's goal

### Clock Representations
- Display: "MM:SS" string
- Storage: seconds (number) or string
- Conversion handled by GameClockContext