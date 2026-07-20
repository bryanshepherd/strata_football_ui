// src/utils/simpleDriveModel.ts
export type SimpleDriveModel = {
  offense: 'H'|'V';
  number?: number;
  start: string;
  howGained?: string;
  timeGainedSec: number;
  playsRush: number;
  playsPass: number;
  penCount: number;
  penYards: number;
};

export function fmtMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function prettyHow(raw?: string): string | undefined {
  if (!raw) return undefined;
  const key = String(raw).toUpperCase();
  const map: Record<string,string> = {
    KICKOFF:'Kickoff', DOWNS:'After Turnover on Downs', PUNT:'Punt',
    FUMBLE:'Fumble', INTERCEPTION:'Interception', SAFETY:'Safety Kick'
  };
  return map[key] || key.charAt(0)+key.slice(1).toLowerCase();
}

/** Build the minimal drive model */
export function buildSimpleDriveModel(live: any, drive: any, plays: any[] = []): SimpleDriveModel | null {
  if (!live || !drive) return null;
  const offense: 'H'|'V' = (live.Possession === 'HOME' ? 'H' : 'V');
  const start = drive.StartYardLinePosition || live.YardLinePosition || '50';
  const number = drive.DriveNumber ?? undefined;
  const timeGainedSec = Number(drive.TimeOfPossession ?? 0);
  const howGained = prettyHow(drive.DriveStart);

  const driveId = drive.DriveID;
  const inDrive = (p:any) => driveId ? p.drive_id === driveId : true;
  const list = Array.isArray(plays) ? plays.filter(inDrive) : [];

  let playsRush = 0, playsPass = 0, penCount = 0, penYards = 0;
  for (const p of list) {
    const t = String(p.play_type || '').toLowerCase();
    if (t.includes('pass')) playsPass++; else if (t.includes('rush') || t.includes('run')) playsRush++;
    const allPens = Array.isArray(p.penalties) ? p.penalties : (p.has_penalty ? [{ yards: p.penalty_yards||0 }] : []);
    for (const pen of allPens) { penCount++; penYards += Number(pen.yards ?? 0); }
  }

  return { offense, number, start, howGained, timeGainedSec, playsRush, playsPass, penCount, penYards };
}