<?php
/**
 * ADMIN DASHBOARD COMPATIBILITY LAYER
 * Preserves existing admin dashboard functionality while using normalized database
 * Compatible with PHP 7.4 and existing API endpoints
 * 
 * This layer translates between:
 * - Old JSON-based API responses (for admin dashboard)
 * - New normalized database structure (for data storage)
 */

require_once 'YardLineConverter.php';

class AdminDashboardCompatibility {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * GET /api/load_game_state.php (LEGACY COMPATIBILITY)
     * Returns JSON in the exact format the admin dashboard expects
     */
    public function loadGameStateLegacy($gameId) {
        // Get normalized data from new tables
        $gameInfo = $this->getGameInfo($gameId);
        $gameState = $this->getCurrentGameState($gameId);
        $currentDrive = $this->getCurrentDrive($gameId);
        $plays = $this->getPlaysForGame($gameId);
        $stats = $this->getGameStatistics($gameId);
        
        // Build the legacy JSON format that admin dashboard expects
        $legacyGameState = [
            'period' => $gameState['Period'],
            'clock' => $this->formatClockTime($gameState['TimeRemaining']),
            'possession' => strtolower($gameState['Possession']),
            'down' => $gameState['CurrentDown'],
            'distance' => $gameState['YardsToGo'],
            'yardline' => $this->convertPositionToLegacyFormat($gameState['YardLinePosition']),
            'goalToGo' => (bool)$gameState['IsGoalToGo'],
            'redZone' => (bool)$gameState['IsRedZone'],
            'timeouts' => [
                'home' => $gameState['HomeTimeouts'],
                'visitor' => $gameState['VisitorTimeouts']
            ],
            'score' => [
                'home' => $gameInfo['HomeScore'],
                'visitor' => $gameInfo['VisitorScore']
            ]
        ];
        
        // Add current drive info if exists
        if ($currentDrive) {
            $legacyGameState['drives'] = [
                'current' => [
                    'team' => strtolower($currentDrive['PossessionTeam']),
                    'startYard' => $this->convertPositionToLegacyFormat($currentDrive['StartYardLinePosition']),
                    'plays' => $currentDrive['TotalPlays'],
                    'yards' => $currentDrive['TotalYards'],
                    'timeOfPossession' => $this->formatClockTime($currentDrive['TimeOfPossession'])
                ]
            ];
        }
        
        return [
            'GameState' => $legacyGameState,
            'HomeScore' => $gameInfo['HomeScore'],
            'VisitorScore' => $gameInfo['VisitorScore'],
            'LastUpdated' => $gameState['LastUpdated'],
            'LockedBy' => $gameInfo['LockedBy'],
            'LockedAt' => $gameInfo['LockedAt']
        ];
    }
    
    /**
     * GET /api/load_play_log.php (LEGACY COMPATIBILITY)
     * Returns play log in legacy JSON format
     */
    public function loadPlayLogLegacy($gameId) {
        $plays = $this->getPlaysForGame($gameId);
        
        $legacyPlays = [];
        foreach ($plays as $play) {
            $legacyPlay = [
                'playID' => 'play_' . str_pad($play['PlayID'], 3, '0', STR_PAD_LEFT),
                'driveID' => $play['DriveID'] ? 'drive_' . str_pad($play['DriveID'], 3, '0', STR_PAD_LEFT) : null,
                'period' => $play['Period'],
                'clock' => $this->formatClockTime($play['TimeRemaining']),
                'down' => $play['Down'],
                'distance' => $play['YardsToGo'],
                'yardline' => $this->convertPositionToLegacyFormat($play['YardLinePosition']),
                'possession' => strtolower($play['PossessionTeam']),
                'playType' => strtolower($play['PlayType']),
                'result' => [
                    'type' => strtolower($play['PlayResult']),
                    'yards' => $play['YardsGained'],
                    'firstDown' => (bool)$play['IsFirstDown'],
                    'touchdown' => (bool)$play['IsTouchdown'],
                    'turnover' => (bool)$play['IsTurnover'],
                    'spot' => [
                        'start' => $this->convertPositionToLegacySpot($play['YardLinePosition']),
                        'end' => $play['EndYardLinePosition'] ? $this->convertPositionToLegacySpot($play['EndYardLinePosition']) : null
                    ]
                ],
                'description' => $play['PlayDescription'],
                'timestamp' => date('c', strtotime($play['CreatedAt']))
            ];
            
            // Add player info if available
            if ($play['PrimaryPlayerID']) {
                $legacyPlay['player'] = [
                    'primary' => [
                        'id' => $play['PrimaryPlayerID'],
                        'name' => $play['PrimaryPlayerName']
                    ]
                ];
                
                if ($play['SecondaryPlayerID']) {
                    $legacyPlay['player']['secondary'] = [
                        'id' => $play['SecondaryPlayerID'],
                        'name' => $play['SecondaryPlayerName']
                    ];
                }
            }
            
            // Add penalty info
            $penalties = $this->getPenaltiesForPlay($play['PlayID']);
            $legacyPlay['penalties'] = $this->formatPenaltiesLegacy($penalties);
            
            // Add fumble info
            $legacyPlay['fumble'] = $this->formatFumbleLegacy($play);
            
            $legacyPlays[] = $legacyPlay;
        }
        
        return ['plays' => $legacyPlays];
    }
    
