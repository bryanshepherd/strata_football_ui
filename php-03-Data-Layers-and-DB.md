# PHP Backend - Database Architecture and Data Layers

## Overview

The PHP backend employs a hybrid database architecture transitioning from JSON-based storage to a normalized relational model. The system uses MySQL 8.x with PHP 7.4+ PDO connections for both legacy JSON fields and modern normalized tables.

## Database Connection Architecture

### Connection Patterns

**Primary Connection (PDO)** - `/Applications/XAMPP/xamppfiles/htdocs/strata_football/db_pdo.php`
```php
$host = "localhost";
$user = "root";
$password = "";
$database = "strata_football";

$pdo = new PDO("mysql:host=$host;dbname=$database;charset=utf8mb4", $user, $password);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
```

**Legacy Connection (MySQLi)** - `/Applications/XAMPP/xamppfiles/htdocs/strata_football/db.php`
```php
$conn = new mysqli($host, $user, $password, $database);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
```

### Configuration Management

Database credentials are managed through:
- `config.ini` - Primary configuration file
- Environment-specific overrides in individual files
- No centralized connection pooling (each file creates its own connection)

## Database Schema Architecture

### Normalized Schema Design

The system implements a comprehensive normalized schema defined in `/Applications/XAMPP/xamppfiles/htdocs/strata_football/docs/architecture/normalized_schema.sql`:

#### Core Tables

**game_state** - Central game state management
```sql
CREATE TABLE game_state (
    GameID INT PRIMARY KEY,
    Period TINYINT NOT NULL DEFAULT 1,
    TimeRemaining INT NOT NULL DEFAULT 900,
    CurrentDown TINYINT NOT NULL DEFAULT 1,
    YardsToGo TINYINT NOT NULL DEFAULT 10,
    YardLinePosition VARCHAR(10) NOT NULL DEFAULT 'H25',
    Possession ENUM('HOME', 'VISITOR') NOT NULL DEFAULT 'HOME',
    HomeScore INT NOT NULL DEFAULT 0,
    VisitorScore INT NOT NULL DEFAULT 0,
    HomeTimeouts TINYINT NOT NULL DEFAULT 3,
    VisitorTimeouts TINYINT NOT NULL DEFAULT 3,
    GameStatus VARCHAR(20) NOT NULL DEFAULT 'Pregame',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**drives** - Drive tracking and statistics
```sql
CREATE TABLE drives (
    DriveID INT AUTO_INCREMENT PRIMARY KEY,
    GameID INT NOT NULL,
    DriveNumber SMALLINT NOT NULL,
    PossessionTeam ENUM('HOME', 'VISITOR') NOT NULL,
    StartYardLinePosition VARCHAR(10) NOT NULL,
    EndYardLinePosition VARCHAR(10),
    TotalPlays SMALLINT NOT NULL DEFAULT 0,
    TotalYards SMALLINT NOT NULL DEFAULT 0,
    TimeOfPossession INT NOT NULL DEFAULT 0,
    Result ENUM('TOUCHDOWN', 'FIELD_GOAL', 'PUNT', 'TURNOVER', 'DOWNS', 'SAFETY') DEFAULT NULL,
    IsActive BOOLEAN NOT NULL DEFAULT TRUE
);
```

**plays** - Individual play records
```sql
CREATE TABLE plays (
    PlayID INT AUTO_INCREMENT PRIMARY KEY,
    DriveID INT NOT NULL,
    PlayNumber SMALLINT NOT NULL,
    Period TINYINT NOT NULL,
    TimeRemaining INT NOT NULL,
    PlayType VARCHAR(20) NOT NULL,
    Description TEXT NOT NULL,
    YardsGained SMALLINT NOT NULL DEFAULT 0,
    IsScoring BOOLEAN NOT NULL DEFAULT FALSE,
    IsTurnover BOOLEAN NOT NULL DEFAULT FALSE,
    PlayerID1 INT,
    PlayerID2 INT,
    PlayerID3 INT
);
```

### Hybrid JSON Storage

Legacy tables still maintain JSON fields for backward compatibility:

**games** table includes:
- `gameState` JSON field (legacy)
- `playLog` JSON field (legacy)
- `driveChart` JSON field (legacy)
- `stats` JSON field (legacy)

## Query Patterns and Database Usage

### Common Query Patterns

#### 1. Game State Retrieval
**Location**: `api/get_game_state.php`
```php
// Complex join with team information
$gameQuery = "
    SELECT g.*, 
           ht.TeamName as HomeTeamName, ht.ShortName as HomeTeamShort,
           vt.TeamName as VisitorTeamName, vt.ShortName as VisitorTeamShort
    FROM games g
    LEFT JOIN teams ht ON g.HomeTeamID = ht.TeamID
    LEFT JOIN teams vt ON g.VisitorTeamID = vt.TeamID
    WHERE g.GameID = :gameId
