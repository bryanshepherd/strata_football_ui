// src/utils/driveModel.ts
import { toPossessionRelative } from './DownDistanceCalculator';

type Side = 'H'|'V';
type YardCode = string;

export type DriveModel = {
  offense: Side;
  number?: number;
  start: YardCode;
  current: YardCode;
  down?: number;
  distance?: number;
  yardsSoFar: number;
  events: { t:'fd'|'flag'|'score'; atPct:number }[];
  breakdown?: {
    rush: number;
    pass: number;
    pen: number;
    fdRush: number;
    fdPass: number;
    fdPen: number;
  };
};

export function buildDriveModel(gameState: any, activeDrive: any, plays: any[]): DriveModel|null {
  if (!gameState?.Possession || !gameState?.YardLinePosition || !activeDrive) return null;

  const offense: Side = gameState.Possession === 'HOME' ? 'H' : 'V';
  const start: YardCode   = activeDrive.StartYardLinePosition ?? gameState.YardLinePosition;
  const current: YardCode = gameState.YardLinePosition;

  // progress % is already offense-relative 0..100 per your DDC
  const pct = (pos: YardCode) => Math.max(0, Math.min(100, toPossessionRelative(pos, offense)));

  // yards so far (use drives.TotalYards if populated; else sum plays)
  const yardsSoFar = Number(activeDrive.TotalYards ?? 0) || plays
    .filter(p => p.drive_id === activeDrive.DriveID)
    .reduce((acc, p) => acc + Number(p.net_yards ?? p.yards ?? 0), 0);

  const events = (plays || [])
    .filter(p => p.drive_id === activeDrive.DriveID)
    .map(p => {
      const at = pct(p.end_yard_line ?? p.post_yard_line ?? p.start_yard_line ?? current);
      if (p.is_touchdown || p.is_field_goal || p.is_safety) return { t:'score' as const, atPct: at };
      if (p.is_first_down) return { t:'fd' as const, atPct: at };
      if (p.has_penalty || (p.penalties?.length)) return { t:'flag' as const, atPct: at };
      return null;
    })
    .filter(Boolean) as {t:'fd'|'flag'|'score'; atPct:number}[];

  // Calculate breakdown stats
  const drivePlays = plays.filter(p => p.drive_id === activeDrive.DriveID);
  const breakdown = drivePlays.reduce((h, p) => {
    const net = Number(p.net_yards ?? p.yards ?? 0);
    const isPass = (p.play_type||'').toLowerCase().includes('pass');
    const isPen  = !!p.has_penalty || (p.penalties?.length > 0);
    if (isPen) h.pen += net; else if (isPass) h.pass += net; else h.rush += net;
    if (p.is_first_down) isPen ? h.fdPen++ : isPass ? h.fdPass++ : h.fdRush++;
    return h;
  }, {rush:0, pass:0, pen:0, fdRush:0, fdPass:0, fdPen:0});

  return {
    offense,
    number: activeDrive.DriveNumber,
    start,
    current,
    down: gameState.CurrentDown ?? undefined,
    distance: gameState.YardsToGo ?? undefined,
    yardsSoFar,
    events,
    breakdown
  };
}