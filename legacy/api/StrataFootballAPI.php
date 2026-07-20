<?php
/**
 * STRATA FOOTBALL API SYSTEM - NORMALIZED DATABASE
 * Compatible with PHP 7.4 and existing admin dashboard
 * Handles game transfer from games table to game_state table when scoring begins
 */

require_once 'YardLineConverter.php';

class StrataFootballAPI {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * GET /api/get_games.php
     * Returns all games with team information (for admin dashboard game selection)
     */
    public function getGames() {
        try {
            $userId = $_SESSION['UserID'] ?? null;
            $userRole = $_SESSION['Role'] ?? 'user';
            
            // Build query based on user permissions
            $sql = "
                SELECT g.*, 
                       ht.TeamName as HomeTeamName,
                       ht.Abbreviation as HomeTeamAbbr,
                       vt.TeamName as VisitorTeamName,
                       vt.Abbreviation as VisitorTeamAbbr,
                       gs.GameID as HasGameState,
                       CASE 
                           WHEN g.LockedBy IS NOT NULL THEN u.FullName
                           ELSE NULL 
                       END as LockedByUser
                FROM games g
                JOIN teams ht ON g.HomeTeamID = ht.TeamID
                JOIN teams vt ON g.VisitorTeamID = vt.TeamID
                LEFT JOIN game_state gs ON g.GameID = gs.GameID
                LEFT JOIN users u ON g.LockedBy = u.UserID
            ";
            
            $params = [];
            
            // Apply user-based filtering
            if ($userRole !== 'super') {
                if ($userRole === 'admin') {
                    $sql .= " WHERE g.OwnerAdminID = ?";
                    $params[] = $userId;
                } else {
                    $sql .= " WHERE g.OwnerAdminID = ?";
                    $params[] = $_SESSION['ParentAdminID'] ?? $userId;
                }
            }
            
            $sql .= " ORDER BY g.GameDate DESC, g.StartTime DESC";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $games = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Format for frontend
            foreach ($games as &$game) {
                $game['IsActive'] = !is_null($game['HasGameState']);
                $game['IsLocked'] = !is_null($game['LockedBy']);
                $game['CanScore'] = !$game['IsLocked'] || $game['LockedBy'] == $userId;
            }
            
            return $games;
            
        } catch (Exception $e) {
            throw new Exception("Error getting games: " . $e->getMessage());
        }
    }
    