";
```

#### 2. Statistics Aggregation Queries
**Location**: `api/get_game_state.php` (lines 130-241)
```php
// Team rushing statistics
$rushQuery = "SELECT COUNT(*) as attempts, COALESCE(SUM(YardsGained), 0) as yards 
              FROM plays WHERE GameID = :gameId AND PlayType = 'RUSH' AND PossessionTeam = 'HOME'";

// Complex passing statistics with conditional aggregation
$passQuery = "SELECT COUNT(*) as attempts, 
                     COALESCE(SUM(CASE WHEN PlayResult = 'COMPLETE' THEN YardsGained ELSE 0 END), 0) as yards,
                     COALESCE(SUM(CASE WHEN PlayResult = 'COMPLETE' THEN 1 ELSE 0 END), 0) as completions,
                     COALESCE(SUM(CASE WHEN PlayResult = 'INTERCEPTION' OR IsTurnover = 1 THEN 1 ELSE 0 END), 0) as interceptions
              FROM plays WHERE GameID = :gameId AND PlayType = 'PASS' AND PossessionTeam = 'HOME'";
```

#### 3. Player Performance Queries
**Location**: `api/get_game_state.php` (lines 255-342)
```php
// Top performers by category
$rusherQuery = "SELECT PrimaryPlayerID as player_id, 
                      COUNT(*) as rushing_attempts,
                      COALESCE(SUM(YardsGained), 0) as rushing_yards
               FROM plays 
               WHERE GameID = :gameId AND PlayType = 'RUSH' AND PossessionTeam = :team 
               GROUP BY PrimaryPlayerID 
               ORDER BY rushing_yards DESC 
               LIMIT 2";
