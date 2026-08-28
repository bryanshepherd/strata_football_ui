import type { TeamCode } from '../quick-input/footballIntentSchema';
import type { PlayerResolutionRosterPlayer } from '../quick-input/playerResolution';
import { normalizeFootballSpot } from '../utils/footballSpotNormalization';

export type FootballGamePhase = 'pregame' | 'awaitingKickoff' | 'live' | 'halftime' | 'final';
export type CoinTossChoice = 'kick' | 'receive' | 'side' | 'defer';
export type NonDeferCoinTossChoice = Exclude<CoinTossChoice, 'defer'>;
export type FieldDirection = 'north' | 'south' | 'east' | 'west';
export type StarterGroup = 'offense' | 'defense' | 'specialTeams';

export type CaptainSelection = { playerId: string; jerseyNumber: string };
export type CoinTossRecord = {
  status: 'notStarted' | 'inProgress' | 'complete';
  captains: Record<TeamCode, CaptainSelection[]>;
  winnerTeam: TeamCode | null;
  loserTeam: TeamCode | null;
  winnerInitialChoice: CoinTossChoice | null;
  loserChoice: NonDeferCoinTossChoice | null;
  winnerSecondaryChoice: Exclude<NonDeferCoinTossChoice, 'defer'> | null;
  direction: FieldDirection | null;
  directionChoiceTeam: TeamCode | null;
  firstHalfKickingTeam: TeamCode | null;
  firstHalfReceivingTeam: TeamCode | null;
  secondHalfChoiceTeam: TeamCode | null;
  completedAt: string | null;
};

export type FootballPregame = {
  gamePhase: FootballGamePhase;
  coinToss: CoinTossRecord;
  starters: Record<StarterGroup, Record<TeamCode, string[]>>;
};

export type TossInput = Pick<CoinTossRecord,
  'winnerTeam' | 'winnerInitialChoice' | 'loserChoice' | 'winnerSecondaryChoice' | 'direction'>;

export type TossResolution = Pick<CoinTossRecord,
  'loserTeam' | 'directionChoiceTeam' | 'firstHalfKickingTeam' | 'firstHalfReceivingTeam' | 'secondHalfChoiceTeam'>;

export type SecondHalfChoiceInput = {
  choice: NonDeferCoinTossChoice;
  otherTeamChoice?: Exclude<NonDeferCoinTossChoice, 'side'> | null;
  direction: FieldDirection;
};

export type SecondHalfInitialization = {
  choiceTeam: TeamCode;
  choice: NonDeferCoinTossChoice;
  otherTeamChoice: Exclude<NonDeferCoinTossChoice, 'side'> | null;
  direction: FieldDirection;
  directionChoiceTeam: TeamCode;
  kickingTeam: TeamCode;
  receivingTeam: TeamCode;
};

export type TossValidationResult = { ok: true } | { ok: false; errors: string[] };

export const STARTER_GROUPS: StarterGroup[] = ['offense', 'defense', 'specialTeams'];

export function otherTeam(team: TeamCode): TeamCode {
  return team === 'H' ? 'V' : 'H';
}

export function resolveSecondHalfInitialization(
  coinToss: CoinTossRecord,
  input: SecondHalfChoiceInput,
): SecondHalfInitialization | null {
  if (!coinToss) return null;
  const choiceTeam = coinToss.status === 'complete' ? coinToss.secondHalfChoiceTeam : null;
  if (!choiceTeam || !['kick', 'receive', 'side'].includes(input.choice) || !input.direction) return null;
  const opposingTeam = otherTeam(choiceTeam);

  if (input.choice === 'side') {
    if (input.otherTeamChoice !== 'kick' && input.otherTeamChoice !== 'receive') return null;
    return {
      choiceTeam,
      choice: input.choice,
      otherTeamChoice: input.otherTeamChoice,
      direction: input.direction,
      directionChoiceTeam: choiceTeam,
      kickingTeam: input.otherTeamChoice === 'kick' ? opposingTeam : choiceTeam,
      receivingTeam: input.otherTeamChoice === 'receive' ? opposingTeam : choiceTeam,
    };
  }

  return {
    choiceTeam,
    choice: input.choice,
    otherTeamChoice: null,
    direction: input.direction,
    directionChoiceTeam: opposingTeam,
    kickingTeam: input.choice === 'kick' ? choiceTeam : opposingTeam,
    receivingTeam: input.choice === 'receive' ? choiceTeam : opposingTeam,
  };
}

export function createCoinTossRecord(): CoinTossRecord {
  return {
    status: 'notStarted',
    captains: { H: [], V: [] },
    winnerTeam: null,
    loserTeam: null,
    winnerInitialChoice: null,
    loserChoice: null,
    winnerSecondaryChoice: null,
    direction: null,
    directionChoiceTeam: null,
    firstHalfKickingTeam: null,
    firstHalfReceivingTeam: null,
    secondHalfChoiceTeam: null,
    completedAt: null,
  };
}

