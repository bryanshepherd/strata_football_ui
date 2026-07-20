
-- Migration: Continued Plays + Penalty Phase (drop Fumble2/3) 
-- Generated: 2025-08-28 03:06:09
-- Target: MySQL 8.0+
-- Notes:
--  - Drops the Fumble2/Fumble3 columns you listed.
--  - Adds continued-play chaining columns on plays.
--  - Adds penalty phase columns and root linkage on penalties.
--  - Adds helpful indexes and FKs.
--  - Review on staging first; take a backup.

USE strata_football;

-- ===============================
-- 1) Drop obsolete Fumble2/3 columns (safe if they exist)
-- ===============================
ALTER TABLE plays
  DROP COLUMN IF EXISTS Fumble2PlayerID,
  DROP COLUMN IF EXISTS Fumble2RecoveredBy,
  DROP COLUMN IF EXISTS Fumble2RecoveredByPlayerID,
  DROP COLUMN IF EXISTS Fumble2YardLine,
  DROP COLUMN IF EXISTS Fumble3PlayerID,
  DROP COLUMN IF EXISTS Fumble3RecoveredBy,
  DROP COLUMN IF EXISTS Fumble3RecoveredByPlayerID,
  DROP COLUMN IF EXISTS Fumble3YardLine;

-- ===============================
-- 2) Add continued-play chain columns on plays
-- ===============================
ALTER TABLE plays
  ADD COLUMN IF NOT EXISTS IsContinued TINYINT(1) NOT NULL DEFAULT 0 AFTER IsNegated,
  ADD COLUMN IF NOT EXISTS ContinuedFrom INT NULL AFTER IsContinued,
  ADD COLUMN IF NOT EXISTS ContinuedTo   INT NULL AFTER ContinuedFrom,
  ADD COLUMN IF NOT EXISTS RootPlayID    INT NULL AFTER ContinuedTo;

-- FKs for chain & root
ALTER TABLE plays
  ADD CONSTRAINT IF NOT EXISTS fk_plays_continued_from FOREIGN KEY (ContinuedFrom) REFERENCES plays(PlayID) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS fk_plays_continued_to   FOREIGN KEY (ContinuedTo)   REFERENCES plays(PlayID) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS fk_plays_root           FOREIGN KEY (RootPlayID)    REFERENCES plays(PlayID) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_plays_cont_from ON plays (ContinuedFrom);
CREATE INDEX IF NOT EXISTS idx_plays_cont_to   ON plays (ContinuedTo);
CREATE INDEX IF NOT EXISTS idx_plays_root      ON plays (RootPlayID);

-- ===============================
-- 3) Penalties: add root & phase
-- ===============================
ALTER TABLE penalties
  ADD COLUMN IF NOT EXISTS RootPlayID INT NULL AFTER PlayID,
  ADD COLUMN IF NOT EXISTS PenaltyPhase ENUM('PRE_COP','POST_COP') NULL AFTER RootPlayID;

ALTER TABLE penalties
  ADD CONSTRAINT IF NOT EXISTS fk_pen_root FOREIGN KEY (RootPlayID) REFERENCES plays(PlayID) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pen_root_phase ON penalties (RootPlayID, PenaltyPhase);

-- ===============================
-- 4) (Optional) Triggers to keep IsContinued coherent
-- ===============================
DROP TRIGGER IF EXISTS trg_plays_cont_flags_bi;
DELIMITER $$
CREATE TRIGGER trg_plays_cont_flags_bi
BEFORE INSERT ON plays
FOR EACH ROW
BEGIN
  IF NEW.ContinuedFrom IS NOT NULL OR NEW.ContinuedTo IS NOT NULL THEN
    SET NEW.IsContinued = 1;
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_plays_cont_flags_bu;
DELIMITER $$
CREATE TRIGGER trg_plays_cont_flags_bu
BEFORE UPDATE ON plays
FOR EACH ROW
BEGIN
  IF NEW.ContinuedFrom IS NOT NULL OR NEW.ContinuedTo IS NOT NULL THEN
    SET NEW.IsContinued = 1;
  ELSE
    SET NEW.IsContinued = 0;
  END IF;
END$$
DELIMITER ;

-- ===============================
-- 5) Helper view: roll up continued chains (root-based)
-- ===============================
DROP VIEW IF EXISTS v_play_chains;
CREATE VIEW v_play_chains AS
WITH RECURSIVE chain(root_id, play_id, seq) AS (
  SELECT p.PlayID AS root_id, p.PlayID, 1
    FROM plays p
   WHERE p.ContinuedFrom IS NULL
  UNION ALL
  SELECT c.root_id, p2.PlayID, c.seq + 1
    FROM chain c
    JOIN plays p2 ON p2.ContinuedFrom = c.play_id
)
SELECT
  c.root_id                       AS RootPlayID,
  COUNT(*)                        AS Segments,
  SUM(p.NetYards)                 AS TotalNetYards,
  MAX(p.IsTouchdown)              AS AnyTouchdown,
  MAX(p.IsSafety)                 AS AnySafety,
  MAX(p.IsTurnover)               AS AnyTurnover,
  MIN(p.GameID)                   AS GameID,
  MIN(p.DriveID)                  AS DriveID
FROM chain c
JOIN plays p ON p.PlayID = c.play_id
GROUP BY c.root_id;

-- END
