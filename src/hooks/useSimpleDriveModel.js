import * as React from 'react';
import { buildSimpleDriveModel } from '../utils/simpleDriveModel';

export function useSimpleDriveModel(gameState) {
  const gameId = gameState?.game_info?.game_id || 1000;
  const [driveModel, setDriveModel] = React.useState(null);
  const [loading, setLoading] = React.useState(!!gameId);
  const [error, setError] = React.useState(null);

  const toMMSS = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2,'0')}`;
  };

  const elapsedSinceStart = (startPeriod, startTime, livePeriod, liveClock, secsPerPeriod = 900) => {
    // startTime and liveClock are "time remaining" in their periods
    if (livePeriod < startPeriod) return 0; // guard
    if (livePeriod === startPeriod) {
      return Math.max(0, (startTime ?? 0) - (liveClock ?? 0));
    }
    const startElapsed   = Math.max(0, startTime ?? 0);               // from startTime down to 0
    const betweenPeriods = Math.max(0, (livePeriod - startPeriod - 1)) * secsPerPeriod;
    const currentElapsed = Math.max(0, secsPerPeriod - (liveClock ?? 0));
    return startElapsed + betweenPeriods + currentElapsed;
  };

  React.useEffect(() => {
    if (!gameId) return;
    setLoading(true); setError(null);
    (async () => {
      try {
        // Fetch active drive
        const res = await fetch(`/strata_football/api/get_active_drive.php?game_id=${encodeURIComponent(gameId)}`, { credentials: 'include' });
        const j = await res.json();
        const drive = j?.active_drive; // { DriveID, DriveNumber, PossessionTeam, StartPeriod, StartTime, StartYardLinePosition, TotalPlays, TotalYards, TimeOfPossession, DriveStart, IsActive }
        if (!j?.success || !drive) throw new Error(j?.error || 'No active drive');

        // Build base model
        const live  = gameState?.live_state || {};
        const plays = gameState?.plays || [];
        const model = buildSimpleDriveModel(live, drive, plays);

        // Fetch penalties from SQL by DriveID
        let penCount = 0, penYards = 0;
        try {
          const r2 = await fetch(`/strata_football/api/get_drive_penalties.php?drive_id=${encodeURIComponent(drive.DriveID)}`, { credentials: 'include' });
          const j2 = await r2.json();
          if (j2?.success && j2?.penalties) {
            penCount = Number(j2.penalties.count || 0);
            penYards = Number(j2.penalties.yards || 0);
          }
        } catch (penError) {
          console.warn('[DriveSummary] Failed to fetch penalties:', penError);
        }

        // ---- Yards gained so far ----
        // Prefer server's TotalYards if it's kept current; fallback to summing plays for this drive.
        const driveId = Number(drive.DriveID);
        let yardsGained = Number.isFinite(Number(drive.TotalYards)) ? Number(drive.TotalYards) : 0;
        if (!yardsGained && Array.isArray(plays) && plays.length) {
          const drivePlays = plays.filter(p => Number(p.DriveID) === driveId);
          yardsGained = drivePlays.reduce((sum, p) => {
            const type = String(p.PlayType || p.play_type || '').toUpperCase();
            const neg  = (p.isNegated ?? p.IsNegated ?? 0) == 1;
            if (type === 'PENALTY' || neg) return sum;
            const ny = Number(p.NetYards ?? p.net_yards ?? p.YardsGained ?? 0);
            return sum + (Number.isFinite(ny) ? ny : 0);
          }, 0);
        }

        // ---- Time calculations ----
        const isActive     = !!(drive.IsActive);
        const startPeriod  = Number(drive.StartPeriod ?? 1);
        const startTime    = Number(drive.StartTime   ?? 900); // time remaining at start
        const livePeriod   = Number(live.period ?? startPeriod);
        const liveClockRem = Number(live.clockRemainingSec ?? live.clock_remaining ?? live.clock ?? startTime);
        const elapsedSec = isActive
          ? elapsedSinceStart(startPeriod, startTime, livePeriod, liveClockRem, 900)
          : Number(drive.TimeOfPossession ?? 0);

        // ---- Plays breakdown & total ----
        const rush = Number(model.playsRush ?? model.rushCount ?? 0);
        const pass = Number(model.playsPass ?? model.passCount ?? 0);
        const totalPlays = Number.isFinite(Number(drive.TotalPlays))
          ? Number(drive.TotalPlays)
          : (rush + pass);

        // Merge all data into the final model
        setDriveModel({
          ...model,
          penCount, penYards,
          possessionLabel: String(drive.PossessionTeam).toUpperCase() === 'HOME' ? 'Home' : 'Visitor',
          driveNumber: Number(drive.DriveNumber ?? model.driveNumber ?? 0),
          startSpot: drive.StartYardLinePosition ?? model.startSpot ?? model.start,
          howGained: drive.DriveStart ?? model.howGained,
          yardsGained,
          
          // NEW FIELDS for Start Time and TOP
          startTimeText: toMMSS(startTime),   // 15:00 at kickoff
          topElapsedText: toMMSS(elapsedSec),  // grows while drive is active
          
          playsRush: rush,
          playsPass: pass,
          totalPlays,
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [gameId, !!gameState?.live_state, !!gameState?.plays]);

  // DEBUG: see it in console
  React.useEffect(() => {
    console.log('[DriveSummary] model=', driveModel, 'loading=', loading, 'error=', error);
  }, [driveModel, loading, error]);

  return { driveModel, loading, error };
}

export default useSimpleDriveModel;