    /**
     * GET /api/load_stats.php (LEGACY COMPATIBILITY)
     * Returns statistics in legacy JSON format
     */
    public function loadStatsLegacy($gameId) {
        $teamStats = $this->getTeamStatistics($gameId);
        $playerStats = $this->getPlayerStatistics($gameId);
        
        $legacyStats = [
            'home' => [
                'team' => [
                    'id' => $teamStats['home']['TeamID'] ?? null,
                    'name' => $teamStats['home']['TeamName'] ?? 'Home'
                ],
                'rushing' => [
                    'attempts' => $teamStats['home']['RushAttempts'] ?? 0,
                    'yards' => $teamStats['home']['RushingYards'] ?? 0,
                    'touchdowns' => $teamStats['home']['RushTouchdowns'] ?? 0,
                    'fumbles' => $teamStats['home']['Fumbles'] ?? 0
                ],
                'passing' => [
                    'attempts' => $teamStats['home']['PassAttempts'] ?? 0,
                    'completions' => $teamStats['home']['PassCompletions'] ?? 0,
                    'yards' => $teamStats['home']['PassingYards'] ?? 0,
                    'touchdowns' => $teamStats['home']['PassTouchdowns'] ?? 0,
                    'interceptions' => $teamStats['home']['Interceptions'] ?? 0
                ],
                'firstDowns' => [
                    'total' => $teamStats['home']['FirstDownsTotal'] ?? 0,
                    'rushing' => $teamStats['home']['FirstDownsRush'] ?? 0,
                    'passing' => $teamStats['home']['FirstDownsPass'] ?? 0,
                    'penalty' => $teamStats['home']['FirstDownsPenalty'] ?? 0
                ],
                'penalties' => [
                    'total' => $teamStats['home']['Penalties'] ?? 0,
                    'yards' => $teamStats['home']['PenaltyYards'] ?? 0
                ],
                'timeOfPossession' => $this->formatClockTime($teamStats['home']['TimeOfPossession'] ?? 0)
            ],
            'visitor' => [
                // Similar structure for visitor team
            ]
        ];
        
        return $legacyStats;
    }
    
