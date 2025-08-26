-- STRATA FOOTBALL NORMALIZED DATABASE SCHEMA
-- Replaces JSON fields with proper relational structure
-- Compatible with PHP 7.4 and MySQL 8.x
-- Date: August 17, 2025
-- UPDATED: Reflects current database structure as of 2025-08-17

-- ================================================
-- GAME STATE TABLE (Replaces JSON GameState)
-- ================================================
CREATE TABLE game_state (
    GameID int(11) PRIMARY KEY,
    
    -- Clock & Period
    Period tinyint(4) NOT NULL DEFAULT 1,
    TimeRemaining int(11) NOT NULL DEFAULT 900, -- Seconds (15:00 = 900)
    
    -- Down & Distance
    CurrentDown tinyint(4) NOT NULL DEFAULT 1,
    YardsToGo tinyint(4) NOT NULL DEFAULT 10,
    YardLinePosition varchar(10) NOT NULL DEFAULT 'H25', -- Format: H25, V35, H50 (50 yard line)
    LineToGain varchar(3) NULL, -- Goal line or yard line to reach
    
    -- Possession & Situation
    Possession enum('HOME','VISITOR') NOT NULL DEFAULT 'HOME',
    IsGoalToGo tinyint(1) NOT NULL DEFAULT 0,
    IsRedZone tinyint(1) NOT NULL DEFAULT 0,
    
    -- Timeouts & Challenges
    HomeTimeouts tinyint(4) NOT NULL DEFAULT 3,
    VisitorTimeouts tinyint(4) NOT NULL DEFAULT 3,
    HomeChallenges tinyint(4) NULL, -- NULL for games where challenges don't apply
    VisitorChallenges tinyint(4) NULL, -- NULL for games where challenges don't apply
    
    -- Game Status
    GameStatus enum('Pregame','In Progress','Delayed','Halftime','Suspended','Overtime','Final') DEFAULT 'Pregame',
    
    -- Game Locking (Prevents concurrent scoring)
    LockedBy int(11) NULL, -- UserID of current scorer
    LockedAt timestamp NULL, -- When the lock was acquired
    LockHeartbeat timestamp NULL, -- Last activity timestamp for timeout detection
    
    -- Tracking
    LastUpdated timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UpdatedBy int(11) NULL,
    
    -- Score Tracking
    HomeScore int(11) NOT NULL DEFAULT 0,
    VisitorScore int(11) NOT NULL DEFAULT 0,
    
    -- Coin Toss Details
    CoinTossWinner varchar(1) NULL, -- 'H' or 'V'
    WinnerDeferred tinyint(1) DEFAULT 0, -- Whether winner deferred choice to 2nd half
    FirstHalfWinnerChoice varchar(1) NULL, -- 'K' (kick), 'R' (receive), 'D' (defer)
    FirstHalfWinnerDirection varchar(1) NULL, -- Direction chosen if applicable
    FirstHalfLoserChoice varchar(1) NULL, -- Loser's choice
    FirstHalfLoserDirection varchar(1) NULL,
    SecondHalfWinnerChoice varchar(1) NULL, -- Winner's choice for 2nd half
    SecondHalfWinnerDirection varchar(1) NULL,
    SecondHalfLoserChoice varchar(1) NULL,
    SecondHalfLoserDirection varchar(1) NULL,
    CoinTossCompleted tinyint(1) DEFAULT 0, -- Whether coin toss is complete
    
    FOREIGN KEY (GameID) REFERENCES games(GameID) ON DELETE CASCADE,
    FOREIGN KEY (UpdatedBy) REFERENCES users(UserID),
    FOREIGN KEY (LockedBy) REFERENCES users(UserID),
    
    INDEX idx_game_status (GameStatus),
    INDEX idx_possession (Possession),
    INDEX idx_period (Period),
    INDEX idx_locked_by (LockedBy),
    INDEX idx_lock_heartbeat (LockHeartbeat)
);