export function createFootballPregame(): FootballPregame {
  return {
    gamePhase: 'pregame',
    coinToss: createCoinTossRecord(),
    starters: {
      offense: { H: [], V: [] },
      defense: { H: [], V: [] },
      specialTeams: { H: [], V: [] },
    },
  };
}

export function gamePhaseForEnvelope(envelope: any): FootballGamePhase {
  const explicit = envelope?.pregame?.gamePhase;
  if (explicit === 'pregame' || explicit === 'awaitingKickoff' || explicit === 'live' || explicit === 'halftime' || explicit === 'final') return explicit;
  if (envelope?.game?.status === 'halftime') return 'halftime';
  if (envelope?.game?.status === 'final') return 'final';
  if (envelope?.game?.status === 'inProgress') return 'live';
  return 'pregame';
}

export function pregameForEnvelope(envelope: any): FootballPregame {
  const base = createFootballPregame();
  const value = envelope?.pregame;
  if (!value || typeof value !== 'object') return { ...base, gamePhase: gamePhaseForEnvelope(envelope) };
  return {
    gamePhase: gamePhaseForEnvelope(envelope),
    coinToss: { ...base.coinToss, ...(value.coinToss || {}), captains: { ...base.coinToss.captains, ...(value.coinToss?.captains || {}) } },
    starters: STARTER_GROUPS.reduce((acc, group) => {
      acc[group] = { ...base.starters[group], ...(value.starters?.[group] || {}) };
      return acc;
    }, {} as FootballPregame['starters']),
  };
}

export function resolveToss(input: TossInput): TossResolution | null {
  const { winnerTeam: winner, winnerInitialChoice: initial, loserChoice, winnerSecondaryChoice, direction } = input;
  if (!winner || !initial) return null;
  const loser = otherTeam(winner);
  if (initial === 'kick') {
    if (!direction) return null;
    return { loserTeam: loser, firstHalfKickingTeam: winner, firstHalfReceivingTeam: loser, directionChoiceTeam: loser, secondHalfChoiceTeam: loser };
  }
  if (initial === 'receive') {
    if (!direction) return null;
    return { loserTeam: loser, firstHalfKickingTeam: loser, firstHalfReceivingTeam: winner, directionChoiceTeam: loser, secondHalfChoiceTeam: loser };
  }
  if (initial === 'side') {
    if (!direction || (loserChoice !== 'kick' && loserChoice !== 'receive')) return null;
    return { loserTeam: loser, firstHalfKickingTeam: loserChoice === 'kick' ? loser : winner, firstHalfReceivingTeam: loserChoice === 'receive' ? loser : winner, directionChoiceTeam: winner, secondHalfChoiceTeam: loser };
  }
  if (!loserChoice) return null;
  if (loserChoice === 'kick' || loserChoice === 'receive') {
    if (winnerSecondaryChoice !== 'side' || !direction) return null;
    return { loserTeam: loser, firstHalfKickingTeam: loserChoice === 'kick' ? loser : winner, firstHalfReceivingTeam: loserChoice === 'receive' ? loser : winner, directionChoiceTeam: winner, secondHalfChoiceTeam: winner };
  }
  if (loserChoice === 'side' && (winnerSecondaryChoice === 'kick' || winnerSecondaryChoice === 'receive') && direction) {
    return { loserTeam: loser, firstHalfKickingTeam: winnerSecondaryChoice === 'kick' ? winner : loser, firstHalfReceivingTeam: winnerSecondaryChoice === 'receive' ? winner : loser, directionChoiceTeam: loser, secondHalfChoiceTeam: winner };
  }
  return null;
}

export function nextTossChoices(record: CoinTossRecord): CoinTossChoice[] {
  if (!record.winnerTeam) return [];
  if (!record.winnerInitialChoice) return ['kick', 'receive', 'side', 'defer'];
  if (record.winnerInitialChoice === 'side') return record.loserChoice ? [] : ['kick', 'receive'];
  if (record.winnerInitialChoice === 'defer') {
    if (!record.loserChoice) return ['kick', 'receive', 'side'];
    if (record.loserChoice === 'side') return ['kick', 'receive'];
  }
  return [];
}

export function isSideImplicit(record: CoinTossRecord): boolean {
  return record.winnerInitialChoice === 'defer' && (record.loserChoice === 'kick' || record.loserChoice === 'receive');
}

export function resolveCompleteToss(record: CoinTossRecord, completedAt = new Date().toISOString()): CoinTossRecord {
  const resolved = resolveToss(record);
  if (!resolved) throw new Error('Coin toss is incomplete or contradictory.');
  const complete: CoinTossRecord = { ...record, ...resolved, status: 'complete', completedAt };
  const validation = validateCoinToss(complete);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  return complete;
}