    /**
     * POST /api/save_game_state.php (LEGACY COMPATIBILITY)
     * Accepts legacy JSON format and saves to normalized tables
     */
    public function saveGameStateLegacy($gameId, $legacyGameState) {
        try {
            $this->pdo->beginTransaction();
            
            // Convert legacy format to normalized format
            $yardLinePosition = $this->convertLegacyFormatToPosition(
                $legacyGameState['yardline'], 
                $legacyGameState['possession']
            );
            
            // Update game_state table
            $stmt = $this->pdo->prepare("
                UPDATE game_state SET
                    Period = ?,
                    TimeRemaining = ?,
                    CurrentDown = ?,
                    YardsToGo = ?,
                    YardLinePosition = ?,
                    Possession = ?,
                    IsGoalToGo = ?,
                    IsRedZone = ?,
                    HomeTimeouts = ?,
                    VisitorTimeouts = ?,
                    LastUpdated = NOW(),
                    UpdatedBy = ?
                WHERE GameID = ?
            ");
            
            $stmt->execute([
                $legacyGameState['period'],
                $this->parseClockTime($legacyGameState['clock']),
                $legacyGameState['down'],
                $legacyGameState['distance'],
                $yardLinePosition,
                strtoupper($legacyGameState['possession']),
                $legacyGameState['goalToGo'] ? 1 : 0,
                $legacyGameState['redZone'] ? 1 : 0,
                $legacyGameState['timeouts']['home'],
                $legacyGameState['timeouts']['visitor'],
                $_SESSION['UserID'] ?? null,
                $gameId
            ]);
            
            // Update games table scores
            if (isset($legacyGameState['score'])) {
                $stmt = $this->pdo->prepare("
                    UPDATE games SET
                        HomeScore = ?,
                        VisitorScore = ?,
                        LastUpdated = NOW()
                    WHERE GameID = ?
                ");
                $stmt->execute([
                    $legacyGameState['score']['home'],
                    $legacyGameState['score']['visitor'],
                    $gameId
                ]);
            }
            
            $this->pdo->commit();
            
            return [
                'success' => true,
                'LastUpdated' => date('Y-m-d H:i:s')
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw new Exception("Error saving game state: " . $e->getMessage());
        }
    }
    
    /**
     * Game Locking Methods (PRESERVE EXISTING FUNCTIONALITY)
     */
    public function acquireGameLock($gameId, $userId) {
        try {
            // Check if game is already locked by someone else
            $stmt = $this->pdo->prepare("
                SELECT LockedBy, LockedAt 
                FROM games 
                WHERE GameID = ?
            ");
            $stmt->execute([$gameId]);
            $lock = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($lock['LockedBy'] && $lock['LockedBy'] != $userId) {
                // Check if lock is stale (older than 10 minutes)
                $lockTime = strtotime($lock['LockedAt']);
                $currentTime = time();
                
                if (($currentTime - $lockTime) < 600) { // 10 minutes
                    throw new Exception("Game is currently being scored by another user");
                }
            }
            
            // Acquire the lock
            $stmt = $this->pdo->prepare("
                UPDATE games SET
                    LockedBy = ?,
                    LockedAt = NOW()
                WHERE GameID = ?
            ");
            $stmt->execute([$userId, $gameId]);
            
            return ['success' => true, 'message' => 'Game lock acquired'];
            
        } catch (Exception $e) {
            throw new Exception("Error acquiring game lock: " . $e->getMessage());
        }
    }
    
    public function releaseGameLock($gameId, $userId) {
        try {
            $stmt = $this->pdo->prepare("
                UPDATE games SET
                    LockedBy = NULL,
                    LockedAt = NULL
                WHERE GameID = ? AND LockedBy = ?
            ");
            $stmt->execute([$gameId, $userId]);
            
            return ['success' => true, 'message' => 'Game lock released'];
            
        } catch (Exception $e) {
            throw new Exception("Error releasing game lock: " . $e->getMessage());
        }
    }
    
    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================
    
    private function getGameInfo($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT g.*, ht.TeamName as HomeTeamName, vt.TeamName as VisitorTeamName
            FROM games g
            JOIN teams ht ON g.HomeTeamID = ht.TeamID
            JOIN teams vt ON g.VisitorTeamID = vt.TeamID
            WHERE g.GameID = ?
        ");
        $stmt->execute([$gameId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    private function getCurrentGameState($gameId) {
        $stmt = $this->pdo->prepare("SELECT * FROM game_state WHERE GameID = ?");
        $stmt->execute([$gameId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    private function getCurrentDrive($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM drives 
            WHERE GameID = ? AND IsActive = 1
            ORDER BY DriveNumber DESC LIMIT 1
        ");
        $stmt->execute([$gameId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    private function convertPositionToLegacyFormat($position) {
        // Convert H25, V35 to numeric format admin dashboard expects
        $parsed = YardLineConverter::parsePosition($position);
        return $parsed['yard']; // Return just the yard number
    }
    
    private function convertLegacyFormatToPosition($yardLine, $possession) {
        // Convert numeric yard line + possession to H25, V35 format
        $side = (strtoupper($possession) === 'HOME') ? 'H' : 'V';
        return $side . $yardLine;
    }
    
    private function formatClockTime($seconds) {
        $minutes = floor($seconds / 60);
        $secs = $seconds % 60;
        return sprintf("%d:%02d", $minutes, $secs);
    }
    
    private function parseClockTime($clockString) {
        $parts = explode(':', $clockString);
        return ($parts[0] * 60) + $parts[1];
    }
    
    
    private function getPlaysForGame($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT p.*, d.DriveNumber, d.TeamID as DriveTeamID,
                   CASE d.TeamID 
                       WHEN (SELECT HomeTeamID FROM games WHERE GameID = ?) THEN 'HOME'
                       ELSE 'VISITOR' 
                   END as PossessionTeam
            FROM plays p
            LEFT JOIN drives d ON p.DriveID = d.DriveID
            WHERE p.GameID = ?
            ORDER BY p.PlayID ASC
        ");
        $stmt->execute([$gameId, $gameId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    private function getGameStatistics($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT ts.*, t.TeamName, t.Abbreviation,
                   CASE t.TeamID 
                       WHEN (SELECT HomeTeamID FROM games WHERE GameID = ?) THEN 'home'
                       ELSE 'visitor' 
                   END as TeamType
            FROM team_statistics ts
            JOIN teams t ON ts.TeamID = t.TeamID
            WHERE ts.GameID = ?
        ");
        $stmt->execute([$gameId, $gameId]);
        $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $formatted = ['home' => [], 'visitor' => []];
        foreach ($stats as $stat) {
            $formatted[$stat['TeamType']] = $stat;
        }
        
        return $formatted;
    }
    
    private function getTeamStatistics($gameId) {
        return $this->getGameStatistics($gameId);
    }
    
    private function getPlayerStatistics($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT gs.*, p.FirstName, p.LastName, p.Number, p.Position,
                   t.TeamName, t.Abbreviation
            FROM game_statistics gs
            JOIN players p ON gs.PlayerID = p.PlayerID
            JOIN teams t ON p.TeamID = t.TeamID
            WHERE gs.GameID = ?
            ORDER BY t.TeamID, p.Number
        ");
        $stmt->execute([$gameId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    private function getPenaltiesForPlay($playId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM penalties 
            WHERE PlayID = ?
            ORDER BY PenaltyID ASC
        ");
        $stmt->execute([$playId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    private function formatPenaltiesLegacy($penalties) {
        $legacyPenalties = [];
        foreach ($penalties as $penalty) {
            $legacyPenalties[] = [
                'type' => $penalty['PenaltyType'],
                'description' => $penalty['Description'],
                'yards' => $penalty['PenaltyYards'],
                'enforced' => (bool)$penalty['IsEnforced'],
                'declined' => (bool)$penalty['IsDeclined'],
                'offsetting' => (bool)$penalty['IsOffsetting'],
                'team' => strtolower($penalty['PenalizedTeam']),
                'player' => $penalty['PlayerNumber'] ?? null
            ];
        }
        return $legacyPenalties;
    }
    
    private function formatFumbleLegacy($play) {
        if (!$play['IsFumble']) {
            return null;
        }
        
        return [
            'occurred' => true,
            'fumbledBy' => $play['PrimaryPlayerName'],
            'recoveredBy' => $play['SecondaryPlayerName'] ?? 'Unknown',
            'yards' => $play['YardsGained'] ?? 0,
            'turnover' => (bool)$play['IsTurnover']
        ];
    }
    
    private function convertPositionToLegacySpot($position) {
        $parsed = YardLineConverter::parsePosition($position);
        return [
            'yard' => $parsed['yard'],
            'side' => $parsed['side'] === 'home' ? 'H' : 'V'
        ];
    }
    
    // Additional helper methods for formatting legacy data...
}

// ============================================================================
// LEGACY API ENDPOINT HANDLERS
// ============================================================================

// Instantiate compatibility layer
$adminCompat = new AdminDashboardCompatibility($pdo);

// Route to appropriate handler based on request
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

if (strpos($requestUri, '/api/load_game_state.php') !== false && $requestMethod === 'GET') {
    $gameId = $_GET['GameID'] ?? null;
    if ($gameId) {
        header('Content-Type: application/json');
        echo json_encode($adminCompat->loadGameStateLegacy($gameId));
    }
} elseif (strpos($requestUri, '/api/save_game_state.php') !== false && $requestMethod === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $gameId = $input['GameID'] ?? null;
    if ($gameId && isset($input['GameState'])) {
        header('Content-Type: application/json');
        echo json_encode($adminCompat->saveGameStateLegacy($gameId, $input['GameState']));
    }
}
// ... other endpoint handlers
?>