-- ================================================
-- DRIVES TABLE (Replaces JSON DriveChart)
-- ================================================
CREATE TABLE drives (
    DriveID int(11) PRIMARY KEY AUTO_INCREMENT,
    GameID int(11) NOT NULL,
    DriveNumber tinyint(4) NOT NULL,
    
    -- Drive Details
    PossessionTeam enum('HOME','VISITOR') NOT NULL,
    StartPeriod tinyint(4) NOT NULL,
    StartTime int(11) NOT NULL, -- Seconds remaining when drive started
    StartPlayNo int(11) NULL, -- PlayID of first play in drive
    EndPeriod tinyint(4) NULL,
    EndTime int(11) NULL,
    EndPlayNo int(11) NULL, -- PlayID of last play in drive
    
    -- Field Position (using string format H25, V35, etc.)
    StartYardLinePosition varchar(10) NOT NULL, -- Format: H25, V35, H50
    EndYardLinePosition varchar(10) NULL, -- Format: H25, V35, H50
    
    -- Drive Stats
    TotalPlays tinyint(4) NOT NULL DEFAULT 0,
    TotalYards smallint(6) NOT NULL DEFAULT 0, -- Net yards including penalties
    TimeOfPossession int(11) NOT NULL DEFAULT 0, -- Seconds
    
    -- Drive Result
    DriveResult enum('TOUCHDOWN','FIELD_GOAL','PUNT','FUMBLE','INTERCEPTION','TURNOVER_ON_DOWNS','END_OF_HALF','END_OF_GAME','SAFETY') NULL,
    PointsScored tinyint(4) NOT NULL DEFAULT 0,
    
    -- Tracking
    IsActive tinyint(1) NOT NULL DEFAULT 1,
    CreatedAt timestamp DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (GameID) REFERENCES games(GameID) ON DELETE CASCADE,
    
    INDEX idx_game_drive (GameID, DriveNumber),
    INDEX idx_active_drive (GameID, IsActive),
    INDEX idx_possession (PossessionTeam)
);