export function validateCoinToss(record: CoinTossRecord, roster: readonly PlayerResolutionRosterPlayer[] = []): TossValidationResult {
  const errors: string[] = [];
  if (record.status !== 'complete') return { ok: false, errors: ['Coin toss is not complete.'] };
  const resolved = resolveToss(record);
  if (!resolved) errors.push('Coin toss choices do not form a legal completed branch.');
  if (!record.winnerTeam || record.loserTeam !== otherTeam(record.winnerTeam)) errors.push('Winner and loser must be opposite teams.');
  if (!record.firstHalfKickingTeam || !record.firstHalfReceivingTeam || record.firstHalfKickingTeam === record.firstHalfReceivingTeam) errors.push('First-half kicking and receiving teams must be opposite.');
  if (!record.direction || !record.directionChoiceTeam || !record.secondHalfChoiceTeam) errors.push('A direction, direction choice team, and second-half choice team are required.');
  if (record.winnerInitialChoice === 'defer' && !record.winnerSecondaryChoice) errors.push('A defer branch requires the winner secondary choice.');
  for (const team of ['H', 'V'] as TeamCode[]) {
    const seen = new Set<string>();
    for (const captain of record.captains[team] || []) {
      if (seen.has(captain.playerId)) errors.push(`Duplicate ${team} captain.`);
      seen.add(captain.playerId);
      if (roster.length > 0 && !roster.some((player) => playerIdentity(player) === captain.playerId && playerTeam(player) === team && player.active !== false)) errors.push(`Captain ${captain.jerseyNumber} is not an active ${team} roster player.`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function awaitingKickoffState(rules: { minutesPerPeriod?: number; kickoffSpot?: unknown }, toss: CoinTossRecord) {
  if (!toss.firstHalfKickingTeam || !toss.firstHalfReceivingTeam) throw new Error('Completed toss is required to initialize awaiting kickoff.');
  const seconds = Math.max(1, Number(rules.minutesPerPeriod || 0)) * 60;
  const configuredKickoffSpot = normalizeFootballSpot(rules.kickoffSpot, { defaultSide: 'H' });
  const kickoffYard = configuredKickoffSpot?.match(/^[HV](\d{1,2})$/)?.[1];
  const kickoffSpot = configuredKickoffSpot === '50'
    ? '50'
    : kickoffYard
      ? `${toss.firstHalfKickingTeam}${kickoffYard}`
      : null;
  return {
    gamePhase: 'awaitingKickoff' as const,
    game: { status: 'pregame', period: 1 },
    clock: { period: 1, clock: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:00`, clockTenths: seconds * 10, isRunning: false, playClock: null, lastStartedAt: null },
    liveState: { possession: null, down: null, distance: null, yardLine: kickoffSpot, lineToGain: null, goalToGo: false, redZone: false, driveId: null, driveNumber: 0, kickoffTeam: toss.firstHalfKickingTeam, nextPlayContext: 'awaitingKickoff' },
    kickingTeam: toss.firstHalfKickingTeam,
    receivingTeam: toss.firstHalfReceivingTeam,
  };
}

export function availablePlayFamilies(phase: FootballGamePhase): readonly string[] {
  if (phase === 'pregame') return ['gameControl'];
  if (phase === 'awaitingKickoff') return ['kickoff', 'penalty', 'gameControl'];
  if (phase === 'live') return ['rush', 'pass', 'punt', 'kickoff', 'fieldGoal', 'try', 'penalty', 'gameControl'];
  if (phase === 'halftime') return ['gameControl'];
  return [];
}

export function isPlayFamilyAvailable(phase: FootballGamePhase, family: string): boolean {
  return availablePlayFamilies(phase).includes(family);
}

export function isConsequentialTossEdit(previous: CoinTossRecord, next: CoinTossRecord, kickoffAccepted: boolean): boolean {
  if (!kickoffAccepted) return false;
  return previous.firstHalfKickingTeam !== next.firstHalfKickingTeam
    || previous.firstHalfReceivingTeam !== next.firstHalfReceivingTeam
    || previous.direction !== next.direction
    || previous.secondHalfChoiceTeam !== next.secondHalfChoiceTeam;
}

export function activeRosterPlayers(roster: readonly PlayerResolutionRosterPlayer[]) {
  return roster.filter((player) => player.active !== false);
}

export function playerIdentity(player: PlayerResolutionRosterPlayer): string {
  return String(player.playerId ?? player.id ?? player.PlayerID ?? player.player_id ?? '');
}

export function playerTeam(player: PlayerResolutionRosterPlayer): TeamCode | null {
  const value = String(player.team ?? player.teamCode ?? player.team_code ?? player.Team ?? '').toUpperCase();
  return value === 'H' || value === 'HOME' ? 'H' : value === 'V' || value === 'VISITOR' || value === 'AWAY' ? 'V' : null;
}