    /**
     * POST /api/start_scoring.php
     * Transfer game from games table to game_state table and acquire lock
     */
    public function startScoring($gameId) {
        try {
            $userId = $_SESSION['UserID'] ?? null;
            if (!$userId) {
                throw new Exception("User not logged in");
            }
            
            $this->pdo->beginTransaction();
            
            // Check if user can access this game
            if (!$this->canAccessGame($gameId, $userId)) {
                throw new Exception("Access denied to this game");
            }
            
            // Check if game is already locked by someone else
            $existingLock = $this->checkGameLock($gameId);
            if ($existingLock && $existingLock['LockedBy'] != $userId) {
                throw new Exception("Game is currently being scored by " . $existingLock['LockedByUser']);
            }
            
            // Acquire game lock
            $this->acquireGameLock($gameId, $userId);
            
            // Check if game_state already exists
            $stmt = $this->pdo->prepare("SELECT GameID FROM game_state WHERE GameID = ?");
            $stmt->execute([$gameId]);
            $existsInGameState = $stmt->fetch();
            
            if (!$existsInGameState) {
                // Transfer game to game_state table with initial values
                $this->transferGameToGameState($gameId);
                
                // Initialize team statistics
                $this->initializeTeamStatistics($gameId);
                
                // Create initial drive if needed
                $this->createInitialDrive($gameId);
            }
            
            $this->pdo->commit();
            
            return [
                'success' => true,
                'message' => 'Game scoring started',
                'gameId' => $gameId,
                'lockAcquired' => true
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw new Exception("Error starting game scoring: " . $e->getMessage());
        }
    }
    
    /**
     * GET /api/load_game_state.php
     * Load current game state for scoring interface
     */
    public function loadGameState($gameId) {
        try {
            // Verify game exists in game_state table
            $stmt = $this->pdo->prepare("SELECT GameID FROM game_state WHERE GameID = ?");
            $stmt->execute([$gameId]);
            if (!$stmt->fetch()) {
                throw new Exception("Game not initialized for scoring. Please start scoring first.");
            }
            
            // Get game info
            $gameInfo = $this->getGameInfo($gameId);
            
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
            
            // Get game rules
            $gameRules = $this->getGameRules($gameId);
            
            return [
                'success' => true,
                'game_info' => [
                    'game_id' => $gameId,
                    'home_team_name' => $gameInfo['HomeTeamName'],
                    'visitor_team_name' => $gameInfo['VisitorTeamName'],
                    'home_team_id' => $gameInfo['HomeTeamID'],
                    'visitor_team_id' => $gameInfo['VisitorTeamID'],
                    'game_date' => $gameInfo['GameDate'],
                    'start_time' => $gameInfo['StartTime'],
                    'venue' => $gameInfo['Stadium'] ?: $gameInfo['Location'],
                    'game_status' => $gameState['GameStatus']
                ],
                'live_state' => [
                    'game_status' => strtolower(str_replace(' ', '_', $gameState['GameStatus'])),
                    'quarter' => $gameState['Period'],
                    'time_remaining' => $gameState['TimeRemaining'],
                    'possession' => strtolower($gameState['Possession']),
                    'down' => $gameState['CurrentDown'],
                    'distance' => $gameState['YardsToGo'],
                    'yard_line_position' => $gameState['YardLinePosition'],
                    'yard_line' => YardLineConverter::parsePosition($gameState['YardLinePosition'])['yard'],
                    'yard_line_side' => YardLineConverter::parsePosition($gameState['YardLinePosition'])['side'],
                    'home_score' => $gameInfo['HomeScore'],
                    'visitor_score' => $gameInfo['VisitorScore'],
                    'home_timeouts' => $gameState['HomeTimeouts'],
                    'visitor_timeouts' => $gameState['VisitorTimeouts'],
                    'home_challenges' => $gameState['HomeChallenges'],
                    'visitor_challenges' => $gameState['VisitorChallenges'],
                    'is_goal_to_go' => (bool) $gameState['IsGoalToGo'],
                    'is_red_zone' => (bool) $gameState['IsRedZone']
                ],
                'current_drive' => $currentDrive,
                'recent_plays' => $recentPlays,
                'team_stats' => $teamStats,
                'player_stats' => $playerStats,
                'game_rules' => $gameRules,
                'lock_info' => [
                    'locked_by' => $gameInfo['LockedBy'],
                    'locked_at' => $gameInfo['LockedAt'],
                    'can_edit' => $gameInfo['LockedBy'] == ($_SESSION['UserID'] ?? null)
                ]
            ];
            
        } catch (Exception $e) {
            throw new Exception("Error loading game state: " . $e->getMessage());
        }
    }
    
    /**
     * POST /api/submit_play.php
     * Submit a play and update all related tables
     */
    public function submitPlay($gameId, $playData) {
        try {
            $userId = $_SESSION['UserID'] ?? null;
            
            // Verify user has lock on game
            $lockInfo = $this->checkGameLock($gameId);
            if (!$lockInfo || $lockInfo['LockedBy'] != $userId) {
                throw new Exception("You must have the game lock to submit plays");
            }
            
            $this->pdo->beginTransaction();
            
            // Get current game state
            $gameState = $this->getCurrentGameState($gameId);
            $currentDrive = $this->getCurrentDrive($gameId);
            
            // Create new drive if needed
            if (!$currentDrive && $playData['playType'] !== 'GAME_CONTROL') {
                $currentDrive = $this->createNewDrive($gameId, $gameState);
            }
            
            // Insert the play
            $playId = $this->insertPlay($gameId, $currentDrive, $gameState, $playData);
            
            // Update drive statistics if this is a regular play
            if ($playData['playType'] !== 'GAME_CONTROL' && $currentDrive) {
                $this->updateDriveStats($currentDrive['DriveID'], $playData);
            }
            
            // Update player statistics
            $this->updatePlayerStats($gameId, $playData);
            
            // Update team statistics
            $this->updateTeamStats($gameId, $playData);
            
            // Update game state for next play
            $this->updateGameStateAfterPlay($gameId, $playData, $gameState);
            
            // Handle drive ending scenarios
            if ($this->isDriveEnding($playData)) {
                $this->endCurrentDrive($currentDrive['DriveID'], $playData);
            }
            
            // Update game scores if scoring play
            if ($this->isScoringPlay($playData)) {
                $this->updateGameScore($gameId, $playData);
            }
            
            $this->pdo->commit();
            
            // Return updated game state
            return [
                'success' => true,
                'play_id' => $playId,
                'message' => 'Play submitted successfully',
                'updated_game_state' => $this->loadGameState($gameId)
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw new Exception("Error submitting play: " . $e->getMessage());
        }
    }
    
    /**
     * POST /api/end_scoring.php
     * Release game lock and finalize game
     */
    public function endScoring($gameId) {
        try {
            $userId = $_SESSION['UserID'] ?? null;
            
            // Verify user has lock
            $lockInfo = $this->checkGameLock($gameId);
            if (!$lockInfo || $lockInfo['LockedBy'] != $userId) {
                throw new Exception("You must have the game lock to end scoring");
            }
            
            $this->pdo->beginTransaction();
            
            // End any active drives
            $this->endAllActiveDrives($gameId);
            
            // Update game status to Final
            $this->updateGameStatus($gameId, 'Final');
            
            // Release game lock
            $this->releaseGameLock($gameId, $userId);
            
            $this->pdo->commit();
            
            return [
                'success' => true,
                'message' => 'Game scoring ended successfully'
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw new Exception("Error ending game scoring: " . $e->getMessage());
        }
    }
    
    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================
    
    private function canAccessGame($gameId, $userId) {
        $userRole = $_SESSION['Role'] ?? 'user';
        
        if ($userRole === 'super') {
            return true;
        }
        
        $stmt = $this->pdo->prepare("SELECT OwnerAdminID FROM games WHERE GameID = ?");
        $stmt->execute([$gameId]);
        $game = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$game) {
            return false;
        }
        
        if ($userRole === 'admin') {
            return $game['OwnerAdminID'] == $userId;
        } else {
            return $game['OwnerAdminID'] == ($_SESSION['ParentAdminID'] ?? $userId);
        }
    }
    
    private function checkGameLock($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT g.LockedBy, g.LockedAt, u.FullName as LockedByUser
            FROM games g
            LEFT JOIN users u ON g.LockedBy = u.UserID
            WHERE g.GameID = ?
        ");
        $stmt->execute([$gameId]);
        $lock = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($lock && $lock['LockedBy']) {
            // Check if lock is stale (older than 15 minutes)
            $lockTime = strtotime($lock['LockedAt']);
            $currentTime = time();
            
            if (($currentTime - $lockTime) > 900) { // 15 minutes
                // Lock is stale, release it
                $this->releaseGameLock($gameId, $lock['LockedBy']);
                return null;
            }
            
            return $lock;
        }
        
        return null;
    }
    
    private function acquireGameLock($gameId, $userId) {
        $stmt = $this->pdo->prepare("
            UPDATE games SET
                LockedBy = ?,
                LockedAt = NOW()
            WHERE GameID = ?
        ");
        $stmt->execute([$userId, $gameId]);
    }
    
    private function releaseGameLock($gameId, $userId) {
        $stmt = $this->pdo->prepare("
            UPDATE games SET
                LockedBy = NULL,
                LockedAt = NULL
            WHERE GameID = ? AND LockedBy = ?
        ");
        $stmt->execute([$gameId, $userId]);
    }
    
    private function transferGameToGameState($gameId) {
        // Get game info and rules
        $gameInfo = $this->getGameInfo($gameId);
        $gameRules = $this->getGameRules($gameId);
        
        // Determine initial values based on game rules
        $quarterLength = ($gameRules['QuarterLength'] ?? 15) * 60; // Convert to seconds
        $homeTimeouts = 3; // Standard
        $visitorTimeouts = 3;
        
        // Set challenges based on rules
        $homeChallenges = null;
        $visitorChallenges = null;
        if ($gameRules['ChallengesEnabled']) {
            $homeChallenges = 2; // Standard challenge count
            $visitorChallenges = 2;
        }
        
        // Create game_state record
        $stmt = $this->pdo->prepare("
            INSERT INTO game_state (
                GameID, Period, TimeRemaining, CurrentDown, YardsToGo, 
                YardLinePosition, Possession, IsGoalToGo, IsRedZone,
                HomeTimeouts, VisitorTimeouts, HomeChallenges, VisitorChallenges,
                GameStatus, UpdatedBy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                UpdatedBy = VALUES(UpdatedBy),
                LastUpdated = NOW()
        ");
        
        $stmt->execute([
            $gameId,
            1, // Period 1
            $quarterLength, // Full quarter time
            1, // 1st down
            10, // 10 yards to go
            'H25', // Home 25 yard line (standard kickoff return position)
            'HOME', // Home team possession (placeholder)
            0, // Not goal to go
            0, // Not red zone
            $homeTimeouts,
            $visitorTimeouts,
            $homeChallenges,
            $visitorChallenges,
            'In Progress',
            $_SESSION['UserID'] ?? null
        ]);
    }
    
    private function getGameInfo($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT g.*, 
                   ht.TeamName as HomeTeamName,
                   ht.Abbreviation as HomeTeamAbbr,
                   vt.TeamName as VisitorTeamName,
                   vt.Abbreviation as VisitorTeamAbbr
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
    
    private function getGameRules($gameId) {
        $stmt = $this->pdo->prepare("SELECT * FROM game_rules WHERE GameID = ?");
        $stmt->execute([$gameId]);
        $rules = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Return default rules if none exist
        if (!$rules) {
            return [
                'QuarterLength' => 15,
                'NumPeriods' => 4,
                'DownsPerSeries' => 4,
                'DistanceToFirstDown' => 10,
                'ChallengesEnabled' => 0,
                'OTEnabled' => 1
            ];
        }
        
        return $rules;
    }
    
    private function initializeTeamStatistics($gameId) {
        $gameInfo = $this->getGameInfo($gameId);
        
        // Initialize home team stats
        $stmt = $this->pdo->prepare("
            INSERT INTO team_statistics (
                GameID, TeamID, FirstDowns, TotalYards, PassingYards, 
                RushingYards, Penalties, PenaltyYards, Turnovers, 
                TimeOfPossession
            ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 0)
            ON DUPLICATE KEY UPDATE GameID = GameID
        ");
        $stmt->execute([$gameId, $gameInfo['HomeTeamID']]);
        $stmt->execute([$gameId, $gameInfo['VisitorTeamID']]);
    }
    
    private function createInitialDrive($gameId) {
        // Don't create a drive automatically - wait for first actual play
        return null;
    }
    
    private function getCurrentDrive($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM drives 
            WHERE GameID = ? AND EndedBy IS NULL 
            ORDER BY DriveNumber DESC 
            LIMIT 1
        ");
        $stmt->execute([$gameId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    private function getRecentPlays($gameId, $limit = 10) {
        $stmt = $this->pdo->prepare("
            SELECT p.*, d.DriveNumber,
                   CASE p.PlayType
                       WHEN 'RUSH' THEN CONCAT(p.PrimaryPlayerName, ' rush for ', p.YardsGained, ' yards')
                       WHEN 'PASS' THEN CONCAT(p.PrimaryPlayerName, ' pass to ', p.SecondaryPlayerName, ' for ', p.YardsGained, ' yards')
                       WHEN 'KICK' THEN CONCAT(p.PlaySubtype, ' by ', p.PrimaryPlayerName)
                       WHEN 'PENALTY' THEN CONCAT('Penalty: ', p.PenaltyDescription)
                       ELSE p.PlayDescription
                   END as FormattedDescription
            FROM plays p
            LEFT JOIN drives d ON p.DriveID = d.DriveID
            WHERE p.GameID = ? 
            ORDER BY p.PlayID DESC 
            LIMIT ?
        ");
        $stmt->execute([$gameId, $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    private function getTeamStatistics($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT ts.*, t.TeamName, t.Abbreviation 
            FROM team_statistics ts
            JOIN teams t ON ts.TeamID = t.TeamID
            WHERE ts.GameID = ?
        ");
        $stmt->execute([$gameId]);
        $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $formattedStats = [];
        foreach ($stats as $stat) {
            $formattedStats[$stat['Abbreviation']] = $stat;
        }
        
        return $formattedStats;
    }
    
    private function getPlayerStatistics($gameId) {
        $stmt = $this->pdo->prepare("
            SELECT gs.*, p.FirstName, p.LastName, p.Number, t.Abbreviation as TeamAbbr
            FROM game_statistics gs
            JOIN players p ON gs.PlayerID = p.PlayerID
            JOIN teams t ON p.TeamID = t.TeamID
            WHERE gs.GameID = ?
            ORDER BY t.TeamID, p.Number
        ");
        $stmt->execute([$gameId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    private function createNewDrive($gameId, $gameState) {
        $gameInfo = $this->getGameInfo($gameId);
        
        // Determine drive number
        $stmt = $this->pdo->prepare("SELECT COALESCE(MAX(DriveNumber), 0) + 1 as NextDrive FROM drives WHERE GameID = ?");
        $stmt->execute([$gameId]);
        $driveNumber = $stmt->fetch(PDO::FETCH_ASSOC)['NextDrive'];
        
        // Determine possessing team
        $possessingTeamId = ($gameState['Possession'] === 'HOME') ? 
                           $gameInfo['HomeTeamID'] : $gameInfo['VisitorTeamID'];
        
        // Insert new drive
        $stmt = $this->pdo->prepare("
            INSERT INTO drives (
                GameID, DriveNumber, TeamID, StartPeriod, StartTime,
                StartYardLine, TotalPlays, TotalYards, EndedBy
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL)
        ");
        
        $stmt->execute([
            $gameId,
            $driveNumber,
            $possessingTeamId,
            $gameState['Period'],
            $gameState['TimeRemaining'],
            $gameState['YardLinePosition'],
        ]);
        
        // Return the created drive
        $driveId = $this->pdo->lastInsertId();
        $stmt = $this->pdo->prepare("SELECT * FROM drives WHERE DriveID = ?");
        $stmt->execute([$driveId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    private function insertPlay($gameId, $currentDrive, $gameState, $playData) {
        $stmt = $this->pdo->prepare("
            INSERT INTO plays (
                GameID, DriveID, PlayNumber, Period, TimeInPeriod,
                PlayType, PlaySubtype, Down, YardsToGo, YardLinePosition,
                YardsGained, PrimaryPlayerName, SecondaryPlayerName,
                PlayDescription, ResultingYardLine, IsFirstDown,
                IsTouchdown, IsCompletedPass, IsFumble, IsInterception,
                PenaltyDescription, UpdatedBy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        // Determine play number
        $playNumber = 1;
        if ($currentDrive) {
            $stmt2 = $this->pdo->prepare("SELECT COALESCE(MAX(PlayNumber), 0) + 1 as NextPlay FROM plays WHERE DriveID = ?");
            $stmt2->execute([$currentDrive['DriveID']]);
            $playNumber = $stmt2->fetch(PDO::FETCH_ASSOC)['NextPlay'];
        }
        
        $yardsGained = intval($playData['yardsGained'] ?? 0);
        $resultingYardLine = $this->calculateResultingYardLine($gameState['YardLinePosition'], $yardsGained);
        
        $stmt->execute([
            $gameId,
            $currentDrive['DriveID'] ?? null,
            $playNumber,
            $gameState['Period'],
            $gameState['TimeRemaining'],
            $playData['playType'] ?? 'RUSH',
            $playData['playSubtype'] ?? null,
            $gameState['CurrentDown'],
            $gameState['YardsToGo'],
            $gameState['YardLinePosition'],
            $yardsGained,
            $playData['primaryPlayer'] ?? null,
            $playData['secondaryPlayer'] ?? null,
            $playData['description'] ?? '',
            $resultingYardLine,
            $playData['isFirstDown'] ?? false,
            $playData['isTouchdown'] ?? false,
            $playData['isCompletedPass'] ?? false,
            $playData['isFumble'] ?? false,
            $playData['isInterception'] ?? false,
            $playData['penaltyDescription'] ?? null,
            $_SESSION['UserID'] ?? null
        ]);
        
        return $this->pdo->lastInsertId();
    }
    
    private function updateDriveStats($driveId, $playData) {
        $stmt = $this->pdo->prepare("
            UPDATE drives SET
                TotalPlays = TotalPlays + 1,
                TotalYards = TotalYards + ?
            WHERE DriveID = ?
        ");
        $stmt->execute([intval($playData['yardsGained'] ?? 0), $driveId]);
    }
    
    private function updatePlayerStats($gameId, $playData) {
        // This will be implemented based on specific player stat requirements
        // For now, just track participation
        if (isset($playData['primaryPlayer']) && $playData['primaryPlayer']) {
            // Find player and update stats - simplified for now
        }
    }
    
    private function updateTeamStats($gameId, $playData) {
        // Update team statistics based on play type
        $yardsGained = intval($playData['yardsGained'] ?? 0);
        
        if ($playData['playType'] === 'RUSH') {
            // Update rushing yards
        } elseif ($playData['playType'] === 'PASS') {
            // Update passing yards
        }
        
        // Add first down if applicable
        if ($playData['isFirstDown'] ?? false) {
            // Increment first downs
        }
    }
    
    private function updateGameStateAfterPlay($gameId, $playData, $currentState) {
        $yardsGained = intval($playData['yardsGained'] ?? 0);
        $newYardLine = $this->calculateResultingYardLine($currentState['YardLinePosition'], $yardsGained);
        
        // Calculate new down and distance
        $newDown = $currentState['CurrentDown'];
        $newYardsToGo = $currentState['YardsToGo'] - $yardsGained;
        
        if ($playData['isFirstDown'] ?? false) {
            $newDown = 1;
            $newYardsToGo = 10;
        } elseif ($newYardsToGo <= 0) {
            $newDown = 1;
            $newYardsToGo = 10;
        } else {
            $newDown++;
        }
        
        // Check for goal to go and red zone
        $yardLineInfo = YardLineConverter::parsePosition($newYardLine);
        $distanceToGoal = ($yardLineInfo['side'] === 'opponent') ? $yardLineInfo['yard'] : (100 - $yardLineInfo['yard']);
        $isGoalToGo = ($newYardsToGo >= $distanceToGoal);
        $isRedZone = ($distanceToGoal <= 20);
        
        // Update game state
        $stmt = $this->pdo->prepare("
            UPDATE game_state SET
                CurrentDown = ?,
                YardsToGo = ?,
                YardLinePosition = ?,
                IsGoalToGo = ?,
                IsRedZone = ?,
                LastUpdated = NOW()
            WHERE GameID = ?
        ");
        
        $stmt->execute([
            $newDown,
            $newYardsToGo,
            $newYardLine,
            $isGoalToGo ? 1 : 0,
            $isRedZone ? 1 : 0,
            $gameId
        ]);
    }
    
    private function isDriveEnding($playData) {
        return ($playData['isTouchdown'] ?? false) ||
               ($playData['isInterception'] ?? false) ||
               ($playData['isFumble'] && ($playData['fumbleRecoveredBy'] ?? '') !== $playData['possession']) ||
               ($playData['playType'] === 'PUNT') ||
               ($playData['playType'] === 'KICK' && in_array($playData['playSubtype'], ['FIELD_GOAL', 'EXTRA_POINT']));
    }
    
    private function endCurrentDrive($driveId, $playData) {
        $endedBy = 'TURNOVER';
        
        if ($playData['isTouchdown'] ?? false) {
            $endedBy = 'TOUCHDOWN';
        } elseif ($playData['playType'] === 'PUNT') {
            $endedBy = 'PUNT';
        } elseif ($playData['playType'] === 'KICK') {
            $endedBy = ($playData['playSubtype'] === 'FIELD_GOAL') ? 'FIELD_GOAL' : 'EXTRA_POINT';
        }
        
        $stmt = $this->pdo->prepare("
            UPDATE drives SET EndedBy = ? WHERE DriveID = ?
        ");
        $stmt->execute([$endedBy, $driveId]);
    }
    
    private function isScoringPlay($playData) {
        return ($playData['isTouchdown'] ?? false) ||
               ($playData['playType'] === 'KICK' && 
                in_array($playData['playSubtype'], ['FIELD_GOAL', 'EXTRA_POINT', 'SAFETY']));
    }
    
    private function updateGameScore($gameId, $playData) {
        $points = 0;
        
        if ($playData['isTouchdown'] ?? false) {
            $points = 6;
        } elseif ($playData['playType'] === 'KICK') {
            if ($playData['playSubtype'] === 'FIELD_GOAL') {
                $points = 3;
            } elseif ($playData['playSubtype'] === 'EXTRA_POINT') {
                $points = 1;
            } elseif ($playData['playSubtype'] === 'SAFETY') {
                $points = 2;
            }
        }
        
        if ($points > 0) {
            $scoreField = ($playData['scoringTeam'] === 'HOME') ? 'HomeScore' : 'VisitorScore';
            
            $stmt = $this->pdo->prepare("
                UPDATE games SET {$scoreField} = {$scoreField} + ? WHERE GameID = ?
            ");
            $stmt->execute([$points, $gameId]);
        }
    }
    
    private function endAllActiveDrives($gameId) {
        $stmt = $this->pdo->prepare("
            UPDATE drives SET EndedBy = 'GAME_END' 
            WHERE GameID = ? AND EndedBy IS NULL
        ");
        $stmt->execute([$gameId]);
    }
    
    private function updateGameStatus($gameId, $status) {
        $stmt = $this->pdo->prepare("
            UPDATE game_state SET GameStatus = ? WHERE GameID = ?
        ");
        $stmt->execute([$status, $gameId]);
    }
    
    private function calculateResultingYardLine($currentPosition, $yardsGained) {
        $currentRelative = YardLineConverter::stringToRelative($currentPosition);
        $newRelative = $currentRelative + $yardsGained;
        
        // Ensure yard line stays within bounds
        $newRelative = max(0, min(100, $newRelative));
        
        return YardLineConverter::relativeToString($newRelative);
    }
}

// ============================================================================
// API ENDPOINT ROUTER
// ============================================================================

// Initialize API
try {
    // Database connection (adjust credentials as needed)
    $pdo = new PDO("mysql:host=localhost;dbname=strata_football", "root", "", [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    $api = new StrataFootballAPI($pdo);
    
    // Route based on request
    $requestUri = $_SERVER['REQUEST_URI'];
    $requestMethod = $_SERVER['REQUEST_METHOD'];
    
    header('Content-Type: application/json');
    
    if (strpos($requestUri, '/api/get_games.php') !== false && $requestMethod === 'GET') {
        echo json_encode(['success' => true, 'games' => $api->getGames()]);
        
    } elseif (strpos($requestUri, '/api/start_scoring.php') !== false && $requestMethod === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $gameId = $input['GameID'] ?? $_POST['GameID'] ?? null;
        if ($gameId) {
            echo json_encode($api->startScoring($gameId));
        } else {
            echo json_encode(['success' => false, 'error' => 'GameID required']);
        }
        
    } elseif (strpos($requestUri, '/api/load_game_state.php') !== false && $requestMethod === 'GET') {
        $gameId = $_GET['GameID'] ?? null;
        if ($gameId) {
            echo json_encode($api->loadGameState($gameId));
        } else {
            echo json_encode(['success' => false, 'error' => 'GameID required']);
        }
        
    } elseif (strpos($requestUri, '/api/submit_play.php') !== false && $requestMethod === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $gameId = $input['GameID'] ?? null;
        if ($gameId && isset($input['playData'])) {
            echo json_encode($api->submitPlay($gameId, $input['playData']));
        } else {
            echo json_encode(['success' => false, 'error' => 'GameID and playData required']);
        }
        
    } elseif (strpos($requestUri, '/api/end_scoring.php') !== false && $requestMethod === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $gameId = $input['GameID'] ?? $_POST['GameID'] ?? null;
        if ($gameId) {
            echo json_encode($api->endScoring($gameId));
        } else {
            echo json_encode(['success' => false, 'error' => 'GameID required']);
        }
        
    } else {
        echo json_encode(['success' => false, 'error' => 'Unknown API endpoint']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>