-- ================================================
-- PLAYS TABLE (Replaces JSON PlayLog)
-- ================================================
CREATE TABLE plays (
    PlayID int(11) PRIMARY KEY AUTO_INCREMENT,
    GameID int(11) NOT NULL,
    DriveID int(11) NULL, -- NULL for game control events that aren't part of drives
    PlayNumber int(11) NOT NULL,
    
    -- Game Situation
    Period tinyint(4) NOT NULL,
    TimeRemaining int(11) NOT NULL, -- Seconds
    
    -- Down & Distance (Pre-Play)
    Down tinyint(4) NOT NULL,
    YardsToGo tinyint(4) NOT NULL,
    YardLinePosition varchar(10) NOT NULL, -- Format: H25, V35, H50
    
    -- Post-Play Situation (What the play result says it should be)
    PostDown tinyint(4) NULL, -- Down after this play
    PostDistance tinyint(4) NULL, -- Distance after this play
    PostYardLinePosition varchar(10) NULL, -- Position after this play
    
    -- Play Details
    PossessionTeam enum('HOME','VISITOR') NOT NULL,
    PlayType enum('RUSH','PASS','PUNT','KICK','PENALTY','GAME_CONTROL') NOT NULL,
    PlaySubType varchar(50) NULL, -- For GAME_CONTROL: 'DRIVE_START', 'DRIVE_END', 'TIMEOUT', 'END_OF_PERIOD', etc.
    Formation varchar(50) NULL,
    
    -- Primary Players
    PrimaryPlayerID int(11) NULL, -- QB for pass, RB for rush, etc.
    SecondaryPlayerID int(11) NULL, -- Receiver, target, etc.
    
    -- Play Result
    PlayResult enum('TACKLE','OUT_OF_BOUNDS','COMPLETE','INCOMPLETE','TOUCHDOWN','FIRST_DOWN','NO_GAIN','LOSS','FUMBLE','INTERCEPTION','SACK','SAFETY','BLOCK','GOOD','MISS','TIMEOUT','END_PERIOD','END_OF_PLAY') NULL,
    YardsGained smallint(6) NOT NULL DEFAULT 0,
    NetYards smallint(6) NOT NULL DEFAULT 0, -- After penalties
    
    -- Final Position (actual result)
    EndYardLinePosition varchar(10) NULL, -- Format: H25, V35, H50
    
    -- Flags
    IsFirstDown tinyint(1) NOT NULL DEFAULT 0,
    IsTouchdown tinyint(1) NOT NULL DEFAULT 0,
    IsTurnover tinyint(1) NOT NULL DEFAULT 0,
    IsSafety tinyint(1) NOT NULL DEFAULT 0,
    HasPenalty tinyint(1) NOT NULL DEFAULT 0,
    HasFumble tinyint(1) NOT NULL DEFAULT 0,
    
    -- Fumble Details (up to 3 fumbles per play)
    Fumble1PlayerID int(11) NULL, -- Who fumbled
    Fumble1RecoveredBy enum('HOME','VISITOR','OUT_OF_BOUNDS') NULL,
    Fumble1RecoveredByPlayerID int(11) NULL, -- Who recovered
    Fumble1YardLine varchar(10) NULL, -- Where fumble occurred
    
    Fumble2PlayerID int(11) NULL,
    Fumble2RecoveredBy enum('HOME','VISITOR','OUT_OF_BOUNDS') NULL,
    Fumble2RecoveredByPlayerID int(11) NULL,
    Fumble2YardLine varchar(10) NULL,
    
    Fumble3PlayerID int(11) NULL,
    Fumble3RecoveredBy enum('HOME','VISITOR','OUT_OF_BOUNDS') NULL,
    Fumble3RecoveredByPlayerID int(11) NULL,
    Fumble3YardLine varchar(10) NULL,
    
    -- Situational Flags (Added fields from actual database)
    is3rdDown tinyint(1) NULL, -- Whether this was a 3rd down play
    is4thDown tinyint(1) NULL, -- Whether this was a 4th down play
    isNegated tinyint(1) NOT NULL DEFAULT 0, -- Whether this play was negated by penalty
    
    -- Description & Raw Data
    PlayDescription text NOT NULL,
    RawData text NULL, -- Original raw input data for debugging
    
    -- Tracking
    CreatedAt timestamp DEFAULT CURRENT_TIMESTAMP,
    CreatedBy int(11) NULL,
    
    FOREIGN KEY (GameID) REFERENCES games(GameID) ON DELETE CASCADE,
    FOREIGN KEY (DriveID) REFERENCES drives(DriveID) ON DELETE CASCADE,
    FOREIGN KEY (PrimaryPlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (SecondaryPlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (Fumble1PlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (Fumble1RecoveredByPlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (Fumble2PlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (Fumble2RecoveredByPlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (Fumble3PlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (Fumble3RecoveredByPlayerID) REFERENCES players(PlayerID),
    FOREIGN KEY (CreatedBy) REFERENCES users(UserID),
    
    INDEX idx_game_play (GameID, PlayNumber),
    INDEX idx_drive_play (DriveID, PlayNumber),
    INDEX idx_play_type (PlayType),
    INDEX idx_play_subtype (PlaySubType),
    INDEX idx_period (Period, TimeRemaining)
);

-- ================================================
-- PLAY PARTICIPANTS TABLE (Defense, Special Teams)
-- ================================================
CREATE TABLE play_participants (
    ParticipantID int(11) PRIMARY KEY AUTO_INCREMENT,
    PlayID int(11) NOT NULL,
    PlayerID int(11) NOT NULL,
    
    -- Participation Type
    ParticipationType enum('TACKLER','ASSIST_TACKLER','PASS_DEFENSE','PRESSURE','FUMBLE_RECOVERY','FUMBLE_FORCE','INTERCEPTION','BLOCK','RETURN') NOT NULL,
    
    -- Details
    IsTFL tinyint(1) NOT NULL, -- Tackle for Loss flag
    IsPrimary tinyint(1) NOT NULL DEFAULT 0, -- Primary tackler, etc.
    YardsGained smallint(6) NOT NULL DEFAULT 0, -- For returns
    
    FOREIGN KEY (PlayID) REFERENCES plays(PlayID) ON DELETE CASCADE,
    FOREIGN KEY (PlayerID) REFERENCES players(PlayerID),
    
    INDEX idx_play_participants (PlayID),
    INDEX idx_player_stats (PlayerID, ParticipationType)
);

-- ================================================
-- PENALTIES TABLE
-- ================================================
CREATE TABLE penalties (
    PenaltyID int(11) PRIMARY KEY AUTO_INCREMENT,
    PlayID int(11) NOT NULL,
    
    -- Penalty Details
    PenaltyType varchar(50) NOT NULL, -- "False Start", "Holding", etc.
    PenaltyYards tinyint(4) NOT NULL,
    PenaltyTeam enum('HOME','VISITOR') NOT NULL,
    PlayerID int(11) NULL,
    
    -- Multiple Penalties & Offsetting
    PenaltySequence tinyint(4) NOT NULL DEFAULT 1, -- 1st, 2nd, 3rd penalty on same play
    IsOffsetting tinyint(1) NOT NULL DEFAULT 0, -- Part of offsetting penalties
    OffsettingGroup tinyint(4) NULL, -- Group ID for offsetting penalties
    
    -- Enforcement
    IsAccepted tinyint(1) NOT NULL DEFAULT 1,
    IsAutomaticFirstDown tinyint(1) NOT NULL DEFAULT 0,
    IsSafety tinyint(1) NOT NULL DEFAULT 0,
    IsEjection tinyint(1) NOT NULL DEFAULT 0,
    IsDeclined tinyint(1) NOT NULL DEFAULT 0,
    
    -- Spot
    EnforcementSpot varchar(50) NULL, -- "Previous spot", "End of run", etc.
    EnforcementYardLine varchar(10) NULL, -- Where penalty was enforced from
    
    FOREIGN KEY (PlayID) REFERENCES plays(PlayID) ON DELETE CASCADE,
    FOREIGN KEY (PlayerID) REFERENCES players(PlayerID),
    
    INDEX idx_play_penalty (PlayID),
    INDEX idx_penalty_type (PenaltyType),
    INDEX idx_offsetting (PlayID, IsOffsetting, OffsettingGroup)
);

-- ================================================
-- PENALTY CHART TABLE (Rule Definitions)
-- ================================================
CREATE TABLE penalty_chart (
    PenaltyName varchar(30) NOT NULL,
    PenaltyCode varchar(3) NOT NULL,
    YardsNCAA int(11) NOT NULL,
    DownNCAA enum('NORM','AUTO','LOSS') NOT NULL,
    YardsHS int(11) NOT NULL,
    DownHS enum('NORM','LOSS','AUTO') NOT NULL,
    
    PRIMARY KEY (PenaltyName),
    INDEX idx_penalty_code (PenaltyCode)
);

-- ================================================
-- GAME STATISTICS TABLE (Replaces JSON Stats)
-- ================================================
CREATE TABLE game_statistics (
    StatID int(11) PRIMARY KEY AUTO_INCREMENT,
    GameID int(11) NOT NULL,
    PlayerID int(11) NOT NULL,
    
    -- Rushing Stats
    RushAttempts tinyint(4) NOT NULL DEFAULT 0,
    RushYards smallint(6) NOT NULL DEFAULT 0,
    RushTouchdowns tinyint(4) NOT NULL DEFAULT 0,
    RushLong tinyint(4) NOT NULL DEFAULT 0,
    RushFumbles tinyint(4) NOT NULL DEFAULT 0,
    
    -- Passing Stats
    PassAttempts tinyint(4) NOT NULL DEFAULT 0,
    PassCompletions tinyint(4) NOT NULL DEFAULT 0,
    PassYards smallint(6) NOT NULL DEFAULT 0,
    PassTouchdowns tinyint(4) NOT NULL DEFAULT 0,
    PassInterceptions tinyint(4) NOT NULL DEFAULT 0,
    PassLong tinyint(4) NOT NULL DEFAULT 0,
    PassSacks tinyint(4) NOT NULL DEFAULT 0,
    PassSackYards smallint(6) NOT NULL DEFAULT 0,
    
    -- Receiving Stats
    Receptions tinyint(4) NOT NULL DEFAULT 0,
    ReceivingYards smallint(6) NOT NULL DEFAULT 0,
    ReceivingTouchdowns tinyint(4) NOT NULL DEFAULT 0,
    ReceivingLong tinyint(4) NOT NULL DEFAULT 0,
    ReceivingFumbles tinyint(4) NOT NULL DEFAULT 0,
    
    -- Defensive Stats
    Tackles tinyint(4) NOT NULL DEFAULT 0,
    TacklesAssist tinyint(4) NOT NULL DEFAULT 0,
    TacklesLoss tinyint(4) NOT NULL DEFAULT 0,
    Sacks decimal(3,1) NOT NULL DEFAULT 0.0,
    SackYards smallint(6) NOT NULL DEFAULT 0,
    Interceptions tinyint(4) NOT NULL DEFAULT 0,
    InterceptionYards smallint(6) NOT NULL DEFAULT 0,
    InterceptionTouchdowns tinyint(4) NOT NULL DEFAULT 0,
    PassDefense tinyint(4) NOT NULL DEFAULT 0,
    FumblesRecovered tinyint(4) NOT NULL DEFAULT 0,
    FumblesForced tinyint(4) NOT NULL DEFAULT 0,
    
    -- Special Teams
    KickoffReturns tinyint(4) NOT NULL DEFAULT 0,
    KickoffReturnYards smallint(6) NOT NULL DEFAULT 0,
    KickoffReturnTouchdowns tinyint(4) NOT NULL DEFAULT 0,
    PuntReturns tinyint(4) NOT NULL DEFAULT 0,
    PuntReturnYards smallint(6) NOT NULL DEFAULT 0,
    PuntReturnTouchdowns tinyint(4) NOT NULL DEFAULT 0,
    
    -- Kicking
    FieldGoalAttempts tinyint(4) NOT NULL DEFAULT 0,
    FieldGoalsMade tinyint(4) NOT NULL DEFAULT 0,
    FieldGoalLong tinyint(4) NOT NULL DEFAULT 0,
    ExtraPointAttempts tinyint(4) NOT NULL DEFAULT 0,
    ExtraPointsMade tinyint(4) NOT NULL DEFAULT 0,
    
    -- Punting
    Punts tinyint(4) NOT NULL DEFAULT 0,
    PuntYards smallint(6) NOT NULL DEFAULT 0,
    PuntLong tinyint(4) NOT NULL DEFAULT 0,
    PuntInside20 tinyint(4) NOT NULL DEFAULT 0,
    
    -- Tracking
    LastUpdated timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (GameID) REFERENCES games(GameID) ON DELETE CASCADE,
    FOREIGN KEY (PlayerID) REFERENCES players(PlayerID),
    
    UNIQUE KEY unique_player_game (GameID, PlayerID),
    INDEX idx_game_stats (GameID)
);

-- ================================================
-- TEAM STATISTICS TABLE
-- ================================================
CREATE TABLE team_statistics (
    StatID int(11) PRIMARY KEY AUTO_INCREMENT,
    GameID int(11) NOT NULL,
    TeamSide enum('HOME','VISITOR') NOT NULL,
    
    -- Offensive Stats
    FirstDownsTotal tinyint(4) NOT NULL DEFAULT 0,
    FirstDownsRush tinyint(4) NOT NULL DEFAULT 0,
    FirstDownsPass tinyint(4) NOT NULL DEFAULT 0,
    FirstDownsPenalty tinyint(4) NOT NULL DEFAULT 0,
    
    TotalYards smallint(6) NOT NULL DEFAULT 0,
    RushingYards smallint(6) NOT NULL DEFAULT 0,
    PassingYards smallint(6) NOT NULL DEFAULT 0,
    
    RushAttempts tinyint(4) NOT NULL DEFAULT 0,
    PassAttempts tinyint(4) NOT NULL DEFAULT 0,
    PassCompletions tinyint(4) NOT NULL DEFAULT 0,
    
    -- Turnover Stats
    Fumbles tinyint(4) NOT NULL DEFAULT 0,
    FumblesLost tinyint(4) NOT NULL DEFAULT 0,
    Interceptions tinyint(4) NOT NULL DEFAULT 0,
    
    -- Penalty Stats
    Penalties tinyint(4) NOT NULL DEFAULT 0,
    PenaltyYards smallint(6) NOT NULL DEFAULT 0,
    
    -- Time of Possession (seconds)
    TimeOfPossession int(11) NOT NULL DEFAULT 0,
    
    -- Third Down Conversions
    ThirdDownAttempts tinyint(4) NOT NULL DEFAULT 0,
    ThirdDownConversions tinyint(4) NOT NULL DEFAULT 0,
    
    -- Fourth Down Conversions
    FourthDownAttempts tinyint(4) NOT NULL DEFAULT 0,
    FourthDownConversions tinyint(4) NOT NULL DEFAULT 0,
    
    -- Red Zone
    RedZoneAttempts tinyint(4) NOT NULL DEFAULT 0,
    RedZoneScores tinyint(4) NOT NULL DEFAULT 0,
    RedZoneTouchdowns tinyint(4) NOT NULL DEFAULT 0,
    
    -- Tracking
    LastUpdated timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (GameID) REFERENCES games(GameID) ON DELETE CASCADE,
    
    UNIQUE KEY unique_team_game (GameID, TeamSide),
    INDEX idx_game_team_stats (GameID)
);

-- ================================================
-- REMOVE JSON COLUMNS FROM EXISTING TABLES
-- ================================================
ALTER TABLE games 
DROP COLUMN DriveChart,
DROP COLUMN PlayLog,
DROP COLUMN Stats;

DROP TABLE IF EXISTS live_game_state;
