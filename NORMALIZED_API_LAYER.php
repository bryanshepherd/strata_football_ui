<?php
/**
 * NORMALIZED DATABASE API LAYER
 * Compatible with PHP 7.4 and MySQL 8.x
 * Provides JSON responses for React frontend
 * Replaces JSON-based storage with proper relational queries
 */

class GameStateAPI {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * GET /api/load_game_state.php
     * Returns complete game state in same JSON format as before
     */
    public function loadGameState($gameId) {
        try {
            // Get basic game info
            $gameInfo = $this->getGameInfo($gameId);
            if (!$gameInfo) {
                throw new Exception("Game not found");
            }
            
            // Get current game state
            $gameState = $this->getCurrentGameState($gameId);
            
            // Get current drive
            $currentDrive = $this->getCurrentDrive($gameId);
            
            // Get recent plays (last 10)
            $recentPlays = $this->getRecentPlays($gameId, 10);
            
            // Get team statistics
            $teamStats = $this->getTeamStatistics($gameId);
            
            // Get player statistics  
            $playerStats = $this->getPlayerStatistics($gameId);
            
            // Format response to match React frontend expectations
            return [
                'game_info' => [
                    'game_id' => $gameId,
                    'home_team_name' => $gameInfo['HomeTeamName'],
                    'visitor_team_name' => $gameInfo['VisitorTeamName'],
                    'home_team_id' => $gameInfo['HomeTeamID'],
                    'visitor_team_id' => $gameInfo['VisitorTeamID'],
                    'game_date' => $gameInfo['GameDate'],
                    'venue' => $gameInfo['Stadium']
                ],
                'live_state' => [
                    'game_status' => strtolower(str_replace(' ', '_', $gameState['GameStatus'])),
                    'quarter' => $gameState['Period'],
                    'time_remaining' => $gameState['TimeRemaining'],
                    'possession' => strtolower($gameState['Possession']),
                    'down' => $gameState['CurrentDown'],
                    'distance' => $gameState['YardsToGo'],
                    'yard_line' => $gameState['YardLine'],
                    'yard_line_side' => strtolower($gameState['YardLineSide']),
                    'home_score' => $gameInfo['HomeScore'],
                    'visitor_score' => $gameInfo['VisitorScore'],
                    'home_timeouts' => $gameState['HomeTimeouts'],
                    'visitor_timeouts' => $gameState['VisitorTimeouts'],
                    'play_clock' => $gameState['PlayClock'],
                    'is_goal_to_go' => (bool) $gameState['IsGoalToGo'],
                    'is_red_zone' => (bool) $gameState['IsRedZone']
                ],
                'current_drive' => $currentDrive,
                'recent_plays' => $recentPlays,
                'team_stats' => $teamStats,
                'player_stats' => $playerStats
            ];
            
        } catch (Exception $e) {
            throw new Exception("Error loading game state: " . $e->getMessage());
        }
    }
    
