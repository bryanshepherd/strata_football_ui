# Strata Football PHP Backend API Documentation
## Detailed Endpoints and Data Contracts

This document provides comprehensive API endpoint documentation for the Strata Football PHP backend, analyzed from the actual implementation files.

## Table of Contents

1. [API Overview](#api-overview)
2. [Complete Endpoint Reference](#complete-endpoint-reference)
3. [Data Contract System](#data-contract-system)
4. [Request/Response Schemas](#requestresponse-schemas)
5. [Authentication Patterns](#authentication-patterns)
6. [Error Handling](#error-handling)
7. [Example Usage](#example-usage)

## API Overview

The Strata Football backend implements a dual-API architecture:

- **Legacy System**: Direct endpoint access with JSON-based data storage
- **Normalized System**: Database-driven with routing layers
- **Data Contract Layer**: Compatibility middleware for standardization

### Base URL Structure
```
/api/                    # Legacy direct endpoints
/api/router.php          # API version routing
/api/football/router.php # RESTful normalized endpoints
/api/data_contract.php   # Compatibility middleware
```

### API Versioning
The system uses HTTP headers for API version negotiation:
```http
X-API-Version: normalized  # Uses new normalized database
X-API-Version: (absent)    # Uses legacy JSON system
```

## Complete Endpoint Reference

### Core Game Management

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| GET | `/api/get_games.php` | get_games.php | Required | List all games (scoped by user role) |
| GET | `/api/get_game_state.php?gameId={id}` | get_game_state.php | None | Get complete game state |
| POST | `/api/submit_play.php` | submit_play.php | None | Submit play data (600+ lines, core functionality) |
| POST | `/api/save_game.php` | save_game.php | Required | Create new game |
| POST | `/api/save_game_state.php` | save_game_state.php | Required | Save game state only |
| GET | `/api/load_game_state.php?game_id={id}` | load_game_state.php | None | Load game state with data contract |
| DELETE | `/api/delete_game.php` | delete_game.php | Required | Delete game |
| POST | `/api/reset_game.php` | reset_game.php | Required | Reset game state |

### Play Management

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| GET | `/api/get_plays.php?gameId={id}` | get_plays.php | None | Get recent plays with stats |
| POST | `/api/insert_play.php` | insert_play.php | None | Insert individual play |
| DELETE | `/api/delete_play.php` | delete_play.php | Required | Delete play |
| POST | `/api/process_play.php` | process_play.php | None | Process play with engine |
| POST | `/api/process_penalty.php` | process_penalty.php | None | Advanced penalty processing |
| GET | `/api/load_play_log.php?game_id={id}` | load_play_log.php | None | Load play log data |

### Roster & Player Management

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| GET | `/api/get_roster.php?team_id={id}` | get_roster.php | None | Get team roster |
| GET | `/api/get_rosters.php` | get_rosters.php | Required | Get all rosters |
| POST | `/api/save_roster.php` | save_roster.php | Required | Save roster data |
| POST | `/api/import_roster.php` | import_roster.php | Required | Import roster from file |
| POST | `/api/import_roster_csv.php` | import_roster_csv.php | Required | Import CSV roster |
| POST | `/api/update_rosters.php` | update_rosters.php | Required | Update multiple rosters |
| POST | `/api/initialize_rosters.php` | initialize_rosters.php | Required | Initialize game rosters |
| GET | `/api/get_player_details.php?player_id={id}` | get_player_details.php | None | Get detailed player info |
| GET | `/api/get_player_by_jersey.php?jersey={num}&team={id}` | get_player_by_jersey.php | None | Find player by jersey |
| POST | `/api/search_player_by_jersey.php` | search_player_by_jersey.php | None | Search players by jersey |
| POST | `/api/create_placeholder_player.php` | create_placeholder_player.php | Required | Create placeholder player |

### Statistics & Analytics

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| GET | `/api/get_player_stats.php?gameId={id}&playerId={id}` | get_player_stats.php | None | Get player game stats |
| GET | `/api/get_simple_stats.php?gameId={id}` | get_simple_stats.php | None | Get simplified team stats |
| POST | `/api/recalculate_stats.php` | recalculate_stats.php | Required | Recalculate all stats |
| GET | `/api/load_stats.php?game_id={id}` | load_stats.php | None | Load game statistics |

### Teams & Configuration

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| GET | `/api/get_teams.php` | get_teams.php | Required | Get teams (scoped by role) |
| GET | `/api/get_team_metadata.php?teamId={id}` | get_team_metadata.php | None | Get team metadata |
| GET | `/api/get_penalty_chart.php` | get_penalty_chart.php | None | Get penalty definitions |
| POST | `/api/save_coin_toss.php` | save_coin_toss.php | None | Save coin toss result |
| POST | `/api/submit_game_setup.php` | submit_game_setup.php | Required | Submit game setup data |

### Authentication & User Management

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| POST | `/api/auto_login.php` | auto_login.php | None | Auto-login for testing |
| GET | `/api/whoami.php` | whoami.php | None | Get current user info |
| GET | `/api/get_current_user.php` | get_current_user.php | None | Get detailed current user |
| GET | `/api/get_current_game_id.php` | get_current_game_id.php | None | Get active game ID |

### Utility & Admin

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| POST | `/api/refresh_lock.php` | refresh_lock.php | None | Refresh game lock |
| POST | `/api/update_game_status.php` | update_game_status.php | Required | Update game status |
| GET | `/api/play_crud.php` | play_crud.php | None | Play CRUD operations |

### Router System

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| ANY | `/api/router.php?endpoint={name}` | router.php | Varies | Legacy/normalized routing |
| GET | `/api/football/game/{gameId}` | football/router.php | None | RESTful game state |
| POST | `/api/football/event` | football/router.php | None | RESTful event submission |
| POST | `/api/football/clock` | football/router.php | None | RESTful clock update |
| GET | `/api/football/games` | football/router.php | None | RESTful games list |
| POST | `/api/football/game` | football/router.php | None | RESTful create game |

## Data Contract System

The data contract system (`/api/data_contract.php`) provides standardization between frontend and backend:

### Core Classes

#### `StrataDataContract`
Primary transformation utility with methods:
- `transformGameState($frontendData)` - Standardizes game state format
- `transformPlayData($frontendData)` - Standardizes play data format
- `transformToFrontend($backendData)` - Converts backend to frontend format
- `validateGameState($data)` - Validates game state data
- `validatePlayData($data)` - Validates play data

#### `DataContractMiddleware`
Wrapper for existing endpoints:
- `wrapSubmitPlay()` - Middleware for submit_play.php
- `wrapLoadGameState($response)` - Middleware for load_game_state.php

### Field Mappings

The system handles field name variations:

```php
const FIELD_MAPPING = [
    'gameState' => [
        'quarter' => 'period',
        'clock' => 'timeRemaining',
        'possession' => 'possession',
        'down' => 'down',
        'distance' => 'yardsToGo',
        'spot' => 'yardLinePosition',
        'score' => 'score'
    ],
    'playData' => [
        'playType' => 'playType',
        'result' => 'resultCode',
        'rusher' => 'primaryPlayerID',
        'passer' => 'primaryPlayerID',
        'receiver' => 'secondaryPlayerID',
        'yardsGained' => 'yardsGained',
        'sackYards' => 'sackYardage'
    ]
];
```

## Request/Response Schemas

### Game State Schema

#### Request (GET /api/get_game_state.php)
```typescript
interface GameStateRequest {
  gameId: number; // Query parameter
}
```

#### Response
```typescript
interface GameStateResponse {
  gameInfo: {
    game_id: number;
    home_team_name: string;
    home_team_abbr: string;
    home_team_short: string;
    visitor_team_name: string;
    visitor_team_abbr: string;
    visitor_team_short: string;
    home_team_id: number;
    visitor_team_id: number;
    game_date: string;
    venue: string;
  };
  gameState: {
    game_status: string;
    quarter: number;
    time_remaining: number;
    possession: 'home' | 'visitor';
    down: number;
    distance: number;
    yard_line: string;
    home_score: number;
    visitor_score: number;
    home_timeouts: number;
    visitor_timeouts: number;
  };
  rosters: {
    home: MinimalPlayer[];
    visitor: MinimalPlayer[];
  };
  recent_plays: RecentPlay[];
  team_stats: {
    home: TeamStats;
    visitor: TeamStats;
  };
}

interface MinimalPlayer {
  player_id: number;
  jersey_number: number;
}

interface TeamStats {
  rushing_yards: number;
  rushing_attempts: number;
  passing_yards: number;
  pass_completions: number;
  pass_attempts: number;
  pass_interceptions: number;
  total_yards: number;
  total_plays: number;
  first_downs: number;
  penalties: number;
  penalty_yards: number;
  turnovers: number;
  fumbles: number;
  fumbles_lost: number;
  punts: number;
  punt_yards: number;
  third_down_attempts: number;
  third_down_conversions: number;
  fourth_down_attempts: number;
  fourth_down_conversions: number;
}
```

### Play Submission Schema

#### Request (POST /api/submit_play.php)
```typescript
interface PlaySubmissionRequest {
  game_id: number;
  play_data: {
    playType: 'rush' | 'pass' | 'punt' | 'kick' | 'penalty' | 'timeout';
    team: 'H' | 'V';
    
    // Player involvement (varies by play type)
    rusher?: number;        // For rush plays
    passer?: number;        // For pass plays
    receiver?: number;      // For pass plays
    kicker?: number;        // For kick/punt plays
    
    // Result information
    result?: string;        // Result code (C, I, S, etc.)
    yards?: number;         // Yards gained/lost
    spot?: string;          // Final spot (e.g., "V32")
    
    // Context information
    playContext?: string;   // Format: "V,2,10,V28"
    newContext?: string;    // Format after play
    
    // Special flags
    isTouchdown?: boolean;
    isTurnover?: boolean;
    isFirstDown?: boolean;
    isSafety?: boolean;
    isPenalty?: boolean;
    
    // Timing information
    driveTimingInfo?: {
      driveStartTime?: string;  // MM:SS format
      driveEndTime?: string;    // MM:SS format
    };
    
    // Penalty specific
    penaltyCode?: string;
    penaltyYards?: number;
    penaltyTeam?: 'H' | 'V';
    
    // Tackle information
    tackler1?: number;
    tackler2?: number;
    sackBy?: number[];
    sackYards?: number;
  };
}
```

#### Response
```typescript
interface PlaySubmissionResponse {
  success: boolean;
  gameState: GameState;
  playLog: PlayLogEntry[];
  stats: GameStatistics;
  debug?: {
    playLogCount: number;
    originalPlayData: any;
    processedPlayData: any;
  };
}
```

### Penalty Processing Schema

#### Request (POST /api/process_penalty.php)
```typescript
interface PenaltyRequest {
  gameId: number;
  playContext: string;      // Format: "V,2,10,V20"
  penaltyCode: string;      // Penalty abbreviation
  penaltyTeam: 'H' | 'V';
  penaltyYards: number;
  playerNumber?: number;
  enforcement: {
    resultingSpot: string;
    automaticFirstDown: boolean;
    lossOfDown: boolean;
    negatePlayStats: boolean;
    type?: string;
    spotOfFoul?: string;
    enforcementSpot?: string;
    playerEjected?: boolean;
  };
  originalPlay?: {
    yards: number;
    result: string;
  };
}
```

#### Response
```typescript
interface PenaltyResponse {
  success: boolean;
  data: {
    newSpot: string;
    newDown: number;
    newDistance: number;
    possession: 'H' | 'V';
    lineToGain: string;
    firstDownType?: string;
    penaltyStats: {
      team: 'H' | 'V';
      yards: number;
      count: number;
      penaltyCode: string;
      playerNumber?: number;
    };
    playModification?: {
      originalYards: number;
      modifiedSpot: string;
      negated: boolean;
    };
    isTouchdown: boolean;
    shouldTriggerPAT: boolean;
    isNegated: boolean;
    negatedBy?: string;
    enforcement: {
      type: string;
      spotOfFoul: string;
      enforcementSpot: string;
      automaticFirstDown: boolean;
      lossOfDown: boolean;
      playerEjected: boolean;
    };
  };
}
```

### Roster Management Schema

#### Request (GET /api/get_roster.php)
```typescript
interface RosterRequest {
  team_id: number; // Query parameter
}
```

#### Response
```typescript
interface RosterResponse extends Array<RosterPlayer> {}

interface RosterPlayer {
  Number: number;
  FirstName: string;
  LastName: string;
  Name: string;          // Computed: FirstName + LastName
  OffPosition: string;
  DefPosition: string;
  STPosition: string;
  Class: string;
}
```

### Game List Schema

#### Response (GET /api/get_games.php)
```typescript
interface GameListResponse extends Array<GameListItem> {}

interface GameListItem {
  GameID: number;
  HomeTeam: string;
  AwayTeam: string;
  HomeTeamName: string;
  VisitorTeamName: string;
  Location: string;
  Stadium: string;
  GameDate: string;
  StartTime?: string;
  EndTime?: string;
  Duration?: string;
  Temp?: string;
  Wind?: string;
  Conditions?: string;
  Surface?: string;
  Attendance?: number;
  current_game: boolean;
  challenges: boolean;
  replay_official?: string;
  CreatedBy: number;
  OwnerAdminID?: number;
}
```

## Authentication Patterns

The API implements role-based authentication with three patterns:

### 1. No Authentication Required
- Game state reading (`get_game_state.php`)
- Play submission (`submit_play.php`)
- Statistics (`get_plays.php`, `get_simple_stats.php`)
- Public roster access (`get_roster.php`)

### 2. Session Authentication Required
```php
require_once __DIR__ . '/../includes/session.php';

if (!isset($_SESSION['UserID'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not authorized']);
    exit;
}
```

Files requiring authentication:
- Game management (`save_game.php`, `delete_game.php`)
- Roster management (`save_roster.php`, `import_roster.php`)
- Administrative functions (`get_games.php`, `get_teams.php`)

### 3. Role-Based Access Control
```php
require_once '../auth_helpers.php';

if (isSuper()) {
    // Super admin sees everything
    $stmt = $pdo->query("SELECT * FROM games");
} else {
    // Scoped by admin group
    $ownerID = getAdminScopeID();
    $stmt = $pdo->prepare("SELECT * FROM games WHERE OwnerAdminID = ?");
    $stmt->execute([$ownerID]);
}
```

### Auto-Login for Development
The `/api/auto_login.php` endpoint provides automatic authentication for development:

```bash
curl -X POST http://localhost/api/auto_login.php \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "message": "Auto-logged in for testing",
  "user_id": 1,
  "username": "admin"
}
```

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details (optional)",
  "timestamp": "2025-01-26 12:00:00"
}
```

### HTTP Status Codes

| Code | Usage | Examples |
|------|-------|----------|
| 200 | Success | All successful operations |
| 400 | Bad Request | Invalid input, missing required fields |
| 403 | Forbidden | Not authenticated |
| 404 | Not Found | Game not found, player not found |
| 405 | Method Not Allowed | Wrong HTTP method |
| 500 | Internal Server Error | Database errors, exceptions |

### Error Patterns by Category

#### Input Validation Errors
```php
if (!$gameId || !$playData) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: game_id and play_data']);
    exit;
}
```

#### Database Errors
```php
try {
    // Database operations
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'details' => $e->getMessage()]);
}
```

#### Authentication Errors
```php
if (!isset($_SESSION['UserID'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not authorized']);
    exit;
}
```

## Example Usage

### Complete Game Flow Example

#### 1. Auto-Login (Development)
```bash
curl -X POST http://localhost/api/auto_login.php \
  -H "Content-Type: application/json" \
  -c cookies.txt
```

#### 2. Get Available Games
```bash
curl -X GET http://localhost/api/get_games.php \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

#### 3. Get Game State
```bash
curl -X GET "http://localhost/api/get_game_state.php?gameId=1" \
  -H "Content-Type: application/json"
```

#### 4. Submit a Rush Play
```bash
curl -X POST http://localhost/api/submit_play.php \
  -H "Content-Type: application/json" \
  -d '{
    "game_id": 1,
    "play_data": {
      "playType": "rush",
      "team": "H",
      "rusher": 25,
      "result": "C",
      "yards": 8,
      "spot": "H35",
      "playContext": "H,1,10,H27",
      "newContext": "H,2,2,H35",
      "isFirstDown": false,
      "isTouchdown": false
    }
  }'
```

#### 5. Submit a Pass Play with Touchdown
```bash
curl -X POST http://localhost/api/submit_play.php \
  -H "Content-Type: application/json" \
  -d '{
    "game_id": 1,
    "play_data": {
      "playType": "pass",
      "team": "H",
      "passer": 12,
      "receiver": 88,
      "result": "C",
      "yards": 25,
      "spot": "V0",
      "playContext": "H,2,2,H35",
      "newContext": "H,1,10,H20",
      "isFirstDown": true,
      "isTouchdown": true
    }
  }'
```

#### 6. Process a Penalty
```bash
curl -X POST http://localhost/api/process_penalty.php \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": 1,
    "playContext": "H,2,10,H30",
    "penaltyCode": "HOLD",
    "penaltyTeam": "H",
    "penaltyYards": 10,
    "playerNumber": 75,
    "enforcement": {
      "resultingSpot": "H20",
      "automaticFirstDown": false,
      "lossOfDown": false,
      "negatePlayStats": false,
      "type": "spot_of_foul",
      "spotOfFoul": "H30",
      "enforcementSpot": "H30"
    }
  }'
```

#### 7. Get Updated Game Statistics
```bash
curl -X GET "http://localhost/api/get_simple_stats.php?gameId=1" \
  -H "Content-Type: application/json"
```

### Using the Data Contract System

#### Submit Play with Data Contract
```bash
curl -X POST http://localhost/api/submit_play.php \
  -H "Content-Type: application/json" \
  -d '{
    "game_id": 1,
    "play_data": {
      "type": "rush",
      "runner": 25,
      "yards": 8,
      "finalSpot": "H35"
    }
  }'
```

The data contract system will automatically transform:
- `type` → `playType`
- `runner` → `rusher` (via primaryPlayerID)
- `finalSpot` → `spot`

### Advanced Penalty Example with Play Negation
```bash
curl -X POST http://localhost/api/process_penalty.php \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": 1,
    "playContext": "H,3,8,H22",
    "penaltyCode": "OPI",
    "penaltyTeam": "H",
    "penaltyYards": 15,
    "playerNumber": 88,
    "enforcement": {
      "resultingSpot": "H7",
      "automaticFirstDown": false,
      "lossOfDown": true,
      "negatePlayStats": true,
      "type": "previous_spot",
      "spotOfFoul": "H37",
      "enforcementSpot": "H22"
    },
    "originalPlay": {
      "yards": 15,
      "result": "C"
    }
  }'
```

## Idempotency and Invariants

### Duplicate Play Prevention
The `submit_play.php` endpoint implements duplicate detection:

```php
// Create signature for duplicate detection
$playSignature = $playType . '|' . $team . '|' . $player . '|' . $result . '|' . $timeWindow;

// Check last 5 plays for duplicates
foreach (array_slice($playLog, -5) as $recentPlay) {
    if ($recentSignature === $playSignature) {
        $isDuplicate = true;
        break;
    }
}
```

### Game State Consistency
The system validates game state consistency after each play:

```php
$stateErrors = validateGameStateConsistency($gameState);
if (!empty($stateErrors)) {
    error_log("GAME STATE VALIDATION ERRORS: " . implode(", ", $stateErrors));
}
```

### Transaction Safety
Critical operations use database transactions:

```php
$pdo->beginTransaction();
try {
    savePlayLog($gameId, $playLog);
    saveGameState($gameId, $gameState);
    saveDriveChart($gameId, $driveChart);
    saveStats($gameId, $stats);
    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollback();
    throw $e;
}
```

### Data Integrity Constraints

1. **Play Order**: Plays must be submitted in chronological order
2. **Game State Progression**: Down/distance must follow football rules
3. **Score Consistency**: Team scores must match touchdown/field goal history
4. **Possession Changes**: Must be accompanied by appropriate context changes
5. **Time Progression**: Game clock must move in logical direction

This documentation reflects the actual implementation as analyzed from the PHP source files. The API provides comprehensive football game management with sophisticated play processing, penalty handling, and statistics tracking.