```

#### 4. Drive Management Queries
**Location**: `api/GameStateManager.php`
```php
// Active drive retrieval
$stmt = $this->pdo->prepare("
    SELECT * FROM drives 
    WHERE GameID = ? AND IsActive = 1 
    ORDER BY DriveID DESC LIMIT 1
");

// Drive statistics update
$stmt = $this->pdo->prepare("
    UPDATE drives 
    SET TotalPlays = TotalPlays + 1, 
        TotalYards = TotalYards + ?,
        LastUpdated = NOW()
    WHERE DriveID = ?
");
```

### Query Performance Characteristics

#### Performance Issues Identified

1. **N+1 Query Problem**: Individual penalty lookups per play
   ```php
   // engine_v2.php lines 67-74
   if ($row['HasPenalty']) {
       $penaltyStmt = $pdo->prepare("SELECT * FROM penalties WHERE PlayID = ?");
       $penaltyStmt->execute([$row['PlayID']]);
       $penalties = $penaltyStmt->fetchAll(PDO::FETCH_ASSOC);
   }
   ```

2. **Redundant String Replacement**: Team statistics calculated with string replacement
   ```php
   // get_game_state.php lines 194-236
   $passQuery = str_replace("PossessionTeam = 'HOME'", "PossessionTeam = 'VISITOR'", $passQuery);
   ```

3. **Heavy Aggregation Queries**: Multiple complex aggregations per request
   ```php
   // Multiple separate queries for each statistic type instead of single comprehensive query
   ```

## Transaction Management

### Transaction Patterns

The codebase shows consistent transaction usage across critical operations:

#### 1. GameStateManager Transactions
**Location**: `api/GameStateManager.php` (lines 195-217)
```php
try {
    $this->pdo->beginTransaction();
    
    // Multiple related operations
    $this->ensureGameState($gameId, $gameRules);
    $this->ensureTeamStatistics($gameId);
    $this->ensureInitialDrive($gameId, $gameRules);
    
    $this->pdo->commit();
    return true;
    
} catch (Exception $e) {
    $this->pdo->rollBack();
    throw $e;
}
```

#### 2. Play Submission Transactions
**Location**: `api/submit_play_enhanced.php` (lines 1106-1355)
```php
$pdo->beginTransaction();
try {
    // Complex multi-step play processing
    $processedPlayLog = processDriveEntries($playLog, $driveGameState);
    resetStats($gameState, $stats, $gameConfig);
    foreach ($playLog as $p) {
        applyPlayToStats($p, $gameState, $stats, $gameConfig, $playLog);
    }
    
    savePlayLog($gameId, $playLog);
    saveGameState($gameId, $gameState);
    saveDriveChart($gameId, $generatedDriveChart);
    saveStats($gameId, $stats);
    
    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    throw $e;
}
```

#### 3. Batch Operations
**Location**: `api/import_roster_csv.php`, `api/reset_game.php`
```php
$pdo->beginTransaction();
try {
    // Multiple insert/update operations
    foreach ($operations as $op) {
        // Individual operations
    }
    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    throw $e;
}
```

### Transaction Safety

- **Consistent Error Handling**: All transactions properly catch exceptions and rollback
- **Resource Management**: PDO connections with proper exception handling
- **Atomic Operations**: Complex multi-table updates are properly wrapped

## Data Consistency Patterns

### JSON vs Normalized Storage Consistency

#### 1. Dual Write Pattern
**Location**: `api/submit_play.php` (lines 593-642)
```php
// Save to both JSON fields (legacy) and normalized tables
savePlayLog($gameId, $playLog);        // JSON storage
saveGameState($gameId, $gameState);    // JSON storage
saveDriveChart($gameId, $generatedDriveChart); // JSON storage
saveStats($gameId, $stats);            // JSON storage

// Normalized table updates happen in parallel
```

#### 2. Data Migration Strategy
The system employs a gradual migration approach:
- New features use normalized tables
- Legacy features continue with JSON
- GameStateManager provides abstraction layer

#### 3. Consistency Validation
**Location**: `api/submit_play.php` (lines 587-590)
```php
// Validate final game state consistency
$stateErrors = validateGameStateConsistency($gameState);
if (!empty($stateErrors)) {
    error_log("GAME STATE VALIDATION ERRORS: " . implode(", ", $stateErrors));
}
```

### Data Integrity Mechanisms

#### 1. Foreign Key Constraints
```sql
FOREIGN KEY (GameID) REFERENCES games(GameID) ON DELETE CASCADE
FOREIGN KEY (DriveID) REFERENCES drives(DriveID) ON DELETE CASCADE
FOREIGN KEY (PlayerID1) REFERENCES players(PlayerID) ON DELETE SET NULL
```

#### 2. Enum Constraints
```sql
Possession ENUM('HOME', 'VISITOR') NOT NULL DEFAULT 'HOME'
TeamSide ENUM('HOME', 'VISITOR') NOT NULL
Result ENUM('TOUCHDOWN', 'FIELD_GOAL', 'PUNT', 'TURNOVER', 'DOWNS', 'SAFETY') DEFAULT NULL
```

#### 3. Application-Level Validation
**Location**: `includes/football_rules.php`, `includes/yardline_validation.php`

## Performance Considerations

### Current Performance Issues

#### 1. Multiple Query Anti-Pattern
**Impact**: High database load
**Location**: `api/get_game_state.php`
```php
// Separate queries for each team's statistics instead of single query
foreach (['HOME', 'VISITOR'] as $team) {
    $rusherStmt = $pdo->prepare($rusherQuery);
    $rusherStmt->execute([':gameId' => $gameId, ':team' => $team]);
    // Repeated for each statistic type
}
```

#### 2. String Replacement Query Generation
**Impact**: SQL parsing overhead
```php
$passQuery = str_replace("PossessionTeam = 'HOME'", "PossessionTeam = 'VISITOR'", $passQuery);
```

#### 3. Missing Composite Indexes
Current indexes are basic - missing compound indexes for common query patterns:
```sql
-- Missing optimizations
INDEX idx_plays_game_type_team (GameID, PlayType, PossessionTeam);
INDEX idx_plays_game_player_type (GameID, PrimaryPlayerID, PlayType);
```

### Performance Optimization Opportunities

#### 1. Query Consolidation
```sql
-- Single query for all team statistics
SELECT 
    PossessionTeam,
    PlayType,
    COUNT(*) as attempts,
    SUM(YardsGained) as total_yards,
    SUM(CASE WHEN PlayResult = 'COMPLETE' THEN 1 ELSE 0 END) as completions
FROM plays 
WHERE GameID = ? 
GROUP BY PossessionTeam, PlayType;
```

#### 2. Materialized Views/Caching
Create pre-computed statistics tables updated via triggers.

#### 3. Index Optimization
```sql
-- Compound indexes for common access patterns
CREATE INDEX idx_plays_game_stats ON plays (GameID, PossessionTeam, PlayType, PlayResult);
CREATE INDEX idx_drives_game_active ON drives (GameID, IsActive, PossessionTeam);
```

## Database Access Patterns

### Connection Management
- **No Connection Pooling**: Each request creates new connections
- **Mixed Connection Types**: PDO and MySQLi used concurrently
- **No Persistent Connections**: Standard connection lifecycle

### Error Handling
```php
// Consistent pattern across codebase
try {
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    throw new Exception("Database operation failed");
}
```

## Security Considerations

### SQL Injection Prevention
- **Prepared Statements**: Consistently used throughout codebase
- **Parameter Binding**: Proper parameter binding with typed parameters
- **Input Validation**: Application-level validation before database operations

### Access Control
- **Session-Based Authentication**: User sessions managed via PHP sessions
- **Role-Based Access**: Admin vs regular user differentiation
- **Game Locking**: Concurrent access control via timestamp locking

## Summary

The Strata Football PHP backend demonstrates a well-architected transition from JSON-based storage to normalized relational tables. While the dual-storage approach ensures backward compatibility, it introduces complexity and potential performance issues. The transaction management is robust, but query patterns reveal opportunities for optimization through consolidation and better indexing strategies.

Key strengths:
- Comprehensive normalized schema design
- Consistent transaction usage
- Proper error handling and data validation
- Flexible hybrid storage approach

Areas for improvement:
- Query consolidation to reduce database roundtrips
- Index optimization for common access patterns
- Connection pooling implementation
- Elimination of redundant dual-write patterns as migration completes