    /**
     * POST /api/submit_play.php
     * Submit a new play and update all related tables
     */
    public function submitPlay($gameId, $playData) {
        try {
            $this->pdo->beginTransaction();
            
            // Get current game state
            $gameState = $this->getCurrentGameState($gameId);
            $currentDrive = $this->getCurrentDrive($gameId);
            
            if (!$currentDrive) {
                // Start new drive if none exists
                $currentDrive = $this->startNewDrive($gameId, $gameState['Possession'], $gameState);
            }
            
            // Insert the play
            $playId = $this->insertPlay($gameId, $currentDrive['DriveID'], $gameState, $playData);
            
            // Update drive statistics
            $this->updateDriveStats($currentDrive['DriveID'], $playData);
            
            // Update player statistics
            $this->updatePlayerStats($gameId, $playData);
            
            // Update team statistics
            $this->updateTeamStats($gameId, $playData);
            
            // Update game state for next play
            $this->updateGameState($gameId, $playData, $gameState);
            
            // Handle drive ending events
            if ($this->isDriveEnding($playData)) {
                $this->endDrive($currentDrive['DriveID'], $playData);
            }
            
            $this->pdo->commit();
            
            // Return updated game state
            return [
                'success' => true,
                'play_id' => $playId,
                'updated_game_state' => $this->loadGameState($gameId)
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw new Exception("Error submitting play: " . $e->getMessage());
        }
    }
    
    /**
     * Get basic game information
     */
    private function getGameInfo($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT g.*, 
                   ht.TeamName as HomeTeamName,
                   vt.TeamName as VisitorTeamName
            FROM games g
            JOIN teams ht ON g.HomeTeamID = ht.TeamID
            JOIN teams vt ON g.VisitorTeamID = vt.TeamID
            WHERE g.GameID = ?
        ");
        $stmt->execute([$gameId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get current game state
     */
    private function getCurrentGameState($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM game_state 
            WHERE GameID = ?
        ");
        $stmt->execute([$gameId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Create default state if none exists
        if (!$result) {
            $this->initializeGameState($gameId);
            return $this->getCurrentGameState($gameId);
        }
        
        return $result;
    }
    
    /**
     * Get current active drive
     */
    private function getCurrentDrive($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM drives 
            WHERE GameID = ? AND IsActive = 1
            ORDER BY DriveNumber DESC 
            LIMIT 1
        ");
        $stmt->execute([$gameId]);
        $drive = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$drive) {
            return null;
        }
        
        // Format for frontend
        return [
            'drive_id' => $drive['DriveID'],
            'team' => strtolower($drive['PossessionTeam']),
            'start_yard' => $drive['StartYardLine'],
            'start_side' => strtolower($drive['StartYardLineSide']),
            'plays' => $drive['TotalPlays'],
            'yards' => $drive['TotalYards'],
            'time_of_possession' => $this->formatTime($drive['TimeOfPossession']),
            'start_time' => $this->formatTime($drive['StartTime'])
        ];
    }
    
    /**
     * Get recent plays
     */
    private function getRecentPlays($gameId, $limit = 10) {
        $stmt = $this->pdo->prepare("
            SELECT p.*, 
                   pp.FirstName as PrimaryPlayerFirstName,
                   pp.LastName as PrimaryPlayerLastName,
                   sp.FirstName as SecondaryPlayerFirstName,
                   sp.LastName as SecondaryPlayerLastName
            FROM plays p
            LEFT JOIN players pp ON p.PrimaryPlayerID = pp.PlayerID
            LEFT JOIN players sp ON p.SecondaryPlayerID = sp.PlayerID
            WHERE p.GameID = ?
            ORDER BY p.PlayNumber DESC
            LIMIT ?
        ");
        $stmt->execute([$gameId, $limit]);
        $plays = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $formattedPlays = [];
        foreach ($plays as $play) {
            $formattedPlays[] = [
                'play_id' => $play['PlayID'],
                'drive_id' => $play['DriveID'],
                'period' => $play['Period'],
                'clock' => $this->formatTime($play['TimeRemaining']),
                'down' => $play['Down'],
                'distance' => $play['YardsToGo'],
                'yard_line' => $play['YardLine'],
                'yard_line_side' => strtolower($play['YardLineSide']),
                'possession' => strtolower($play['PossessionTeam']),
                'play_type' => strtolower($play['PlayType']),
                'primary_player' => $play['PrimaryPlayerFirstName'] ? [
                    'id' => $play['PrimaryPlayerID'],
                    'name' => $play['PrimaryPlayerFirstName'] . ' ' . $play['PrimaryPlayerLastName']
                ] : null,
                'secondary_player' => $play['SecondaryPlayerFirstName'] ? [
                    'id' => $play['SecondaryPlayerID'], 
                    'name' => $play['SecondaryPlayerFirstName'] . ' ' . $play['SecondaryPlayerLastName']
                ] : null,
                'result' => strtolower($play['PlayResult']),
                'yards' => $play['YardsGained'],
                'net_yards' => $play['NetYards'],
                'is_first_down' => (bool) $play['IsFirstDown'],
                'is_touchdown' => (bool) $play['IsTouchdown'],
                'is_turnover' => (bool) $play['IsTurnover'],
                'description' => $play['PlayDescription']
            ];
        }
        
        return array_reverse($formattedPlays); // Chronological order
    }
    
    /**
     * Get team statistics
     */
    private function getTeamStatistics($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM team_statistics 
            WHERE GameID = ?
        ");
        $stmt->execute([$gameId]);
        $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $formattedStats = ['home' => [], 'visitor' => []];
        
        foreach ($stats as $stat) {
            $side = strtolower($stat['TeamSide']);
            $formattedStats[$side] = [
                'first_downs' => [
                    'total' => $stat['FirstDownsTotal'],
                    'rushing' => $stat['FirstDownsRush'],
                    'passing' => $stat['FirstDownsPass'],
                    'penalty' => $stat['FirstDownsPenalty']
                ],
                'total_yards' => $stat['TotalYards'],
                'rushing_yards' => $stat['RushingYards'],
                'passing_yards' => $stat['PassingYards'],
                'rush_attempts' => $stat['RushAttempts'],
                'pass_attempts' => $stat['PassAttempts'],
                'pass_completions' => $stat['PassCompletions'],
                'turnovers' => $stat['FumblesLost'] + $stat['Interceptions'],
                'penalties' => [
                    'total' => $stat['Penalties'],
                    'yards' => $stat['PenaltyYards']
                ],
                'time_of_possession' => $this->formatTime($stat['TimeOfPossession'])
            ];
        }
        
        return $formattedStats;
    }
    
    /**
     * Get player statistics
     */
    private function getPlayerStatistics($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT gs.*, p.FirstName, p.LastName, p.JerseyNumber, 
                   t.TeamID, g.HomeTeamID, g.VisitorTeamID
            FROM game_statistics gs
            JOIN players p ON gs.PlayerID = p.PlayerID
            JOIN teams t ON p.TeamID = t.TeamID
            JOIN games g ON gs.GameID = g.GameID
            WHERE gs.GameID = ?
            ORDER BY t.TeamID, p.JerseyNumber
        ");
        $stmt->execute([$gameId]);
        $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $formattedStats = ['home' => [], 'visitor' => []];
        
        foreach ($stats as $stat) {
            // Determine if player is on home or visitor team
            $side = ($stat['TeamID'] == $stat['HomeTeamID']) ? 'home' : 'visitor';
            
            $playerStat = [
                'player_id' => $stat['PlayerID'],
                'name' => $stat['FirstName'] . ' ' . $stat['LastName'],
                'number' => $stat['JerseyNumber'],
                'rushing' => [
                    'attempts' => $stat['RushAttempts'],
                    'yards' => $stat['RushYards'],
                    'touchdowns' => $stat['RushTouchdowns'],
                    'long' => $stat['RushLong']
                ],
                'passing' => [
                    'attempts' => $stat['PassAttempts'],
                    'completions' => $stat['PassCompletions'],
                    'yards' => $stat['PassYards'],
                    'touchdowns' => $stat['PassTouchdowns'],
                    'interceptions' => $stat['PassInterceptions']
                ],
                'receiving' => [
                    'receptions' => $stat['Receptions'],
                    'yards' => $stat['ReceivingYards'],
                    'touchdowns' => $stat['ReceivingTouchdowns'],
                    'long' => $stat['ReceivingLong']
                ],
                'defense' => [
                    'tackles' => $stat['Tackles'],
                    'assists' => $stat['TacklesAssist'],
                    'sacks' => $stat['Sacks'],
                    'interceptions' => $stat['Interceptions']
                ]
            ];
            
            $formattedStats[$side][] = $playerStat;
        }
        
        return $formattedStats;
    }
    
    /**
     * Helper: Format seconds to MM:SS
     */
    private function formatTime($seconds) {
        $minutes = floor($seconds / 60);
        $secs = $seconds % 60;
        return sprintf("%d:%02d", $minutes, $secs);
    }
    
    /**
     * Initialize game state for new game
     */
    private function initializeGameState($gameId) {
        $stmt = $this->pdo->prepare("
            INSERT INTO game_state (GameID) VALUES (?)
            ON DUPLICATE KEY UPDATE GameID = GameID
        ");
        $stmt->execute([$gameId]);
    }
    
    /**
     * Start a new drive
     */
    private function startNewDrive($gameId, $possessionTeam, $gameState) {
        // Get next drive number
        $stmt = $this->pdo->prepare("
            SELECT COALESCE(MAX(DriveNumber), 0) + 1 as NextDriveNumber
            FROM drives WHERE GameID = ?
        ");
        $stmt->execute([$gameId]);
        $driveNumber = $stmt->fetchColumn();
        
        $stmt = $this->pdo->prepare("
            INSERT INTO drives (
                GameID, DriveNumber, PossessionTeam, StartPeriod, StartTime,
                StartYardLine, StartYardLineSide
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $gameId,
            $driveNumber,
            $possessionTeam,
            $gameState['Period'],
            $gameState['TimeRemaining'],
            $gameState['YardLine'],
            $gameState['YardLineSide']
        ]);
        
        return [
            'DriveID' => $this->pdo->lastInsertId(),
            'DriveNumber' => $driveNumber
        ];
    }
    
    // Additional methods for insertPlay, updateDriveStats, etc. would go here...
    // [Implementation continues...]
}

// Usage example:
// $api = new GameStateAPI($pdo);
// $gameState = $api->loadGameState($_GET['GameID']);
// header('Content-Type: application/json');
// echo json_encode($gameState);
